import { filterSchema } from "@/lib/filterSchema";
import type { CatalogFilters, CatalogSort } from "@/types/catalog";

export type PageSearchParams = Record<string, string | string[] | undefined>;

const catalogSorts: CatalogSort[] = ["name_asc", "name_desc", "price_asc", "price_desc"];

function firstValue(value: string | string[] | undefined): string | undefined {
    return Array.isArray(value) ? value[0] : value;
}

export function parseCatalogFilters(searchParams: PageSearchParams): CatalogFilters {
    const filters: CatalogFilters = {};

    const category = firstValue(searchParams.category);
    const brand = firstValue(searchParams.brand);
    const priceMin = firstValue(searchParams.price_min);
    const priceMax = firstValue(searchParams.price_max);
    const sort = firstValue(searchParams.sort);
    const page = Number.parseInt(firstValue(searchParams.page) ?? "1", 10);

    if (category) filters.category = category;
    if (brand) filters.brand = brand;
    if (priceMin) filters.price_min = priceMin;
    if (priceMax) filters.price_max = priceMax;
    if (sort && catalogSorts.includes(sort as CatalogSort)) filters.sort = sort as CatalogSort;
    if (Number.isInteger(page) && page > 1) filters.page = page;

    // Only forward category-conditional attribute filters declared in filterSchema.ts
    // (lib/filterSchema.ts's single source of truth) — never an arbitrary/stale query key,
    // and never an unrelated reserved-looking key such as `status`.
    const allowedAttributeKeys = category ? (filterSchema.category_conditional[category] ?? []) : [];

    for (const key of allowedAttributeKeys) {
        const value = firstValue(searchParams[key]);

        if (value) filters[key] = value;
    }

    return filters;
}

export function catalogHref(path: string, filters: CatalogFilters, overrides: CatalogFilters = {}): string {
    const query = new URLSearchParams();
    const values = { ...filters, ...overrides };

    for (const [key, value] of Object.entries(values)) {
        if (value !== undefined && value !== "") query.set(key, String(value));
    }

    const queryString = query.toString();
    return queryString ? `${path}?${queryString}` : path;
}