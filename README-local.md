# README - Local

---

Scope of this file: `machec-gcp` (the `infra/` + `bff/` repo) only — Terraform,
the BFF's Cloud Run deploy, and this folder's own tooling. The four Laravel
apps (`machec-customer-identity`, `machec-pim-core`, `machec-commercial-core`,
`machec-logistics-wms`) each have their own repo, their own `CLAUDE.md`, and
their own conventions (Pest, Pint, Larastan, `ddev`) — not covered here. See
the workspace-root `CLAUDE.md` for the multi-repo layout and when to switch
context into one of those repos instead.

---

## Pre-prompt (paste at top of every new chat working in `machec-gcp`)

---

> **VERY IMPORTANT — read and follow these instructions in order:**
>
> **VERY IMPORTANT — NEVER RUN `./tf.sh apply` and `./tf.sh destroy` YOURSELF, YOU CAN RUN `./tf.sh plan`:**
>
> **VERY IMPORTANT — Do not use `gcloud` for deployment or IAM/role changes — only Terraform (GCP) and the `cloud` CLI (Laravel Cloud, D7) for anything that changes infrastructure, and GIT for code:**
>
> **VERY IMPORTANT — Do not use GIT commit and push yourself — only use GIT for checking state and history:**
>
> **VERY IMPORTANT — `machec-gcp/bff` is `100% strict TypeScript` (D44) — `.ts`/`.tsx` files, no `any` anywhere, Tailwind CSS v4 utility-first for all styling (scoped CSS only where Tailwind genuinely can't express something)**
>
> **VERY IMPORTANT — this project has TWO secret stores, never conflate them (D84): GCP Secret Manager is for the BFF (Cloud Run) only; Laravel Cloud's own Secrets Manager is for the four Laravel apps only. Neither substitutes for the other.**

### 1.1 Read Project

Instructions

```txt
../../CLAUDE.md                       # workspace root — multi-repo layout, context-switching rule
```

Specs (source of truth for every decision referenced below)

```txt
../specs-final.md                     # Decision Ledger (D1–D85), Domain Journeys, contract cards
../specs-overview.md                  # concepts → DB → modules companion reading aid
```

### 1.2 Extra documentation

Use `context7` for current library docs (Terraform `google` provider
resource shapes, Next.js `output: 'standalone'`/Docker, Laravel Cloud CLI
syntax) rather than relying on training-data memory — this stack moves fast
enough that a remembered flag/resource name can already be stale.

### 2. Follow the locked decisions

These are locked — do not revisit without explicit approval. Full reasoning
lives in `specs-final.md`'s Decision Ledger; this is the short version for
anything touching `machec-gcp`:

- **Four separate Laravel Cloud apps**, not a modular monolith (D11) — this
  tooling never builds/deploys them; they deploy via `cloud`.
- **GCP is fully Terraform-owned** — every project API, IAM binding,
  Firestore/Pub/Sub/BigQuery/Storage resource, and (D84) the BFF's own
  Cloud Run service, Artifact Registry repo, and Secret Manager secret live
  in `infra/`. No manual GCP Console mutation outside the one-time state
  bucket bootstrap and `gcloud auth` (D7, §1 of `specs-final.md`).
- **Laravel Cloud is CLI-provisioned, never Terraformed** (D7) — this
  account has no Terraform-grade Laravel Cloud API access.
- **No service-account key for local Terraform runs** — ADC only
  (`gcloud auth application-default login`). The one SA key this project
  creates (`laravel_cloud_gcp_bridge`, D4/D9) is Laravel-Cloud-runtime-only,
  never used to run `terraform`/`tf.sh` locally.
- **The BFF's Cloud Run service is created once, in Domain 4 Step 4.0, never
  Domain 1** (D84) — Domain 1 only provisions the image-independent pieces.
  Don't "simplify" this by moving the resource back to Domain 1; that
  reintroduces the placeholder-image problem it was split out to avoid.
- **Firestore native TTL is a storage-hygiene backstop only, never the
  cache-hit/miss source of truth** (D85), and it applies to the D40 catalog
  cache-aside collections only — never to `carts/{cart_id}` (carts have no
  TTL, by design).
- **No embeddings provider is wired up in v1** — `pim_products.embedding`
  stays an unused/`null` pgvector column. Don't add an OpenRouter/OpenAI/etc.
  client anywhere in `machec-gcp` on the assumption it's needed.
- **`machec-prod` / `europe-west4`** are the real, fixed project ID and
  region — not placeholders, don't parameterize them away "for
  flexibility" unless explicitly asked.

### 3. Follow existing code style

Before creating or editing a file, check **sibling files** for current
patterns — a new `.tf` file should match how `Step 1.5`/`Step 1.6`'s
resources are already named and grouped (`specs-final.md` Domain 1), a new
BFF component should match `components/catalog/`'s existing shape
(`specs-overview.md`'s file tree).

### 4. Core rules

- **No overengineering** — keep it clean, simple, and consistent with the
  spec. If a step in `specs-final.md` doesn't call for it, don't build it
  "while we're here."
- **No new dependencies** without explicit approval.
- **Every step in the spec has happy + non-happy tests** — implement both
  when implementing the step (see each Domain Journey step's `Tests:`
  entries).
- **Never log** secret values, tokens, or GCP credential material — log
  which secret/resource was touched, never its content.
- **The Cloud Run bootstrap order matters** (README.md's "Bootstrap
  ordering" section, D84) — `./deploy.sh push` always runs before the first
  `./tf.sh apply` that touches `cloud_run.tf`. Don't reorder this to "apply
  first, build after" even if it seems more natural.

### 5. After completing the job

Run these in order and fix any errors:

```bash
# Fast local loop — fix + verify bff (lint:fix + prettier, then
# typecheck/lint/knip/test), no Docker build:
./deploy.sh fix

# Or verify only (no fixes, no build):
./deploy.sh check

# Infra (when touching infra/):
./tf.sh validate
./tf.sh plan          # review the HTML report before ever asking for apply
```

### 6. Tests

- Update tests when the codebase changes — but first verify the code change
  is correct.
- No need for backward compatibility for most changes (v1, single-user POC,
  unless the spec says otherwise).
- Run affected tests to confirm they pass; if not, fix the errors.

### 7. AI CODING AGENT OPERATIONS & CODEBASE UNDERSTANDING RULES

#### 0. Read > Plan > Patch > Verify > Review (add tests?)

#### 1. Graph-Based Codebase Navigation

- Don't treat `infra/` or `bff/` as flat text. Trace how a Terraform
  resource's `depends_on`/references or a BFF module's imports actually
  connect before proposing a structural change.
- When a resource's ordering is unclear (e.g. why `cloud_run.tf` lives in
  Domain 4 and not Domain 1), check the Decision Ledger (D84) before
  guessing — the reasoning is written down, not implicit.

#### 2. Dynamic Structural Scanning

- Before modifying or generating code, partition analysis into meaningful
  chunks (one `.tf` resource, one component, one route handler) instead of
  reading random blocks.
- Map the explicit boundaries this design already draws (D37's per-app
  isolation, D17's no-cross-app-model rule) to avoid a change that quietly
  crosses one.

#### 3. Strict Context Optimization (Node-First Retrieval)

- Fetch and analyze files iteratively and targeted ("just-in-time"),
  focusing on the specific step/decision relevant to the current task rather
  than re-reading the whole spec every time.

#### 4. Multi-Step Execution Planning

- Formulate a declarative, multi-step plan (identifying dependencies,
  required Terraform ordering, external tools) before writing a line of
  code — especially for anything touching `infra/`, where ordering mistakes
  (D84's bootstrap sequence) are expensive to unwind.

#### 5. Reflection & Test-Driven Verification

- For every change, run `./deploy.sh check` (BFF) or `./tf.sh validate`
  (infra) and self-correct on failure before calling the task done.

---

> **The job to be done:**
