import { createHash } from "node:crypto";
import type { Firestore, Timestamp } from "@google-cloud/firestore";
import { getFirestoreClient } from "@/lib/firestoreClient";
import type {
  CategoryListResponse,
  CatalogFilters,
  Product,
  ProductListResponse,
} from "@/types/catalog";
import { getCategories, getProduct, getProducts } from "@/lib/pimClient";

const CACHE_TTL_SECONDS = 60;

interface CachedDocument<T> {
  payload: T;
  expiresAt: Timestamp;
}

interface CatalogCacheDependencies {
  firestore: Firestore;
  pim: {
    getCategories: () => Promise<CategoryListResponse>;
    getProduct: (sku: string) => Promise<Product | null>;
    getProducts: (filters: CatalogFilters) => Promise<ProductListResponse>;
  };
  ttlSeconds?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isLiveTimestamp(value: unknown): value is Timestamp {
  return isRecord(value) && typeof value.toMillis === "function";
}

function isFreshDocument<T>(value: unknown): value is CachedDocument<T> {
  return (
    isRecord(value) &&
    "payload" in value &&
    isLiveTimestamp(value.expiresAt) &&
    value.expiresAt.toMillis() > Date.now()
  );
}

function listingCacheId(filters: CatalogFilters): string {
  const signature = Object.entries(filters)
    .filter(([, value]) => value !== undefined && value !== "")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join("&");

  return createHash("sha256").update(signature).digest("hex");
}

async function cached<T>(
  firestore: Firestore,
  collection: string,
  document: string,
  fetchLive: () => Promise<T>,
  ttlSeconds: number,
): Promise<T> {
  const reference = firestore.collection(collection).doc(document);
  const snapshot = await reference.get();
  const cachedValue: unknown = snapshot.exists ? snapshot.data() : undefined;

  if (isFreshDocument<T>(cachedValue)) {
    return cachedValue.payload;
  }

  const payload = await fetchLive();
  await reference.set({
    payload,
    expiresAt: new Date(Date.now() + ttlSeconds * 1000),
  });

  return payload;
}

function createCatalogCache(
  dependencies: CatalogCacheDependencies = {
    firestore: getFirestoreClient(),
    pim: { getCategories, getProduct, getProducts },
    ttlSeconds: CACHE_TTL_SECONDS,
  },
) {
  const ttlSeconds = dependencies.ttlSeconds ?? CACHE_TTL_SECONDS;

  return {
    getCategories: () =>
      cached(
        dependencies.firestore,
        "catalog_cache",
        "categories",
        dependencies.pim.getCategories,
        ttlSeconds,
      ),
    getProduct: (sku: string) =>
      cached(
        dependencies.firestore,
        "products_read_model",
        // Firestore document IDs reject "/" (and a few other characters) — a SKU
        // isn't guaranteed to avoid them, so it's hashed the same way a listing
        // query signature already is, rather than used as a raw doc ID.
        createHash("sha256").update(sku).digest("hex"),
        () => dependencies.pim.getProduct(sku),
        ttlSeconds,
      ),
    getProducts: (filters: CatalogFilters = {}) =>
      cached(
        dependencies.firestore,
        "catalog_listing_cache",
        listingCacheId(filters),
        () => dependencies.pim.getProducts(filters),
        ttlSeconds,
      ),
  };
}

export const catalogCache = createCatalogCache();
