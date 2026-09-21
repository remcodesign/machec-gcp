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

export interface FilterSchema {
    global: string[];
    category_conditional: Record<string, string[]>;
}