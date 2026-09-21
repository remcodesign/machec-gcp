import { describe, expect, it, vi } from "vitest";
import { createCatalogCache } from "./catalogCache";
import type {
  CategoryListResponse,
  Product,
  ProductListResponse,
} from "@/types/catalog";

class FakeTimestamp {
  constructor(private readonly millis: number) {}
  toMillis(): number {
    return this.millis;
  }
}

class FakeDocRef {
  constructor(
    private readonly store: Map<string, unknown>,
    private readonly key: string,
  ) {}

  async get() {
    const data = this.store.get(this.key);
    return {
      exists: data !== undefined,
      data: () => data,
    };
  }

  async set(value: { payload: unknown; expiresAt: Date }) {
    this.store.set(this.key, {
      payload: value.payload,
      expiresAt: new FakeTimestamp(value.expiresAt.getTime()),
    });
  }
}

function createFakeFirestore() {
  const collections = new Map<string, Map<string, unknown>>();

  return {
    collection(name: string) {
      if (!collections.has(name)) collections.set(name, new Map());
      const store = collections.get(name)!;
      return {
        doc(id: string) {
          return new FakeDocRef(store, id);
        },
      };
    },
    // test helper, not part of the real Firestore surface
    _collections: collections,
  };
}

const product: Product = {
  sku: "SKU-1",
  name: "Test Product",
  brand: "ABB",
  price_cents: 1000,
  category_slug: "groepenkast-componenten",
  status: "published",
  attributes: {},
};

const productListResponse: ProductListResponse = {
  data: [product],
  meta: {
    current_page: 1,
    last_page: 1,
    per_page: 6,
    total: 1,
    from: 1,
    to: 1,
  },
};

const categoryListResponse: CategoryListResponse = {
  data: [
    {
      slug: "groepenkast-componenten",
      name: "Groepenkasten",
      filterable_attributes: [],
    },
  ],
  meta: {
    current_page: 1,
    last_page: 1,
    per_page: 6,
    total: 1,
    from: 1,
    to: 1,
  },
};

