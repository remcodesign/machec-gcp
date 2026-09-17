# Container only, no value yet — the D41 catalog:read Sanctum token is
# minted later, once pim-core's Domain 3 build actually issues it, and set
# into this secret out of band (same "Terraform owns the container, a
# script/human owns the value" split the old openrouter-key pattern used).
# A separate vault from Laravel Cloud's own Secrets Manager (Step 1.4) on
# purpose — GCP Secret Manager is reachable only by GCP-native compute
# (the BFF), Laravel Cloud's is reachable only by Laravel Cloud apps (D84).

resource "google_secret_manager_secret" "catalog_read_token" {
  secret_id = "catalog-read-token"
  project   = var.project_id

  replication {
    auto {}
  }

  depends_on = [google_project_service.required["secretmanager.googleapis.com"]]
}

resource "google_secret_manager_secret_iam_member" "bff_runtime_accessor" {
  secret_id = google_secret_manager_secret.catalog_read_token.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.bff_runtime.email}"
}
