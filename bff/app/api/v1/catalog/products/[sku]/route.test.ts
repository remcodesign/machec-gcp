import { describe, expect, it, vi } from "vitest";

const getProduct = vi.fn();

vi.mock("@/lib/catalogCache", () => ({
  catalogCache: { getCategories: vi.fn(), getProduct, getProducts: vi.fn() },
}));

const { GET } = await import("./route");

function context(sku: string) {
  return { params: Promise.resolve({ sku }) };
}

describe("GET /api/v1/catalog/products/[sku]", () => {
  it("returns the cache-aside product for a known SKU", async () => {
    const product = { sku: "SKU-1", name: "Test" };
    getProduct.mockResolvedValueOnce(product);

    const response = await GET(new Request("http://x"), context("SKU-1"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(product);
  });

  it("returns 404, not a broken page, for an unknown SKU", async () => {
    getProduct.mockResolvedValueOnce(null);

    const response = await GET(new Request("http://x"), context("MISSING"));

    expect(response.status).toBe(404);
  });

  it("returns a controlled 502 instead of crashing when the cache/PIM path fails", async () => {
    getProduct.mockRejectedValueOnce(new Error("PIM unavailable"));

    const response = await GET(new Request("http://x"), context("SKU-1"));

    expect(response.status).toBe(502);
  });
});
