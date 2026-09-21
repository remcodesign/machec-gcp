export type ProductStatus = "draft" | "published" | "archived";

export interface Product {
  sku: string;
  name: string;
  brand: string;
  price_cents: number;
  category_slug: string;
  status: ProductStatus;
  attributes: Record<string, string>;
  stock?: number;
}

export interface Category {
  slug: string;
  name: string;
  description?: string;
  filterable_attributes: string[];
}

export interface PaginationMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
}

export interface ProductListResponse {
  data: Product[];
  meta: PaginationMeta;
}

export interface CategoryListResponse {
  data: Category[];
  meta: PaginationMeta;
}

export type CatalogSort = "name_asc" | "name_desc" | "price_asc" | "price_desc";

export interface CatalogFilters {
  category?: string;
  brand?: string;
  price_min?: string;
  price_max?: string;
  sort?: CatalogSort;
  page?: number;
  [key: string]: string | number | undefined;
}

// One entry per reachable value for a given field, computed by PIM Core
// with every *other* currently-selected filter applied (never the field's
// own selection — the same exclude-self shape ProductIndex.priceRange()
// already uses admin-side) — so the list only ever narrows as more filters
// are picked, it never has to fall back to disabling options client-side.
export interface CatalogFacets {
  brand: string[];
  // Slugs still reachable given every *other* currently-selected filter —
  // narrower than getCatalogCategories()'s full nav-tree taxonomy, which
  // stays unaffected by this (D40). FilterSidebar intersects the two:
  // render the full taxonomy's names, filtered down to slugs present here.
  category: string[];
  price_range: { min: number | null; max: number | null };
  attributes: Record<string, string[]>;
}
