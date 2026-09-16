#!/usr/bin/env bash
# Step 1.3 (specs-final.md, D7) — Laravel Cloud provisioning, CLI only, never Terraform.
#
# Wraps `cloud application:create`, `cloud environment:create`, four rounds of
# `cloud database-cluster:create` + `cloud database:create` + `cloud cache:create`
# (D37 — one dedicated Postgres cluster + one dedicated Flex Cache per app,
# attached only to that app's own environment), and `cloud bucket:create` for
# the one shared object-storage bucket. Every create is preceded by a
# `:list --json -n` check (per each app's `deploying-to-cloud` skill CRUD
# pattern) so re-running this script never duplicates a resource — safe to
# run again after a partial failure.
#
# Which cluster/cache pair belongs to which environment is decided once,
# explicitly, in the APPS table below — never inferred from creation order.
#
# Requires: `cloud` CLI authenticated (`cloud auth -n`), `jq`.
#
# This script only ever calls `cloud`, never `gcloud`/`terraform` (README-local.md).

set -euo pipefail

CLOUD_BIN="${CLOUD_BIN:-cloud}"

if ! command -v "$CLOUD_BIN" >/dev/null 2>&1; then
  echo "error: '$CLOUD_BIN' not found on PATH — install with 'composer global require laravel/cloud-cli'" >&2
  exit 1
fi
if ! command -v jq >/dev/null 2>&1; then
  echo "error: 'jq' is required" >&2
  exit 1
fi

# Laravel Cloud's own regions (AWS-shaped: us-east-1, eu-central-1, ...) are
# independent of the GCP region (europe-west4) used elsewhere in this repo —
# Laravel Cloud does not run inside GCP (D4). eu-central-1 (Frankfurt) is the
# closest Laravel Cloud region to europe-west4 (Netherlands) and matches the
# region this account's other Laravel Cloud apps already use.
REGION="eu-central-1"
BRANCH="main"
ENVIRONMENT_NAME="production"

DB_TYPE="neon_serverless_postgres"   # D37 — Postgres, never MySQL, one cluster per app
DB_ENGINE_VERSION="16"               # pinned to match every app's local ddev postgres (v16) — never left at
                                      # "newest available" (currently 18), which would silently drift from local
CACHE_TYPE="laravel_valkey"          # "Flex Cache" in specs-final.md is this product's flex size tier
CACHE_SIZE="valkey-flex-250mb"       # smallest Flex tier — v1/POC scale, bump later per-app if needed
CACHE_EVICTION_POLICY="allkeys-lru"  # required by the CLI for laravel_valkey; API defaults to this anyway

# name|repository|db_cluster_name|db_name|cache_name
APPS=(
  "machec-customer-identity|remcodesign/machec-customer-identity|machec-customer-identity-db|customer_identity|machec-customer-identity-cache"
  "machec-pim-core|remcodesign/machec-pim-core|machec-pim-core-db|pim_core|machec-pim-core-cache"
  "machec-commercial-core|remcodesign/machec-commercial-core|machec-commercial-core-db|commercial_core|machec-commercial-core-cache"
  "machec-logistics-wms|remcodesign/machec-logistics-wms|machec-logistics-wms-db|logistics_wms|machec-logistics-wms-cache"
)

# The one shared Laravel Cloud object-storage bucket this step provisions
# (D31/D28 — its eventual product-image consumer on pim-core is Post-V1, not
# built yet; only the container is created here, same "container now, value/
# attachment later" split Step 1.6 uses for the BFF's GCP secret).
BUCKET_NAME="machec-shared-storage"
BUCKET_VISIBILITY="private"
BUCKET_JURISDICTION="default"
BUCKET_KEY_NAME="machec-shared-storage-key"
BUCKET_KEY_PERMISSION="read_write"

log() { echo "[provision-laravel-cloud] $*" >&2; }

# ---- id lookups (idempotency checks) ---------------------------------------

application_id_by_name() {
  "$CLOUD_BIN" application:list --json -n | jq -r --arg name "$1" '.[] | select(.name == $name) | .id' | head -n1
}

