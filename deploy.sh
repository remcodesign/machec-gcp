#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# deploy.sh — build + push every buildable service's Cloud Run image to
# Artifact Registry, then optionally terraform plan/apply.
#
# "Buildable service" is discovered, not hardcoded: any directory (up to 3
# levels deep, skipping node_modules/.git/.next/vendor noise) containing a
# file literally named `Dockerfile` (not `Dockerfile.emulators` or similar —
# that's local-only tooling, e.g. bff's emulator compose file). Today that's
# exactly `bff/` (the Next.js storefront). Adding a second one later — e.g.
# the Post-V1 `catalog-sync-adapter` (D43) — needs nothing added here; drop
# a `Dockerfile` in its directory and this script picks it up on the next
# run. The four Laravel apps (customer-identity, pim-core, commercial-core,
# logistics-wms) are NOT built or deployed by this script regardless — they
# live in their own repos and deploy via the `cloud` CLI (Laravel Cloud),
# not Docker/Terraform (D7), and have no `Dockerfile` here to discover.
#
# What discovery does NOT remove: a brand-new service still needs its own
# Terraform resource (referencing its image) and its own `variable` block
# in infra/variables.tf before `terraform apply` can deploy it — that's a
# real infra design decision, not something to auto-generate. This script
# only saves you from hand-maintaining the build/push/tag list; write_tfvars
# below pins every discovered service's tag into terraform.tfvars regardless,
# so that variable is already waiting the moment a human adds it to Terraform.
#
# `machec-gcp/infra/cloud_run.tf`'s `google_cloud_run_v2_service.bff`
# references bff's image:
#   ${REGION}-docker.pkg.dev/${PROJECT_ID}/bff/bff:${image_tag}
#
# Usage:
#   ./deploy.sh build           # build every discovered service (no push)
#   ./deploy.sh push            # build + push every discovered service
#   ./deploy.sh plan            # build+push, then ./tf.sh plan
#   ./deploy.sh apply           # build+push, then ./tf.sh apply (interactive)
#   ./deploy.sh check           # typecheck+lint+knip+test for every npm-based service (no build)
#   ./deploy.sh fix             # eslint --fix + prettier format, then check (no build)
#
# Bootstrap ordering (D84): the very first `terraform apply` that declares
# `google_cloud_run_v2_service.bff` must run AFTER an image already exists
# at the tag it references — always run `./deploy.sh push` before the first
# `./tf.sh apply` that touches cloud_run.tf. Every subsequent Step 1.1–1.6
# resource (Artifact Registry, IAM, Secret Manager container) has no such
# ordering requirement and can be applied any time from a clean project.
#
# Notes:
#   - Uses a Linux/amd64 platform so the image matches Cloud Run's runtime.
#   - Requires Docker Buildx (docker buildx). Falls back to plain build+load.
# ---------------------------------------------------------------------------
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REGION="${REGION:-europe-west4}"
PROJECT_ID="${PROJECT_ID:-machec-prod}"
REPO="${REPO:-bff}"
ROOT="$SCRIPT_DIR"

IMAGE_PREFIX="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}"
PLATFORM="${PLATFORM:-linux/amd64}"
TFVARS="$ROOT/infra/terraform.tfvars"

# Discover buildable service directories: anywhere under $ROOT (max depth 3,
# skipping dependency/build/vcs noise) with a file named exactly `Dockerfile`.
# Prints paths relative to $ROOT, one per line, sorted for stable ordering.
discover_service_dirs() {
  find "$ROOT" -maxdepth 3 \
    \( -name node_modules -o -name .git -o -name .next -o -name vendor -o -name .terraform \) -prune -o \
    -type f -name Dockerfile -print \
  | while IFS= read -r dockerfile; do
      local dir="${dockerfile%/Dockerfile}"
      echo "${dir#"$ROOT"/}"
    done | sort -u
}

# Release tag: the short hash of the last commit that actually touched the
# given service directory — NOT `git rev-parse HEAD` (the whole-repo tip).
# This repo mixes an infra-only tree (`infra/`) with buildable service
# directories in the same commit history; using repo-wide HEAD meant an
# infra-only commit still bumped a service's image tag, which made Terraform
# see a changed image reference and redeploy a Cloud Run revision whose
# image content hadn't actually changed. Scoping the hash to `-- "$dir"`
# keeps the tag — and so the tfvars diff, and so the Cloud Run replace —
# stable across any commit that doesn't touch that service, while still
# changing (and triggering a real redeploy) the moment it does. Falls back
# to "latest" outside a git repo, or before that directory's first commit.
image_tag_for_dir() {
  local dir="$1" sha
  if sha="$(git -C "$ROOT" log -1 --format=%h -- "$dir" 2>/dev/null)" && [[ -n "$sha" ]]; then
    echo "$sha"
  else
    echo "latest"
  fi
}