describe("catalogCache", () => {
  it("a Firestore cache miss calls PIM Core live and writes the result through with a short TTL", async () => {
    const firestore = createFakeFirestore();
    const getProducts = vi.fn().mockResolvedValue(productListResponse);
    const cache = createCatalogCache({
      firestore: firestore as never,
      pim: {
        getCategories: vi.fn(),
        getProduct: vi.fn(),
        getProducts,
        getFacets: vi.fn(),
      },
      ttlSeconds: 60,
    });

    const result = await cache.getProducts({
      category: "groepenkast-componenten",
    });

    expect(result).toEqual(productListResponse);
    expect(getProducts).toHaveBeenCalledTimes(1);
  });

  it("a Firestore cache hit within TTL returns the cached document without calling PIM Core again", async () => {
    const firestore = createFakeFirestore();
    const getProducts = vi.fn().mockResolvedValue(productListResponse);
    const cache = createCatalogCache({
      firestore: firestore as never,
      pim: {
        getCategories: vi.fn(),
        getProduct: vi.fn(),
        getProducts,
        getFacets: vi.fn(),
      },
      ttlSeconds: 60,
    });

    await cache.getProducts({ category: "groepenkast-componenten" });
    await cache.getProducts({ category: "groepenkast-componenten" });

    expect(getProducts).toHaveBeenCalledTimes(1);
  });

  it("an expired cache entry triggers a live re-fetch instead of being returned stale", async () => {
    const firestore = createFakeFirestore();
    const getProducts = vi.fn().mockResolvedValue(productListResponse);
    const cache = createCatalogCache({
      firestore: firestore as never,
      pim: {
        getCategories: vi.fn(),
        getProduct: vi.fn(),
        getProducts,
        getFacets: vi.fn(),
      },
      ttlSeconds: -1, // already expired the instant it's written
    });

    await cache.getProducts({ category: "groepenkast-componenten" });
    await cache.getProducts({ category: "groepenkast-componenten" });

    expect(getProducts).toHaveBeenCalledTimes(2);
  });

  it("sort and page changes are cached under distinct keys, never conflated", async () => {
    const firestore = createFakeFirestore();
    const getProducts = vi.fn().mockResolvedValue(productListResponse);
    const cache = createCatalogCache({
      firestore: firestore as never,
      pim: {
        getCategories: vi.fn(),
        getProduct: vi.fn(),
        getProducts,
        getFacets: vi.fn(),
      },
      ttlSeconds: 60,
    });

    await cache.getProducts({ sort: "price_asc" });
    await cache.getProducts({ sort: "price_desc" });
    await cache.getProducts({ sort: "price_asc", page: 2 });

    expect(getProducts).toHaveBeenCalledTimes(3);
    const listingStore = firestore._collections.get("catalog_listing_cache");
    expect(listingStore?.size).toBe(3);
  });

  it("an unfiltered listing and a filtered listing are cached under distinct keys", async () => {
    const firestore = createFakeFirestore();
    const getProducts = vi.fn().mockResolvedValue(productListResponse);
    const cache = createCatalogCache({
      firestore: firestore as never,
      pim: {
        getCategories: vi.fn(),
        getProduct: vi.fn(),
        getProducts,
        getFacets: vi.fn(),
      },
      ttlSeconds: 60,
    });

    await cache.getProducts({});
    await cache.getProducts({ brand: "ABB" });

    expect(getProducts).toHaveBeenCalledTimes(2);
  });

  it("filter key order never changes the cache key (a stable, sorted signature)", async () => {
    const firestore = createFakeFirestore();
    const getProducts = vi.fn().mockResolvedValue(productListResponse);
    const cache = createCatalogCache({
      firestore: firestore as never,
      pim: {
        getCategories: vi.fn(),
        getProduct: vi.fn(),
        getProducts,
        getFacets: vi.fn(),
      },
      ttlSeconds: 60,
    });

    await cache.getProducts({
      brand: "ABB",
      category: "groepenkast-componenten",
    });
    await cache.getProducts({
      category: "groepenkast-componenten",
      brand: "ABB",
    });

    expect(getProducts).toHaveBeenCalledTimes(1);
  });

  it("the category taxonomy is cached as one singleton document, populated whole on a miss", async () => {
    const firestore = createFakeFirestore();
    const getCategories = vi.fn().mockResolvedValue(categoryListResponse);
    const cache = createCatalogCache({
      firestore: firestore as never,
      pim: {
        getCategories,
        getProduct: vi.fn(),
        getProducts: vi.fn(),
        getFacets: vi.fn(),
      },
      ttlSeconds: 60,
    });

    await cache.getCategories();
    await cache.getCategories();

    expect(getCategories).toHaveBeenCalledTimes(1);
    expect(firestore._collections.get("catalog_cache")?.has("categories")).toBe(
      true,
    );
  });

  it("a single product lookup by SKU is lazily populated one entry at a time", async () => {
    const firestore = createFakeFirestore();
    const getProduct = vi.fn().mockResolvedValue(product);
    const cache = createCatalogCache({
      firestore: firestore as never,
      pim: {
        getCategories: vi.fn(),
        getProduct,
        getProducts: vi.fn(),
        getFacets: vi.fn(),
      },
      ttlSeconds: 60,
    });

    const result = await cache.getProduct("SKU-1");
    await cache.getProduct("SKU-1");

    expect(result).toEqual(product);
    expect(getProduct).toHaveBeenCalledTimes(1);
    expect(getProduct).toHaveBeenCalledWith("SKU-1");
  });

  it("two different SKUs are cached under two different document keys", async () => {
    const firestore = createFakeFirestore();
    const getProduct = vi.fn().mockResolvedValue(product);
    const cache = createCatalogCache({
      firestore: firestore as never,
      pim: {
        getCategories: vi.fn(),
        getProduct,
        getProducts: vi.fn(),
        getFacets: vi.fn(),
      },
      ttlSeconds: 60,
    });

    await cache.getProduct("SKU-1");
    await cache.getProduct("SKU-2");

    expect(getProduct).toHaveBeenCalledTimes(2);
    expect(firestore._collections.get("products_read_model")?.size).toBe(2);
  });
});
