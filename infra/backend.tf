terraform {
  backend "gcs" {
    bucket = "machec-prod-terraform-state"
    prefix = "terraform/state"
  }
}
