import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getCategories, getProduct, getProducts } = await import("./pimClient");

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const validProduct = {
  sku: "SKU-1",
  name: "Groepenkast 8-groeps",
  brand: "ABB",
  price_cents: 12999,
  category_slug: "groepenkast-componenten",
  status: "published",
  attributes: { amperage: "16A" },
};

describe("pimClient", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env.PIM_CORE_URL = "https://pim.test/api/v1";
    process.env.CATALOG_READ_TOKEN = "test-token";
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PIM_CORE_URL;
    delete process.env.CATALOG_READ_TOKEN;
  });

  it("getProducts sends the Bearer token and forces status=published regardless of caller input", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ data: [validProduct], meta: { total: 1 } }),
    );

    await getProducts({ status: "draft" } as never);

    const [url, init] = fetchMock.mock.calls[0];
    expect(new Headers(init.headers).get("Authorization")).toBe(
      "Bearer test-token",
    );
    expect(new URL(url as string).searchParams.get("status")).toBe("published");
  });

  it("a product with status draft never appears in the parsed listing, even if PIM includes it", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: [
          validProduct,
          { ...validProduct, sku: "SKU-2", status: "draft" },
        ],
        meta: { total: 2 },
      }),
    );

    const result = await getProducts();

    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.sku).toBe("SKU-1");
  });

  it("getProduct matches the exact SKU, never a substring/prefix match", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: [validProduct, { ...validProduct, sku: "SKU-10" }],
        meta: { total: 2 },
      }),
    );

    const result = await getProduct("SKU-1");

    expect(result?.sku).toBe("SKU-1");
  });

  it("getProduct returns null, not a crash, when no product matches", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ data: [], meta: { total: 0 } }),
    );

    const result = await getProduct("MISSING-SKU");

    expect(result).toBeNull();
  });

  it("an HTTP error from PIM throws a client error carrying the status instead of returning a broken payload", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: "nope" }, 500));

    await expect(getProducts()).rejects.toThrow(/HTTP 500/);
  });

  it("a malformed product (missing a required field) throws instead of silently rendering broken data", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ data: [{ sku: "SKU-1" }], meta: { total: 1 } }),
    );

    await expect(getProducts()).rejects.toThrow(/invalid/i);
  });

  it("getCategories parses filterable_attributes as a string array and rejects a malformed one", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: [
          {
            slug: "groepenkast-componenten",
            name: "Groepenkasten",
            filterable_attributes: ["component_type", "amperage"],
          },
        ],
        meta: { total: 1 },
      }),
    );

    const result = await getCategories();
    expect(result.data[0]?.filterable_attributes).toEqual([
      "component_type",
      "amperage",
    ]);

    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: [{ slug: "x", name: "X", filterable_attributes: "not-an-array" }],
        meta: { total: 1 },
      }),
    );
    await expect(getCategories()).rejects.toThrow(/filterable_attributes/);
  });

  it("throws immediately, with an explicit message, when CATALOG_READ_TOKEN is missing", async () => {
    delete process.env.CATALOG_READ_TOKEN;

    await expect(getProducts()).rejects.toThrow(/CATALOG_READ_TOKEN/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a network failure surfaces as a PimClientError, not an unhandled rejection", async () => {
    fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    await expect(getProducts()).rejects.toThrow("ECONNREFUSED");
  });
});
