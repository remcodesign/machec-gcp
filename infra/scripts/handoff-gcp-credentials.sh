#!/usr/bin/env bash
# Step 1.4 (specs-final.md, D9) — GCP → Laravel Cloud credential handoff.
#
# Downloads the laravel_cloud_gcp_bridge service-account key object that
# Terraform (Step 1.2/storage.tf) already wrote to the private
# machec-gcp-credentials-prod bucket, and hands it to Laravel Cloud as an
# organization-level secret named GCP_SERVICE_ACCOUNT_JSON, attached only to
# machec-commercial-core's production environment (D4/D23 — the only v1 app
# that ever makes an outbound GCP call, its Pub/Sub publish). The plaintext
# key never touches a shell variable or disk beyond the piped stream.
#
# This script only ever calls `gcloud storage` (read-only — fetching an
# object Terraform already created, not a deployment/IAM change) and `cloud`
# (write side, Laravel Cloud only) — never `terraform apply` and never a
# `gcloud` IAM/deploy command (README-local.md).
#
# Requires: `cloud` CLI authenticated (`cloud auth -n`), `gcloud` authenticated
# (`gcloud auth login` — a human login, distinct from the ADC Terraform uses),
# `jq`.

set -euo pipefail

CLOUD_BIN="${CLOUD_BIN:-cloud}"
GCLOUD_BIN="${GCLOUD_BIN:-gcloud}"

if ! command -v "$CLOUD_BIN" >/dev/null 2>&1; then
  echo "error: '$CLOUD_BIN' not found on PATH — install with 'composer global require laravel/cloud-cli'" >&2
  exit 1
fi
if ! command -v "$GCLOUD_BIN" >/dev/null 2>&1; then
  echo "error: '$GCLOUD_BIN' not found on PATH" >&2
  exit 1
fi
if ! command -v jq >/dev/null 2>&1; then
  echo "error: 'jq' is required" >&2
  exit 1
fi

PROJECT_ID="${PROJECT_ID:-machec-prod}"
BUCKET="machec-gcp-credentials-prod"
OBJECT="laravel-cloud-gcp-bridge-key.json"

SECRET_NAME="GCP_SERVICE_ACCOUNT_JSON"
APPLICATION_NAME="machec-commercial-core"
ENVIRONMENT_NAME="production"

log() { echo "[handoff-gcp-credentials] $*" >&2; }

# ---- id lookups (idempotency checks, same pattern as provision-laravel-cloud.sh) --

application_id_by_name() {
  "$CLOUD_BIN" application:list --json -n | jq -r --arg name "$1" '.[] | select(.name == $name) | .id' | head -n1
}

environment_id_by_name() {
  "$CLOUD_BIN" environment:list "$1" --json -n | jq -r --arg name "$2" '.[] | select(.name == $name) | .id' | head -n1
}

secret_id_by_name() {
  # secret:list's JSON shape names the secret's identifier "key", not "name"
  # (unlike application:list/environment:list, which do use "name") —
  # confirmed against a live account; using "name" here silently never
  # matches and creates a duplicate secret on every run.
  "$CLOUD_BIN" secret:list --json -n | jq -r --arg name "$1" '.[] | select(.key == $name) | .id' | head -n1
}

secret_attached_to_environment() {
  local environment_id="$1" secret_id="$2"
  "$CLOUD_BIN" environment-secret:list "$environment_id" --json -n \
    | jq -e --arg id "$secret_id" '.[] | select(.id == $id)' >/dev/null 2>&1
}

# ---- guard: refuse to run against a missing/stale GCS object --------------

if ! "$GCLOUD_BIN" storage objects describe "gs://${BUCKET}/${OBJECT}" --project="$PROJECT_ID" >/dev/null 2>&1; then
  echo "error: gs://${BUCKET}/${OBJECT} does not exist — run 'terraform apply' (Step 1.2) first" >&2
  exit 1
fi

# ---- resolve the one target environment ------------------------------------

application_id="$(application_id_by_name "$APPLICATION_NAME")"
if [ -z "$application_id" ]; then
  echo "error: Laravel Cloud application '$APPLICATION_NAME' not found — run provision-laravel-cloud.sh (Step 1.3) first" >&2
  exit 1
fi

environment_id="$(environment_id_by_name "$application_id" "$ENVIRONMENT_NAME")"
if [ -z "$environment_id" ]; then
  echo "error: environment '$ENVIRONMENT_NAME' not found for application '$APPLICATION_NAME' ($application_id)" >&2
  exit 1
fi

# ---- ensure the secret exists (create only if missing, plaintext piped straight from GCS) --

secret_id="$(secret_id_by_name "$SECRET_NAME")"
if [ -n "$secret_id" ]; then
  log "secret '$SECRET_NAME' already exists ($secret_id) — skipping create"
else
  log "creating secret '$SECRET_NAME' from gs://${BUCKET}/${OBJECT}"
  secret_id="$("$GCLOUD_BIN" storage cat "gs://${BUCKET}/${OBJECT}" --project="$PROJECT_ID" \
    | "$CLOUD_BIN" secret:create --name="$SECRET_NAME" --json -n | jq -r '.id')"
  log "created secret '$SECRET_NAME' ($secret_id)"
fi

# ---- attach it to commercial-core's production environment only -----------

if secret_attached_to_environment "$environment_id" "$secret_id"; then
  log "secret '$SECRET_NAME' already attached to environment $environment_id — skipping attach"
else
  log "attaching secret '$SECRET_NAME' ($secret_id) to environment $environment_id"
  "$CLOUD_BIN" environment-secret:attach "$environment_id" "$secret_id" -n >/dev/null
fi

log "done — run 'cloud environment-secret:list $environment_id --json -n' to verify."
