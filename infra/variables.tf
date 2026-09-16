variable "project_id" {
  description = "GCP project ID. Fixed at machec-prod — never parameterized for portability (README-local.md core rules)."
  type        = string
}

variable "region" {
  description = "GCP region. Fixed at europe-west4 — never parameterized for portability (README-local.md core rules)."
  type        = string
  default     = "europe-west4"
}
