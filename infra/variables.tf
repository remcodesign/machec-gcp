variable "project_id" {
  description = "GCP project ID. Fixed at machec-prod — never parameterized for portability (README-local.md core rules)."
  type        = string
}

variable "region" {
  description = "GCP region. Fixed at europe-west4 — never parameterized for portability (README-local.md core rules)."
  type        = string
  default     = "europe-west4"
}

variable "image_tag" {
  description = "Git-short-SHA tag for the BFF image already pushed to Artifact Registry before Cloud Run apply."
  type        = string

  validation {
    condition     = can(regex("^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$", var.image_tag))
    error_message = "image_tag must be a valid Artifact Registry tag."
  }
}

variable "pim_core_url" {
  description = "Production PIM Core read-API base URL, injected into the BFF Cloud Run service as PIM_CORE_URL. Never sourced from bff/.env.local — that file is local-dev-only (D83/D84); this is the deployed-environment equivalent, owned by Terraform."
  type        = string
  default     = "https://machec-pim-core-production-urlcxp.laravel.cloud/api/v1"
}

variable "customer_identity_url" {
  description = "Production Customer & Identity base URL (no path suffix — authProxy.ts appends /api/v1/auth/*, /api/internal/v1/whoami, and /sanctum/csrf-cookie itself), injected into the BFF Cloud Run service as CUSTOMER_IDENTITY_URL. Never sourced from bff/.env.local — that file is local-dev-only (D83/D84); this is the deployed-environment equivalent, owned by Terraform (D115, Step 4.2)."
  type        = string
  default     = "https://machec-customer-identity-production-pi9kvt.laravel.cloud"
}

variable "identity_session_cookie" {
  description = "Customer & Identity's actual session cookie name in production, injected into the BFF Cloud Run service as IDENTITY_SESSION_COOKIE (D115's relay reads this cookie out of Identity's Set-Cookie response). Laravel's config/session.php derives it as Str::slug(APP_NAME).'-session' — production APP_NAME is not 'Laravel' (local ddev's value, which authProxy.ts's own hardcoded fallback assumes), so it resolves to 'machec-customer-identity-session' instead, and must be set explicitly here rather than relying on that fallback."
  type        = string
  default     = "machec-customer-identity-session"
}
