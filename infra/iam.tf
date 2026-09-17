# Both accounts are created bare here — no project-level role is granted
# in this step. Neither has a v1 use yet: terraform_ci is provisioned for a
# future CI/CD pipeline (not built in v1 — local runs authenticate via ADC,
# D4/D9's scope note); laravel_cloud_gcp_bridge's only v1 use is
# commercial-core's Pub/Sub publish, and that role (roles/pubsub.publisher)
# is granted scoped to the order-placed-events topic only, once that topic
# exists (Step 7.1) — the same per-resource, point-of-use IAM pattern
# Step 1.5 uses for bff_runtime, not a blanket project role now.

resource "google_service_account" "terraform_ci" {
  account_id   = "terraform-ci"
  display_name = "Terraform CI"
  description  = "Least-privilege identity reserved for a future CI/CD pipeline running Terraform against machec-prod. Not used by local terraform/tf.sh runs (those authenticate via ADC)."

  depends_on = [google_project_service.required["iam.googleapis.com"]]
}

resource "google_service_account" "laravel_cloud_gcp_bridge" {
  account_id   = "laravel-cloud-gcp-bridge"
  display_name = "Laravel Cloud GCP Bridge"
  description  = "Identity the four Laravel Cloud apps authenticate to GCP as (D4). Its key is handed to Laravel Cloud by scripts/handoff-gcp-credentials.sh (Step 1.4), attached only to commercial-core's production environment."

  depends_on = [google_project_service.required["iam.googleapis.com"]]
}

resource "google_service_account_key" "laravel_cloud_gcp_bridge" {
  service_account_id = google_service_account.laravel_cloud_gcp_bridge.name
}

# A third, distinct identity from terraform_ci and laravel_cloud_gcp_bridge
# above: attached directly to the BFF's future Cloud Run service (Domain 4
# Step 4.0) and authenticating via Cloud Run's built-in Workload Identity —
# never a JSON key. D4's reason for a static key ("Laravel Cloud doesn't run
# inside GCP") doesn't apply here, since Cloud Run is GCP (D84).

resource "google_service_account" "bff_runtime" {
  account_id   = "bff-runtime"
  display_name = "BFF Runtime"
  description  = "Keyless, Workload-Identity-only identity the BFF's Cloud Run service runs as (D84). Never issued a JSON key."

  depends_on = [google_project_service.required["iam.googleapis.com"]]
}

resource "google_project_iam_member" "bff_runtime_firestore" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.bff_runtime.email}"
}

resource "google_project_iam_member" "bff_runtime_artifact_registry" {
  project = var.project_id
  role    = "roles/artifactregistry.reader"
  member  = "serviceAccount:${google_service_account.bff_runtime.email}"
}
