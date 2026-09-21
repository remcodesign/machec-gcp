# Storefront BFF

This Next.js application is the Backend-for-Frontend for the Storefront. It is
configured for a standalone production image and uses the local Firebase
Emulator Suite during development.

## Local development

Install dependencies and start the Next.js development server:

```bash
npm install
npm run dev
```

The development scripts enable Node's system CA support so host-side Next.js
can trust the local DDEV HTTPS certificate.

The app is available at [http://localhost:3000](http://localhost:3000).

Start Firestore and Pub/Sub locally in Docker:

```bash
docker compose up --build
```

Then for the next.js server

```bash
npm run dev
```

Test E2E

```bash
npm run e2e
```

The emulator UI is available at [http://localhost:4001](http://localhost:4001) (mapped from the
container's port 4000 to sidestep local port-4000 conflicts, e.g. a stale
Docker port-proxy from a previous run). Firestore listens on port 8080 and
Pub/Sub listens on 8085. The local Firestore client uses the `machec-local`
project ID and automatically uses the emulator when the standard Google
emulator environment variables are set.

For a local shell that uses the emulator, copy `.env.local.example` to
`.env.local` and export the same variables before starting the app.

Set `PIM_CORE_URL` to the local PimCore `/api/v1` base URL and provide the
PimCore `catalog:read` token as `CATALOG_READ_TOKEN`. The token is required for
catalog reads and is never sent to the browser. Firestore continues to use the
emulator whenever `FIRESTORE_EMULATOR_HOST` is set; no application-code switch
is needed.

## Verification

Run the BFF checks from this directory:

```bash
npm run lint
npm run typecheck
npm run knip
npm test
npm run build
```

## Container image

The production image uses Next.js standalone output and listens on port 8080:

```bash
docker build -t bff:local .
docker run --rm -p 8080:8080 bff:local
```

Terraform expects the image at:

```text
europe-west4-docker.pkg.dev/machec-prod/bff/bff:<image-tag>
```

Set `infra.image_tag` to the tag pushed to Artifact Registry before running the
Cloud Run plan or apply. Terraform creates the `bff` Cloud Run service, injects
the catalog read secret, and grants public invocation for the initial
storefront endpoint.
