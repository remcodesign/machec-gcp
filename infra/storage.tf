# Private, versioned GCS bucket holding the laravel_cloud_gcp_bridge
# service-account key. Terraform writes the key here; it is never typed by
# hand or committed to git — scripts/handoff-gcp-credentials.sh (Step 1.4)
# is the only thing that ever reads this object, to hand the key to
# Laravel Cloud as a secret (D9). Distinct from the Step 1.1 Terraform
# state bucket, which Terraform does not (and cannot) manage itself.

resource "google_storage_bucket" "gcp_credentials" {
  name     = "machec-gcp-credentials-prod"
  project  = var.project_id
  location = var.region

  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false

  versioning {
    enabled = true
  }

  depends_on = [google_project_service.required["storage.googleapis.com"]]
}

resource "google_storage_bucket_object" "laravel_cloud_gcp_bridge_key" {
  name    = "laravel-cloud-gcp-bridge-key.json"
  bucket  = google_storage_bucket.gcp_credentials.name
  content = base64decode(google_service_account_key.laravel_cloud_gcp_bridge.private_key)
}
