# The one image repo the BFF's Cloud Run deploys push to (D84).
# machec-gcp/bff Is the only container-shaped deployable in v1. 
# The google_cloud_run_v2_service.bff
# resource itself waits for Domain 4 Step 4.0, once a real image exists to
# push here first (D84's bootstrap ordering).

resource "google_artifact_registry_repository" "bff" {
  repository_id = "bff"
  project       = var.project_id
  location      = var.region
  format        = "DOCKER"
  description   = "Container images for machec-gcp/bff's Cloud Run deploys."

  depends_on = [google_project_service.required["artifactregistry.googleapis.com"]]
}