# Terraform variable key for a discovered service's tag. `bff` keeps the
# original, un-prefixed `image_tag` name (matching the already-declared
# `variable "image_tag"` in infra/variables.tf, read by cloud_run.tf) so
# existing infra is untouched; any other discovered service gets its own
# `<name>_image_tag` key, sanitized to a valid HCL identifier. Terraform
# only warns (doesn't fail plan/validate) on a tfvars key with no matching
# declared variable, so this is safe to write before that variable exists —
# it's just waiting for the human step described in the header comment.
tfvars_key_for_dir() {
  local dir="$1" name
  name="$(basename "$dir")"
  if [[ "$name" == "bff" ]]; then
    echo "image_tag"
  else
    echo "${name//-/_}_image_tag"
  fi
}

write_tfvars() {
  local dir key tag
  while IFS= read -r dir; do
    [[ -z "$dir" ]] && continue
    key="$(tfvars_key_for_dir "$dir")"
    tag="$(image_tag_for_dir "$dir")"
    if [[ -f "$TFVARS" ]] && grep -q "^${key} " "$TFVARS"; then
      sed -i.bak "s|^${key} .*|${key} = \"${tag}\"|" "$TFVARS" && rm -f "$TFVARS.bak"
    else
      printf '%s = "%s"\n' "$key" "$tag" >> "$TFVARS"
    fi
    echo "Pinned ${key} = ${tag} in ${TFVARS}"
  done < <(discover_service_dirs)
}

build_image() {
  local dir="$1" name="$2" tag="$3"
  local img="${IMAGE_PREFIX}/${name}:${tag}"
  echo "==> Building ${img} from ${dir}/"
  if docker buildx version >/dev/null 2>&1; then
    docker buildx build --platform "$PLATFORM" --push --tag "$img" "$ROOT/$dir"
  else
    docker build --platform "$PLATFORM" --tag "$img" "$ROOT/$dir"
    docker push "$img"
  fi
  echo "$img"
}

# D44: an npm-based service (has package.json) is gated on the full tooling
# suite — typecheck -> lint -> knip -> test -> build — before its image is
# built/pushed. `npm run build` (`next build`) is the module/export resolve
# guard, same role `tsc -p tsconfig.build.json` plays for a plain TS
# package; `knip` is the dead-code gate. A service with no package.json
# (e.g. a future PHP/Composer service, D43) has no npm-based check to run
# here — that's a real gap to fill with that service's own tooling when it
# exists, not something this generic gate can fake.
run_checks() {
  local dir="$1" check_build="${2:-0}"
  if [[ ! -f "$ROOT/$dir/package.json" ]]; then
    echo "==> Checks: ${dir} — no package.json, skipping npm-based checks (add this service's own check tooling when it exists)"
    return 0
  fi
  echo "==> Checks: ${dir}"
  ( cd "$ROOT/$dir" && npm run typecheck )
  ( cd "$ROOT/$dir" && npm run lint )
  ( cd "$ROOT/$dir" && npm run knip )
  ( cd "$ROOT/$dir" && npm test )
  if [[ "$check_build" == "1" ]]; then
    ( cd "$ROOT/$dir" && npm run build )
    echo "==> Checks ok (incl. build): ${dir}"
  else
    echo "==> Checks ok: ${dir}"
  fi
}

build_all() {
  local dir name tag
  while IFS= read -r dir; do
    [[ -z "$dir" ]] && continue
    name="$(basename "$dir")"
    tag="$(image_tag_for_dir "$dir")"
    echo "==> Service discovered: ${name} (${dir}/Dockerfile), tag ${tag}"
    run_checks "$dir" 1
    build_image "$dir" "$name" "$tag"
  done < <(discover_service_dirs)
}

push_all() {
  write_tfvars
  build_all
}

check_all() {
  local dir
  while IFS= read -r dir; do
    [[ -z "$dir" ]] && continue
    run_checks "$dir" 0
  done < <(discover_service_dirs)
}

# ESLint --fix + Prettier format for every npm-based discovered service,
# then the full check gate. No build, no image push.
fix_all() {
  local dir
  while IFS= read -r dir; do
    [[ -z "$dir" ]] && continue
    if [[ ! -f "$ROOT/$dir/package.json" ]]; then
      continue
    fi
    echo "==> Fix: ${dir}"
    ( cd "$ROOT/$dir" && npm run lint:fix -- --quiet ) || true
    ( cd "$ROOT/$dir" && npm run format 2>&1 | grep -v '(unchanged)' ) || true
  done < <(discover_service_dirs)
  check_all
}

case "${1:-build}" in
  build)  build_all ;;
  push)   push_all ;;
  plan)   push_all; (cd "$ROOT" && ./tf.sh plan) ;;
  apply)  push_all; (cd "$ROOT" && ./tf.sh apply) ;;
  check)  check_all ;;
  fix)    fix_all ;;
  *)      echo "usage: $0 {build|push|plan|apply|check|fix}" >&2; exit 2 ;;
esac