environment_id_by_name() {
  "$CLOUD_BIN" environment:list "$1" --json -n | jq -r --arg name "$2" '.[] | select(.name == $name) | .id' | head -n1
}

database_cluster_id_by_name() {
  "$CLOUD_BIN" database-cluster:list --json -n | jq -r --arg name "$1" '.[] | select(.name == $name) | .id' | head -n1
}

database_id_by_name() {
  "$CLOUD_BIN" database:list "$1" --json -n | jq -r --arg name "$2" '.[] | select(.name == $name) | .id' | head -n1
}

cache_id_by_name() {
  "$CLOUD_BIN" cache:list --json -n | jq -r --arg name "$1" '.[] | select(.name == $name) | .id' | head -n1
}

bucket_id_by_name() {
  "$CLOUD_BIN" bucket:list --json -n | jq -r --arg name "$1" '.[] | select(.name == $name) | .id' | head -n1
}

# ---- ensure_* (create only if the lookup above came back empty) -----------

ensure_application() {
  local name="$1" repository="$2" id
  id="$(application_id_by_name "$name")"
  if [ -n "$id" ]; then
    log "application '$name' already exists ($id) — skipping create"
  else
    log "creating application '$name' ($repository, $REGION)"
    id="$("$CLOUD_BIN" application:create \
      --name="$name" \
      --repository="$repository" \
      --region="$REGION" \
      --json -n | jq -r '.id')"
    log "created application '$name' ($id)"
  fi
  echo "$id"
}

ensure_environment() {
  local app_id="$1" name="$2" id
  id="$(environment_id_by_name "$app_id" "$name")"
  if [ -n "$id" ]; then
    log "environment '$name' already exists for $app_id ($id) — skipping create"
  else
    log "creating environment '$name' for $app_id (branch $BRANCH)"
    id="$("$CLOUD_BIN" environment:create "$app_id" \
      --name="$name" \
      --branch="$BRANCH" \
      --json -n | jq -r '.id')"
    log "created environment '$name' ($id)"
  fi
  echo "$id"
}

ensure_database_cluster() {
  local name="$1" id
  id="$(database_cluster_id_by_name "$name")"
  if [ -n "$id" ]; then
    log "database cluster '$name' already exists ($id) — skipping create"
  else
    log "creating database cluster '$name' ($DB_TYPE, $REGION)"
    id="$("$CLOUD_BIN" database-cluster:create \
      --name="$name" \
      --type="$DB_TYPE" \
      --engine-version="$DB_ENGINE_VERSION" \
      --region="$REGION" \
      --json -n | jq -r '.id')"
    log "created database cluster '$name' ($id)"
  fi
  echo "$id"
}

ensure_database() {
  local cluster_id="$1" name="$2" id attempt=0
  id="$(database_id_by_name "$cluster_id" "$name")"
  if [ -n "$id" ]; then
    log "database '$name' already exists in cluster $cluster_id ($id) — skipping create"
    echo "$id"
    return 0
  fi
  # A freshly-created cluster's own default database can still be mid-write
  # for a few seconds even after the cluster itself reports "available" —
  # retry past the API's transient "update operation is already in
  # progress" validation error instead of failing outright.
  while true; do
    log "creating database '$name' in cluster $cluster_id"
    if id="$("$CLOUD_BIN" database:create "$cluster_id" --name="$name" --json -n 2>/tmp/db-create-err.$$ | jq -r '.id')" && [ -n "$id" ] && [ "$id" != "null" ]; then
      rm -f /tmp/db-create-err.$$
      log "created database '$name' ($id)"
      echo "$id"
      return 0
    fi
    attempt=$((attempt + 1))
    if [ "$attempt" -ge 10 ]; then
      cat /tmp/db-create-err.$$ >&2 2>/dev/null || true
      rm -f /tmp/db-create-err.$$
      echo "error: failed to create database '$name' in cluster $cluster_id after $attempt attempts" >&2
      return 1
    fi
    log "database create for '$name' not ready yet — retrying in 5s..."
    sleep 5
  done
}

