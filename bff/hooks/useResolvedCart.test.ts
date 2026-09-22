import { describe, expect, it, vi } from "vitest";
import type { Cart } from "@/types/cart";
import type { Product } from "@/types/catalog";

const getCart = vi.fn<(cartId: string) => Promise<Cart>>();
const replaceItems = vi.fn();
vi.mock("@/lib/cartStore", () => ({
  cartStore: { getCart, replaceItems },
}));

const getCatalogProduct = vi.fn<(sku: string) => Promise<Product | null>>();
vi.mock("@/hooks/useCatalog", () => ({ getCatalogProduct }));

const { getResolvedCart } = await import("./useResolvedCart");

const productOne: Product = {
  sku: "SKU-1",
  name: "Groepenkast 8-groeps",
  brand: "ABB",
  price_cents: 1000,
  category_slug: "groepenkast-componenten",
  status: "published",
  attributes: {},
};

describe("getResolvedCart", () => {
  it("returns an empty cart without touching the store when there is no cart id", async () => {
    const result = await getResolvedCart(undefined);

    expect(result).toEqual({ lines: [], itemCount: 0 });
    expect(getCart).not.toHaveBeenCalled();
  });

  it("resolves every line against the live catalog and sums quantities into itemCount", async () => {
    getCart.mockResolvedValue({
      cart_id: "cart-1",
      items: [{ sku: "SKU-1", quantity: 3 }],
    });
    getCatalogProduct.mockResolvedValue(productOne);

    const result = await getResolvedCart("cart-1");

    expect(result).toEqual({
      lines: [{ sku: "SKU-1", quantity: 3, product: productOne }],
      itemCount: 3,
    });
    expect(replaceItems).not.toHaveBeenCalled();
  });

  it("prunes a line whose sku no longer resolves in the catalog, and persists the pruned list", async () => {
    getCart.mockResolvedValue({
      cart_id: "cart-1",
      items: [
        { sku: "SKU-1", quantity: 3 },
        { sku: "deleted-sku", quantity: 4 },
      ],
    });
    getCatalogProduct.mockImplementation(async (sku: string) =>
      sku === "SKU-1" ? productOne : null,
    );

    const result = await getResolvedCart("cart-1");

    expect(result).toEqual({
      lines: [{ sku: "SKU-1", quantity: 3, product: productOne }],
      itemCount: 3,
    });
    expect(replaceItems).toHaveBeenCalledWith("cart-1", [
      { sku: "SKU-1", quantity: 3 },
    ]);
  });

  it("prunes every line and reports an empty cart when nothing resolves any more", async () => {
    getCart.mockResolvedValue({
      cart_id: "cart-1",
      items: [{ sku: "deleted-sku", quantity: 4 }],
    });
    getCatalogProduct.mockResolvedValue(null);

    const result = await getResolvedCart("cart-1");

    expect(result).toEqual({ lines: [], itemCount: 0 });
    expect(replaceItems).toHaveBeenCalledWith("cart-1", []);
  });
});
