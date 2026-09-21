import { cache } from "react";
import { catalogCache } from "@/lib/catalogCache";
import type { CatalogFilters } from "@/types/catalog";

// Wrapped in React's per-request cache() since multiple components in the same render
// (SiteFooter plus the page itself) call these with identical arguments — without it,
// each call is a separate Firestore round trip for the same document.
export const getCatalogCategories = cache(() => catalogCache.getCategories());

export const getCatalogProducts = cache((filters: CatalogFilters = {}) => catalogCache.getProducts(filters));

export const getCatalogProduct = cache((sku: string) => catalogCache.getProduct(sku));