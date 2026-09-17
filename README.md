# README

## Project Info

| Component | Value |
| ----------- | --------- |
| Project name | MachEc PROD |
| Project ID | `machec-prod` |
| Project number | `1043374330658` |
| Region | `europe-west4` |
| GCP-hosted deployable | Next.js BFF (Cloud Run Service `bff`) — the storefront's SSR layer |
| Laravel Cloud-hosted deployables | Four independent apps, NOT built by this tooling: `customer-identity`, `pim-core`, `commercial-core`, `logistics-wms` (own repos, deploy via the `cloud` CLI) |
| GCP-managed state | Firestore (carts + D40 catalog cache-aside), Pub/Sub (`order-placed-events`), BigQuery (`order_snapshots`), Cloud Storage (product images) |
| IaC | Terraform (`hashicorp/google` ~> 8.1) |
| CI/CD | `deploy.sh` → Artifact Registry (repo `bff`) → Terraform apply |

**Architecture in one line:** four independently-deployable Laravel Cloud apps (their own dedicated Postgres + Flex Cache each, D37) sit behind Sanctum-token-authenticated internal APIs; one Next.js BFF on Cloud Run calls PIM Core's catalog read API directly and cache-aside-populates Firestore itself (D40) — no separate sync/adapter component in v1. No embeddings provider is wired up — `pim_products.embedding` exists as a schema column (pgvector) but stays unused/`null` in v1; nothing in this project calls out to an embeddings API.

Full build spec: [`../specs-final.md`](../specs-final.md) (Decision Ledger, Domain Journeys) and [`../specs-overview.md`](../specs-overview.md) (concepts/DB/module map).

**Where these files go:** this folder (`docs/gcp_tools/`) is staging. `tf.sh`, `deploy.sh`, `tools/`, and both READMEs are written to run from the **root of the `machec-gcp` repo** (sibling to `infra/` and `bff/`) — copy them there once that repo exists, rather than running them from inside `docs/`.

<!-- --------------------------------------------------------------- -->

## Google Cloud CLI

```bash
# gcloud login
gcloud auth login

# Local Terraform runs authenticate as YOU via Application Default
# Credentials — one-time per machine, never a downloaded service-account key.
gcloud auth application-default login

# set current project id
gcloud config set project machec-prod

# get current project id
gcloud config get-value project

# current login info
gcloud config list
```

## Laravel Cloud

<https://laravel.com/cloud/docs/api/cli#browser-authentication>

```bash
# Browser authentication
cloud auth

# Token authentication
# Add a token
cloud auth:token --add

# List stored tokens
cloud auth:token --list

# Remove a token
cloud auth:token --remove
```

### Object storage — viewing the shared bucket's contents

`machec-shared-storage` (Step 1.3) is Laravel Cloud's own object-storage
product — a **Cloudflare R2** bucket, unrelated to GCP Cloud Storage. It is
provisioned but deliberately **unmounted**: no app's environment has its
credentials wired in yet, because its only planned consumer is `pim-core`'s
product-image pipeline (D28/D31), which is Post-V1 and not built. Don't
attach it to `customer-identity` (or any other app) just to browse it — none
of the four apps has code that reads/writes it, and D37's per-app isolation
means a resource should only be wired into the one app that actually owns
it. Since it's genuinely empty today, there's nothing an app-level mount
would show you anyway.

To inspect it directly instead, R2 is S3-compatible — point any S3 client at
it using the bucket's own access key (Step 1.3's `bucket:create
--key-name=machec-shared-storage-key`), no Laravel app involved:

```bash
# Bucket id + endpoint (R2's own hostname, not a GCP URL):
cloud bucket:list --json -n | jq '.[] | select(.name == "machec-shared-storage")'

# Access key id + secret (secret is only ever shown once, at bucket-key:create
# time, or here if this CLI version's --json output includes it — never paste
# it into a committed file or chat log):
cloud bucket-key:list <bucket-id> --json -n
```

Then, with any S3-compatible client:

```bash
aws s3 ls s3://machec-shared-storage \
  --endpoint-url=<endpoint from bucket:list above> \
  --profile machec-r2   # a throwaway AWS CLI profile holding the R2 access key/secret above
```

(Or a GUI client — Cyberduck, Transmit, `rclone` — configured as a generic
S3 endpoint with the same three values: endpoint, access key id, secret
access key.)

## Terraform CLI (init and daily commands)

**Recommended:** use the wrapper script **`./tf.sh`** from the `machec-gcp` repo root.

