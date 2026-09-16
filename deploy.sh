#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# deploy.sh — build + push the BFF's Cloud Run image to Artifact Registry,
# then optionally terraform plan/apply.
#
# v1 has exactly ONE container-shaped deployable in this repo: `bff/`
# (machec-gcp/bff, the Next.js storefront). The four Laravel apps
# (customer-identity, pim-core, commercial-core, logistics-wms) are NOT
# built or deployed by this script — they live in their own repos and
# deploy via the `cloud` CLI (Laravel Cloud), not Docker/Terraform (D7).
#
# `machec-gcp/infra/cloud_run.tf`'s `google_cloud_run_v2_service.bff`
# references this image:
#   ${REGION}-docker.pkg.dev/${PROJECT_ID}/bff/bff:${IMAGE_TAG}
#
# Usage:
#   ./deploy.sh build           # build the bff image (no push)
#   ./deploy.sh push            # build + push
#   ./deploy.sh plan            # build+push, then ./tf.sh plan
#   ./deploy.sh apply           # build+push, then ./tf.sh apply (interactive)
#   ./deploy.sh check           # typecheck+lint+knip+test for bff (no build)
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
APP_DIR="bff"

IMAGE_PREFIX="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}"
PLATFORM="${PLATFORM:-linux/amd64}"

# Release tag: a short git commit hash (or "latest" when not in a git repo).
# Each release pins a DIFFERENT tag so `terraform apply` sees a changed image
# reference and actually redeploys the Cloud Run service.
#
# The tag is written to `infra/terraform.tfvars` (COMMITTED) so it is visible
# in git and read identically by both `./tf.sh` and `./deploy.sh`.
image_tag() {
  local sha
  if sha="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null)"; then
    echo "$sha"
  else
    echo "latest"
  fi
}
IMAGE_TAG="${IMAGE_TAG:-$(image_tag)}"
TFVARS="$ROOT/infra/terraform.tfvars"

write_tfvars() {
  # Only ever touch the 'image_tag' line — keep any other committed values.
  if [[ -f "$TFVARS" ]] && grep -q '^image_tag' "$TFVARS"; then
    sed -i.bak "s|^image_tag.*|image_tag = \"$IMAGE_TAG\"|" "$TFVARS" && rm -f "$TFVARS.bak"
  else
    printf 'image_tag = "%s"\n' "$IMAGE_TAG" >> "$TFVARS"
  fi
  echo "Pinned image tag ${IMAGE_TAG} in ${TFVARS}"
}

build_image() {
  local dir="$1" name="$2"
  local img="${IMAGE_PREFIX}/${name}:${IMAGE_TAG}"
  echo "==> Building ${img} from ${dir}/"
  if docker buildx version >/dev/null 2>&1; then
    docker buildx build --platform "$PLATFORM" --push --tag "$img" "$ROOT/$dir"
  else
    docker build --platform "$PLATFORM" --tag "$img" "$ROOT/$dir"
    docker push "$img"
  fi
  echo "$img"
}

build_all() {
  # Gate the image build on the full tooling suite — typecheck -> lint ->
  # knip -> test -> build (D44). Any failure exits non-zero and aborts
  # before an image is pushed.
  run_checks "$APP_DIR" 1
  build_image "$APP_DIR" bff

  # ·· Post-V1 (D43) slot — NOT built for v1. Once catalog-sync-adapter
  # exists it would build/push here as a second image, same pattern:
  #   run_checks catalog-sync-adapter 1
  #   build_image catalog-sync-adapter catalog-sync-adapter
}

# D44: bff is strict TypeScript with `output: 'standalone'` — `npm run build`
# (`next build`) is the module/export resolve guard, same role
# `tsc -p tsconfig.build.json` plays for a plain TS package. `knip` is the
# dead-code gate; it runs against full source + tests present, not against
# the Docker build's copied `.next/standalone` output.
run_checks() {
  local dir="$1" check_build="${2:-0}"
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

push_all() {
  write_tfvars
  build_all
}

check_all() {
  run_checks "$APP_DIR" 0
}

# ESLint --fix + Prettier format, then the full check gate. No build, no
# image push.
fix_all() {
  echo "==> Fix: ${APP_DIR}"
  ( cd "$ROOT/$APP_DIR" && npm run lint:fix -- --quiet ) || true
  ( cd "$ROOT/$APP_DIR" && npm run format 2>&1 | grep -v '(unchanged)' ) || true
  check_all
}

echo "Using image tag: ${IMAGE_TAG}"

case "${1:-build}" in
  build)  build_all ;;
  push)   push_all ;;
  plan)   push_all; (cd "$ROOT" && ./tf.sh plan) ;;
  apply)  push_all; (cd "$ROOT" && ./tf.sh apply) ;;
  check)  check_all ;;
  fix)    fix_all ;;
  *)      echo "usage: $0 {build|push|plan|apply|check|fix}" >&2; exit 2 ;;
esac
