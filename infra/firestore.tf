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

# D85: Firestore native TTL is a storage-hygiene backstop only, never the
# cache-hit/miss source of truth — that's bff/lib/catalogCache.ts's own
# `expiresAt` freshness check (a 60s window, isFreshDocument()). This reuses
# the same field but adds a much longer offset, so physical deletion only
# ever catches entries nobody has re-fetched in a week (an abandoned SKU, a
# one-off filter combination) — never a hot key mid-cycle between its own
# 60s expiries. Scoped to the D40 catalog cache-aside collections only —
# never `carts/{cart_id}`, which has no TTL by design (D85).
locals {
  catalog_cache_ttl_collections = [
    "catalog_cache",         # category taxonomy singleton
    "catalog_listing_cache", # per filter/sort/page query signature
    "catalog_facets_cache",  # per filter-combination reachable facet values (D40 extension)
    "products_read_model",   # per-SKU product lookup
  ]
}

resource "google_firestore_field" "catalog_cache_ttl" {
  for_each = toset(local.catalog_cache_ttl_collections)

  project    = var.project_id
  database   = google_firestore_database.database.name
  collection = each.value
  field      = "expiresAt"

  ttl_config {
    expiration_offset = "604800s" # 7 days past the app's own 60s freshness expiry
  }
}