```bash
./tf.sh init                      # init backend, load remote state
./tf.sh plan                      # plan + open color-coded HTML viewer
./tf.sh plan-view                 # explicit alias for plan + viewer
./tf.sh apply                     # init + apply (confirm prompt)
./tf.sh apply -auto-approve       # non-interactive (CI)
./tf.sh destroy                   # init + destroy
./tf.sh validate                  # schema check (no creds needed)
./tf.sh state list                # any terraform command passes through
```

Or run Terraform directly from `infra/` if you prefer:

```bash
cd infra

# One-time per machine — this IS the only local auth step. There is no
# service-account key to fetch or export; unlike an older project's version
# of this tooling, GOOGLE_APPLICATION_CREDENTIALS is never set by hand or
# by script for local Terraform runs.
gcloud auth application-default login

terraform init                            # first time / after backend changes
terraform init -reconfigure               # force re-init after backend edits
terraform validate                        # schema check, no remote needed
terraform plan                            # reads remote state, dry-run of changes
terraform apply                           # apply + confirm
terraform apply -auto-approve             # CI / non-interactive
terraform destroy                         # tear down everything

terraform state list                      # resources tracked in GCS state
terraform state show <address>            # details of one resource
terraform output                          # outputs (e.g. bff service URL)
```

### Why no service-account key for Terraform itself

The **only** service-account key this project ever creates
(`laravel_cloud_gcp_bridge`, D4/D9) exists so the four Laravel Cloud apps
can call GCP — it is written straight into the private
`machec-gcp-credentials-prod` bucket by Terraform and handed to Laravel
Cloud by `infra/scripts/handoff-gcp-credentials.sh`. It is never used to
authenticate a local `terraform`/`tf.sh` command, and the file never touches
your machine — reusing it here would blur the least-privilege split Step 1.2
sets up between `terraform_ci`, `laravel_cloud_gcp_bridge`, and (D84) the
BFF's own `bff_runtime` identity. See `specs-final.md` D4/D9/D84.

### Secrets — two stores, not one

This project deliberately has **two** separate secret stores, matched to
two different hosting platforms (specs-final.md D84):

| Store | Reachable by | Holds (v1) |
| --- | --- | --- |
| Laravel Cloud Secrets Manager (organization-level, one vault, linked per environment) | The four Laravel Cloud apps only | `GCP_SERVICE_ACCOUNT_JSON` — linked to `commercial-core`'s `production` environment only (the sole v1 app with an outbound GCP call, its Pub/Sub publish) |
| GCP Secret Manager (this project, `machec-prod`) | GCP-native compute only (the BFF on Cloud Run) | The `catalog:read` Sanctum token (D41) the BFF's `lib/pimClient.ts` uses to call PIM Core's read API |

Neither can substitute for the other — a Laravel Cloud app can't reach GCP
Secret Manager without re-solving the exact cross-cloud credential problem
D4 exists for, and the BFF has no Laravel Cloud presence to receive a
Laravel Cloud secret.

