# Enabling firestore.googleapis.com (apis.tf) does not provision a database —
# GCP requires the database itself to be created explicitly, once, before any
# client (bff_runtime's Firestore SDK calls, D40/D83) can read or write to it.
# Missing this resource surfaces as a gRPC "5 NOT_FOUND" from every Firestore
# call, not as a missing-document result.

resource "google_firestore_database" "database" {
  project     = var.project_id
  name        = "(default)"
  location_id = var.region
  type        = "FIRESTORE_NATIVE"

  delete_protection_state = "DELETE_PROTECTION_ENABLED"
  deletion_policy         = "ABANDON"

  depends_on = [google_project_service.required["firestore.googleapis.com"]]
}
