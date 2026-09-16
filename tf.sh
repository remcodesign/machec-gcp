#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# tf.sh — Terraform convenience wrapper for machec-gcp/infra.
#
# Unlike an earlier project's version of this script, this one does NOT
# fetch a service-account key file to authenticate Terraform. Local runs
# authenticate as YOU, via Application Default Credentials:
#
#   gcloud auth application-default login   # one-time, per machine
#
# The only service-account key this project ever creates (D4/D9) belongs to
# `laravel_cloud_gcp_bridge` — it exists solely so the four Laravel Cloud
# apps can call GCP, and it is handed to Laravel Cloud by
# scripts/handoff-gcp-credentials.sh, never used to run Terraform itself.
# Reusing it here would blur that boundary for no benefit (see docs/gcp_tools
# README.md and specs-final.md D4/D84).
#
# Usage:
#   ./tf.sh init                  # terraform init (load remote state)
#   ./tf.sh plan                  # plan + open the HTML viewer (see plan-view)
#   ./tf.sh plan-view             # explicit alias for plan + viewer
#   ./tf.sh apply                 # init + apply (confirm prompt)
#   ./tf.sh apply -auto-approve   # non-interactive (CI)
#   ./tf.sh destroy               # init + destroy
#   ./tf.sh validate              # schema check (no creds needed)
#   ./tf.sh secret set catalog-read-token <value>   # GCP Secret Manager (BFF-only secrets, D84)
#   ./tf.sh secret show catalog-read-token          # redacted active version
#   ./tf.sh secret list                             # all Secret Manager secret names in the project
#   ./tf.sh ...                                     # any other terraform command, e.g. ./tf.sh state list
#
# NOTE on secrets: this project has TWO separate secret stores, on purpose
# (specs-final.md D84) — this script's `secret` subcommand only ever talks
# to GCP Secret Manager, which is reachable by GCP-native compute (the BFF
# on Cloud Run) and holds exactly one v1 secret: the `catalog:read` Sanctum
# token (D41). The four Laravel Cloud apps' secrets (GCP_SERVICE_ACCOUNT_JSON,
# D9; any future D33-style app-to-app token) live in Laravel Cloud's own
# organization-level Secrets Manager instead, managed via the `cloud` CLI
# (see scripts/handoff-gcp-credentials.sh, Step 1.4) — never via this script.
# ---------------------------------------------------------------------------
set -euo pipefail

# ---- Config -----------------------------------------------------------------
PROJECT_ID="${PROJECT_ID:-machec-prod}"
REGION="${REGION:-europe-west4}"

# Resolve the repo root (parent of this script, i.e. machec-gcp/) and the infra dir.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$SCRIPT_DIR/infra"
TERRAFORM_BIN="${TERRAFORM_BIN:-terraform}"
GCLOUD_BIN="${GCLOUD_BIN:-gcloud}"
PYTHON_BIN="${PYTHON_BIN:-python3}"
OPEN_BIN="${OPEN_BIN:-open}"          # macOS; Linux users can set BROWSER

# --- Helpers ------------------------------------------------------------------
die() { echo "error: $*" >&2; exit 1; }

# All secret actions require an explicit secret name, so every secret is
# handled with the same syntax:
#   ./tf.sh secret set  <name> <value>   # add/rotate a version
#   ./tf.sh secret show <name>           # show active version (redacted)

secret_set() {
  local sname="$1" value="${2:-}"
  [[ -n "$value" ]] || die "usage: ./tf.sh secret set <name> <value>"
  printf '%s' "$value" | "$GCLOUD_BIN" secrets versions add "$sname" \
    --data-file=- \
    --project="$PROJECT_ID" >/dev/null
  echo "New version added to Secret Manager '$sname'."
}

secret_current() {
  local sname="$1" v
  v="$("$GCLOUD_BIN" secrets versions access latest --secret="$sname" --project="$PROJECT_ID" 2>/dev/null)" || { echo "No active version for '$sname' yet." >&2; return 1; }
  echo "Secret '$sname' active version starts with: ${v:0:8}... (len ${#v})"
}

run_secret() {
  local action="${1:-show}"
  shift 2>/dev/null || true
  case "$action" in
    set)
      [[ $# -ge 2 ]] || die "usage: ./tf.sh secret set <name> <value>"
      secret_set "$1" "$2"
      ;;
    list)
      "$GCLOUD_BIN" secrets list --project="$PROJECT_ID" --format="value(name)"
      ;;
    show|current)
      [[ $# -ge 1 ]] || die "usage: ./tf.sh secret show <name>"
      secret_current "$1"
      ;;
    *)
      die "usage: ./tf.sh secret {set <name> <value> | show <name> | list}"
      ;;
  esac
}

run_plan_view() {
  cd "$INFRA_DIR"

  _TMP_DIR="$(mktemp -d)"
  trap 'rm -rf "$_TMP_DIR"' RETURN EXIT

  local plan_file="$_TMP_DIR/plan.tfplan"
  local plan_json="$_TMP_DIR/plan.json"
  local out_html="${PLAN_VIEW_OUT:-$SCRIPT_DIR/plan-view.html}"
  local report_py="$SCRIPT_DIR/tools/plan_report.py"

  [[ -f "$report_py" ]] || die "plan_report.py not found at $report_py"
  command -v "$PYTHON_BIN" >/dev/null 2>&1 || die "python3 is required for plan-view"

  # 1. Generate the plan to a binary file (from remote state).
  "$TERRAFORM_BIN" plan -out="$plan_file" "$@"

  # 2. Convert to JSON for the report.
  "$TERRAFORM_BIN" show -json "$plan_file" > "$plan_json"

  # 3. Render the HTML report and open it in the default browser.
  "$PYTHON_BIN" "$report_py" "$plan_json" -o "$out_html"
  echo "Plan report: $out_html"

  if command -v "$OPEN_BIN" >/dev/null 2>&1 && [[ "$(uname -s)" == "Darwin" ]]; then
    "$OPEN_BIN" "$out_html"
  else
    echo "Open $out_html manually in your browser."
  fi
}

run_terraform() {
  # Terraform must run from the infra dir (backend config lives there).
  cd "$INFRA_DIR"
  "$TERRAFORM_BIN" "$@"
}

# --- Main -------------------------------------------------------------------
main() {
  local cmd="${1:-}"
  case "$cmd" in
    secret)
      shift
      run_secret "$@"
      ;;
    plan|plan-view)
      shift
      run_plan_view "$@"
      ;;
    *)
      run_terraform "$@"
      ;;
  esac
}

main "$@"