**GCP Secret Manager (BFF's `catalog:read` token) — bootstrap vs. rotate:**

```bash
# Terraform (Step 1.6) creates only the empty secret CONTAINER. The first
# real value is set once PIM Core (Domain 3) has actually minted a
# catalog:read Sanctum token to put in it:
./tf.sh secret set catalog-read-token <token-value>

# List which secrets exist (just the names):
./tf.sh secret list

# Verify the active version (redacted — only shows a prefix):
./tf.sh secret show catalog-read-token

# Rotate later: add a new version; Cloud Run picks it up on next deploy.
./tf.sh secret set catalog-read-token <new-token-value>
```

**Laravel Cloud Secrets Manager (`GCP_SERVICE_ACCOUNT_JSON`) — handled by
`infra/scripts/handoff-gcp-credentials.sh` (Step 1.4), not by `tf.sh`.** It
downloads the key Terraform already wrote into `machec-gcp-credentials-prod`
and pipes it straight into `cloud secret:create --name=... --json -n`
(STDIN takes priority over any `--value=` flag — confirmed against
`laravel/cloud-cli`'s own `SecretCreate.php`), then
`cloud environment-secret:attach {environment} {secretId} -n` — one
environment identifier plus one or more secret IDs, confirmed against that
project's `EnvironmentSecretAttach.php` (the command is hyphenated,
`environment-secret:attach`, not the colon-namespaced
`environment:secret:attach` form that circulates in some AI-generated
answers — it doesn't match the shipped command). Plaintext never touches a
shell variable or disk. Re-run the script any time to rotate the key.

**Security rules:** never commit a secret value, never print one in full —
`./tf.sh secret show` prints only a prefix. Use the GCP Console / `cloud`
dashboard for manual rotation as an alternative.

### Remote state (GCS backend)

- State is stored in the GCS bucket **`machec-prod-terraform-state`** under prefix `terraform/state`.
- **The bucket must already exist** before `terraform init` — Terraform does not create it (chicken-and-egg: it can't manage the bucket holding its own state). Create it once with:

  ```bash
  gcloud storage buckets create gs://machec-prod-terraform-state \
    --project=machec-prod \
    --location=europe-west4 \
    --uniform-bucket-level-access
  ```

- **Encryption:** GCS encrypts all objects at rest by default with Google-managed keys.
- **Multi-user:** because state lives in the bucket, anyone with bucket access can `terraform init` and deploy to the same target — the GCS backend auto-locks state, so a concurrent `apply` waits rather than corrupting state (`-lock-timeout=5m` to fail fast instead of hanging).
- **Access control:** restrict who can read/write the bucket (`roles/storage.objectAdmin`) so state — which contains resource metadata, and for `google_service_account_key` resources, the key material itself — is only visible to the team. This is the one known trade-off of letting Terraform manage a service-account key at all (see D4/D9's `Verify` note); mitigated by the bucket's own restricted IAM, same as `machec-gcp-credentials-prod`.

<!-- --------------------------------------------------------------- -->

## Deploy & Release (build → push → apply)

Build the BFF's container image, push it to Artifact Registry, and roll it
to Cloud Run via **`deploy.sh`**. Terraform is the sole deployment
controller for the BFF — no `gcloud run deploy` sidesteps. (The four Laravel
apps are entirely out of scope for this script — they deploy via the
`cloud` CLI from their own repos.)

Each release is pinned to the **current git short SHA**, written to the
committed `infra/terraform.tfvars`, so a fresh tag makes `apply` genuinely
redeploy (no silent `:latest` no-op).

```bash
# Build the image locally (no push)
./deploy.sh build

# Build + push, pin the tag in infra/terraform.tfvars
./deploy.sh push

# Build + push, then run a terraform plan (dry-run of the rollout)
./deploy.sh plan

# Build + push, then apply (interactive confirm)
./deploy.sh apply

# Fast local loop — fix + verify (lint:fix + prettier, then typecheck/lint/knip/test), no build
./deploy.sh fix

# Verify only (typecheck/lint/knip/test), no build, no fixes
./deploy.sh check
```

> **Quality gate before every build:** `deploy.sh` runs, for `bff/`,
> `typecheck → lint → knip → test → build` (D44 — strict TypeScript, no
> `any`). **`knip`** is the dead-code gate — it catches unused
> exports/files/dependencies that `tsc`/ESLint can't see.

### Bootstrap ordering — from a genuinely empty project (D84)

`google_cloud_run_v2_service.bff` (`infra/cloud_run.tf`) references an image
tag that must already exist in Artifact Registry, or `apply` fails looking
for a nonexistent image. This is why `cloud_run.tf`'s resource is created in
**Domain 4 Step 4.0**, not Domain 1 — Domain 1 only provisions the
image-independent pieces (Artifact Registry repo, `bff_runtime` service
account, the empty Secret Manager container). The correct from-nothing order
is:

1. `./tf.sh apply` — Domain 1 resources only (APIs, both buckets, Artifact
   Registry repo, `bff_runtime` SA, Secret Manager container). No Cloud Run
   resource exists in the config yet at this point.
2. `./deploy.sh push` — builds and pushes a first real `bff` image, so a tag
   exists to deploy.
3. Add `cloud_run.tf` to the config (Domain 4 Step 4.0) and `./tf.sh apply`
   again — now `google_cloud_run_v2_service.bff` can resolve its image and
   gets created for the first time, already pointing at real code. No
   placeholder image is ever declared or swapped out.

After a **code change**, commit it first so the git-SHA tag bumps —
otherwise `apply` sees the same tag and is a no-op:

```bash
git add -A && git commit -m "your change"   # tag now advances
./deploy.sh plan                            # expect "1 to change"
./tf.sh apply                               # if the plan looks good
```

Health check on the running service (after apply):

```bash
curl -s https://<bff-service-url>/api/health   # once that route exists
```
