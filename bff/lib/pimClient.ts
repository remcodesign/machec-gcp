import type {
  Category,
  CategoryListResponse,
  CatalogFacets,
  CatalogFilters,
  PaginationMeta,
  Product,
  ProductListResponse,
  ProductStatus,
} from "@/types/catalog";

const REQUEST_TIMEOUT_MS = 3000;
const DEFAULT_PAGE_SIZE = 6;

let readyLogged = false;

class PimClientError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "PimClientError";
  }
}

function getBaseUrl(): string {
  const baseUrl = process.env.PIM_CORE_URL ?? process.env.PIM_API_BASE_URL;

  if (!baseUrl) {
    throw new PimClientError(
      "PIM_CORE_URL or PIM_API_BASE_URL must be configured for catalog reads.",
    );
  }

  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

function getToken(): string {
  const token = process.env.CATALOG_READ_TOKEN?.trim();

  if (!token) {
    throw new PimClientError(
      "CATALOG_READ_TOKEN is missing; configure the catalog:read secret before serving catalog pages.",
    );
  }

  return token;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new PimClientError(`PIM response field ${field} is invalid.`);
  }

  return value;
}

function numberValue(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new PimClientError(`PIM response field ${field} is invalid.`);
  }

  return value;
}

function statusValue(value: unknown): ProductStatus {
  if (value === "draft" || value === "published" || value === "archived") {
    return value;
  }

  throw new PimClientError("PIM response field status is invalid.");
}

function stringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    throw new PimClientError("PIM response field attributes is invalid.");
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      stringValue(entry, `attributes.${key}`),
    ]),
  );
}

function productValue(value: unknown): Product {
  if (!isRecord(value)) {
    throw new PimClientError("PIM returned an invalid product.");
  }

  const product: Product = {
    sku: stringValue(value.sku, "sku"),
    name: stringValue(value.name, "name"),
    brand: stringValue(value.brand, "brand"),
    price_cents: numberValue(value.price_cents, "price_cents"),
    category_slug: stringValue(value.category_slug, "category_slug"),
    status: statusValue(value.status),
    attributes: stringRecord(value.attributes),
  };

  if (value.stock !== undefined) {
    product.stock = numberValue(value.stock, "stock");
  }

  return product;
}

function categoryValue(value: unknown): Category {
  if (!isRecord(value)) {
    throw new PimClientError("PIM returned an invalid category.");
  }

  if (
    !Array.isArray(value.filterable_attributes) ||
    !value.filterable_attributes.every((entry) => typeof entry === "string")
  ) {
    throw new PimClientError(
      "PIM response field filterable_attributes is invalid.",
    );
  }

  const category: Category = {
    slug: stringValue(value.slug, "slug"),
    name: stringValue(value.name, "name"),
    filterable_attributes: value.filterable_attributes,
  };

  if (value.description !== undefined) {
    category.description = stringValue(value.description, "description");
  }

  return category;
}

function stringArray(value: unknown, field: string): string[] {
  if (
    !Array.isArray(value) ||
    !value.every((entry) => typeof entry === "string")
  ) {
    throw new PimClientError(`PIM response field ${field} is invalid.`);
  }

  return value;
}

function nullableNumber(value: unknown, field: string): number | null {
  if (value === null) return null;

  return numberValue(value, field);
}

function facetsValue(value: unknown): CatalogFacets {
  if (
    !isRecord(value) ||
    !isRecord(value.price_range) ||
    !isRecord(value.attributes)
  ) {
    throw new PimClientError("PIM returned an invalid facets response.");
  }

  return {
    brand: stringArray(value.brand, "brand"),
    category: stringArray(value.category, "category"),
    price_range: {
      min: nullableNumber(value.price_range.min, "price_range.min"),
      max: nullableNumber(value.price_range.max, "price_range.max"),
    },
    attributes: Object.fromEntries(
      Object.entries(value.attributes).map(([key, entry]) => [
        key,
        stringArray(entry, `attributes.${key}`),
      ]),
    ),
  };
}

