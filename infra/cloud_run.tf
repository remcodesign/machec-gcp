locals {
  bff_image = "${var.region}-docker.pkg.dev/${var.project_id}/bff/bff:${var.image_tag}"
}

resource "google_cloud_run_v2_service" "bff" {
  project  = var.project_id
  name     = "bff"
  location = var.region

  template {
    service_account                  = google_service_account.bff_runtime.email
    timeout                          = "300s"
    max_instance_request_concurrency = 80

    containers {
      image = local.bff_image

      ports {
        container_port = 8080
      }

      env {
        name  = "GOOGLE_CLOUD_PROJECT"
        value = var.project_id
      }

      env {
        name = "CATALOG_READ_TOKEN"

        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.catalog_read_token.secret_id
            version = "latest"
          }
        }
      }
    }
  }

  depends_on = [
    google_project_service.required["run.googleapis.com"],
    google_artifact_registry_repository.bff,
    google_project_iam_member.bff_runtime_artifact_registry,
    google_project_iam_member.bff_runtime_firestore,
    google_secret_manager_secret_iam_member.bff_runtime_accessor,
  ]
}

resource "google_cloud_run_v2_service_iam_member" "bff_public" {
  project  = google_cloud_run_v2_service.bff.project
  location = google_cloud_run_v2_service.bff.location
  name     = google_cloud_run_v2_service.bff.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

output "bff_service_url" {
  description = "Public URL of the storefront BFF Cloud Run service."
  value       = google_cloud_run_v2_service.bff.uri
}