ensure_cache() {
  local name="$1" id
  id="$(cache_id_by_name "$name")"
  if [ -n "$id" ]; then
    log "cache '$name' already exists ($id) — skipping create"
  else
    log "creating cache '$name' ($CACHE_TYPE/$CACHE_SIZE, $REGION)"
    id="$("$CLOUD_BIN" cache:create \
      --name="$name" \
      --type="$CACHE_TYPE" \
      --size="$CACHE_SIZE" \
      --region="$REGION" \
      --auto-upgrade-enabled=false \
      --is-public=false \
      --eviction-policy="$CACHE_EVICTION_POLICY" \
      --json -n | jq -r '.id')"
    log "created cache '$name' ($id)"
  fi
  echo "$id"
}

ensure_bucket() {
  local name="$1" id
  id="$(bucket_id_by_name "$name")"
  if [ -n "$id" ]; then
    log "bucket '$name' already exists ($id) — skipping create"
  else
    log "creating bucket '$name' ($BUCKET_VISIBILITY)"
    id="$("$CLOUD_BIN" bucket:create \
      --name="$name" \
      --region="$REGION" \
      --visibility="$BUCKET_VISIBILITY" \
      --jurisdiction="$BUCKET_JURISDICTION" \
      --key-name="$BUCKET_KEY_NAME" \
      --key-permission="$BUCKET_KEY_PERMISSION" \
      --allowed-origins="" \
      --json -n | jq -r '.id')"
    log "created bucket '$name' ($id)"
  fi
  echo "$id"
}

wait_for_database_cluster_available() {
  local cluster_id="$1" status attempt=0
  while true; do
    status="$("$CLOUD_BIN" database-cluster:get "$cluster_id" --json -n | jq -r '.status')"
    [ "$status" = "available" ] && return 0
    attempt=$((attempt + 1))
    if [ "$attempt" -ge 30 ]; then
      echo "error: database cluster $cluster_id did not become available (last status: $status)" >&2
      return 1
    fi
    log "database cluster $cluster_id still provisioning (status: $status) — waiting..."
    sleep 10
  done
}

wait_for_cache_available() {
  local cache_id="$1" status attempt=0
  while true; do
    status="$("$CLOUD_BIN" cache:get "$cache_id" --json -n | jq -r '.status')"
    [ "$status" = "available" ] && return 0
    attempt=$((attempt + 1))
    if [ "$attempt" -ge 30 ]; then
      echo "error: cache $cache_id did not become available (last status: $status)" >&2
      return 1
    fi
    log "cache $cache_id still provisioning (status: $status) — waiting..."
    sleep 10
  done
}

attach_resources_to_environment() {
  local environment_id="$1" database_id="$2" cache_id="$3"
  if [ -z "$database_id" ] || [ "$database_id" = "null" ]; then
    echo "error: refusing to attach — empty database id for environment $environment_id" >&2
    return 1
  fi
  if [ -z "$cache_id" ] || [ "$cache_id" = "null" ]; then
    echo "error: refusing to attach — empty cache id for environment $environment_id" >&2
    return 1
  fi
  log "attaching database $database_id and cache $cache_id to environment $environment_id"
  "$CLOUD_BIN" environment:update "$environment_id" \
    --database-id="$database_id" \
    --cache-id="$cache_id" \
    --json -n --force >/dev/null
}

# ---- main -------------------------------------------------------------------

for entry in "${APPS[@]}"; do
  IFS='|' read -r app_name repository db_cluster_name db_name cache_name <<<"$entry"

  log "== $app_name =="
  app_id="$(ensure_application "$app_name" "$repository")"
  environment_id="$(ensure_environment "$app_id" "$ENVIRONMENT_NAME")"
  cluster_id="$(ensure_database_cluster "$db_cluster_name")"
  wait_for_database_cluster_available "$cluster_id"
  database_id="$(ensure_database "$cluster_id" "$db_name")"
  cache_id="$(ensure_cache "$cache_name")"
  wait_for_cache_available "$cache_id"
  attach_resources_to_environment "$environment_id" "$database_id" "$cache_id"
done

log "== shared object storage =="
ensure_bucket "$BUCKET_NAME" >/dev/null

log "done — run 'cloud application:list --json -n', 'cloud database-cluster:list --json -n', 'cloud cache:list --json -n' to verify."