function paginationMeta(value: unknown, count: number): PaginationMeta {
  if (!isRecord(value)) {
    return {
      current_page: 1,
      last_page: count > 0 ? 1 : 0,
      per_page: DEFAULT_PAGE_SIZE,
      total: count,
      from: count > 0 ? 1 : null,
      to: count > 0 ? count : null,
    };
  }

  const currentPage =
    typeof value.current_page === "number" ? value.current_page : 1;
  const lastPage =
    typeof value.last_page === "number" ? value.last_page : currentPage;
  const perPage =
    typeof value.per_page === "number" ? value.per_page : DEFAULT_PAGE_SIZE;
  const total = typeof value.total === "number" ? value.total : count;

  return {
    current_page: currentPage,
    last_page: lastPage,
    per_page: perPage,
    total,
    from: typeof value.from === "number" ? value.from : count > 0 ? 1 : null,
    to: typeof value.to === "number" ? value.to : count > 0 ? count : null,
  };
}

function listPayload(value: unknown): { data: unknown[]; meta: unknown } {
  if (Array.isArray(value)) {
    return { data: value, meta: undefined };
  }

  if (!isRecord(value) || !Array.isArray(value.data)) {
    throw new PimClientError("PIM returned an invalid list response.");
  }

  // Laravel's LengthAwarePaginator serializes current_page/last_page/per_page/
  // total/from/to as siblings of "data" at the top level, not nested under a
  // "meta" key — there is no JSON:API-style wrapper here, so build meta from
  // whatever else is on the response instead of a "meta" property that never
  // actually exists on PIM Core's paginated responses.
  const { data, ...meta } = value;

  return { data: data as unknown[], meta };
}

function productList(value: unknown): ProductListResponse {
  const payload = listPayload(value);
  const data = payload.data
    .map(productValue)
    .filter((product) => product.status === "published");

  return { data, meta: paginationMeta(payload.meta, data.length) };
}

function categoryList(value: unknown): CategoryListResponse {
  const payload = listPayload(value);
  const data = payload.data.map(categoryValue);

  return { data, meta: paginationMeta(payload.meta, data.length) };
}

async function request(
  path: string,
  query?: URLSearchParams,
): Promise<unknown> {
  const url = new URL(path, getBaseUrl());

  if (query) {
    url.search = query.toString();
  }

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new PimClientError(
        `PIM catalog request failed with HTTP ${response.status}.`,
        response.status,
      );
    }

    const payload: unknown = await response.json();

    if (!readyLogged) {
      console.info("PIM catalog read client is ready.");
      readyLogged = true;
    }

    return payload;
  } catch (error: unknown) {
    const clientError =
      error instanceof PimClientError
        ? error
        : new PimClientError(
            error instanceof Error
              ? error.message
              : "PIM catalog request failed.",
          );
    console.error(clientError.message);
    throw clientError;
  }
}

function filtersQuery(filters: CatalogFilters): URLSearchParams {
  const query = new URLSearchParams();
  const entries = Object.entries(filters)
    .filter(([, value]) => value !== undefined && value !== "")
    .sort(([left], [right]) => left.localeCompare(right));

  for (const [key, value] of entries) {
    query.set(key, String(value));
  }

  return query;
}

export async function getProducts(
  filters: CatalogFilters = {},
): Promise<ProductListResponse> {
  // status=published is forced server-side (never overridable by a caller/query-string
  // value) so PIM's own pagination meta already reflects what the storefront may show —
  // the client-side status filter in productList() above is defense-in-depth, not the
  // primary filtering mechanism.
  return productList(
    await request(
      "products",
      filtersQuery({ ...filters, status: "published" }),
    ),
  );
}

export async function getProduct(sku: string): Promise<Product | null> {
  const response = productList(
    await request("products", filtersQuery({ sku, status: "published" })),
  );

  return response.data.find((product) => product.sku === sku) ?? null;
}

export async function getCategories(): Promise<CategoryListResponse> {
  return categoryList(await request("categories"));
}

// Only category/brand/price/attribute filters are meaningful to a facets
// query — sort/page change what page of an already-resolved result set is
// shown, never which values are still reachable, so both are dropped here
// rather than forwarded as dead query params PIM Core would just ignore.
export async function getFacets(
  filters: CatalogFilters = {},
): Promise<CatalogFacets> {
  const facetFilters = Object.fromEntries(
    Object.entries(filters).filter(([key]) => key !== "sort" && key !== "page"),
  ) as CatalogFilters;

  return facetsValue(await request("facets", filtersQuery(facetFilters)));
}
