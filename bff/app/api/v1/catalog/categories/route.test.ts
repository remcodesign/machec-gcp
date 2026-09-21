import { describe, expect, it, vi } from "vitest";

const getCategories = vi.fn();

vi.mock("@/lib/catalogCache", () => ({
  catalogCache: { getCategories, getProduct: vi.fn(), getProducts: vi.fn() },
}));

const { GET } = await import("./route");

describe("GET /api/v1/catalog/categories", () => {
  it("returns the cache-aside category list", async () => {
    getCategories.mockResolvedValueOnce({ data: [], meta: {} });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: [], meta: {} });
  });

  it("returns a controlled 502 instead of crashing when the cache/PIM path fails", async () => {
    getCategories.mockRejectedValueOnce(new Error("PIM unavailable"));

    const response = await GET();

    expect(response.status).toBe(502);
  });
});
