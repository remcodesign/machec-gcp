import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ResolvedCart } from "@/hooks/useResolvedCart";
import type { Product } from "@/types/catalog";

const cookieStore = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      cookieStore.has(name) ? { value: cookieStore.get(name) } : undefined,
  })),
}));

const getResolvedCart =
  vi.fn<(cartId: string | undefined) => Promise<ResolvedCart>>();
vi.mock("@/hooks/useResolvedCart", () => ({ getResolvedCart }));

vi.mock("@/hooks/useCart", () => ({
  useCart: () => ({
    addItem: vi.fn(),
    setQuantity: vi.fn(),
    isSubmitting: false,
    error: null,
  }),
}));

const { default: CartPage } = await import("./page");

const productOne: Product = {
  sku: "SKU-1",
  name: "Groepenkast 8-groeps",
  brand: "ABB",
  price_cents: 1000,
  category_slug: "groepenkast-componenten",
  status: "published",
  attributes: {},
};

const productTwo: Product = {
  sku: "SKU-2",
  name: "Kabelgoot 2m",
  brand: "Niedax",
  price_cents: 2500,
  category_slug: "groepenkast-componenten",
  status: "published",
  attributes: {},
};

describe("CartPage", () => {
  beforeEach(() => {
    cookieStore.clear();
    getResolvedCart.mockReset();
  });

  it("shows the empty-cart state when there is no cart cookie at all", async () => {
    getResolvedCart.mockResolvedValue({ lines: [], itemCount: 0 });

    render(await CartPage());

    expect(screen.getByText("Je winkelmand is leeg")).toBeInTheDocument();
    expect(getResolvedCart).toHaveBeenCalledWith(undefined);
  });

  it("shows the empty-cart state when the cart has zero resolvable lines (removing the last item, or every line pruned as stale)", async () => {
    cookieStore.set("cart_id", "cart-1");
    getResolvedCart.mockResolvedValue({ lines: [], itemCount: 0 });

    render(await CartPage());

    expect(screen.getByText("Je winkelmand is leeg")).toBeInTheDocument();
    expect(getResolvedCart).toHaveBeenCalledWith("cart-1");
  });

  it("renders each resolved line's product and the total item count and price", async () => {
    cookieStore.set("cart_id", "cart-1");
    getResolvedCart.mockResolvedValue({
      lines: [
        { sku: "SKU-1", quantity: 2, product: productOne },
        { sku: "SKU-2", quantity: 1, product: productTwo },
      ],
      itemCount: 3,
    });

    render(await CartPage());

    expect(screen.getByText("Groepenkast 8-groeps")).toBeInTheDocument();
    expect(screen.getByText("Kabelgoot 2m")).toBeInTheDocument();
    // 2x 10,00 + 1x 25,00 = 45,00
    expect(screen.getByText("3 artikelen")).toBeInTheDocument();
    expect(screen.getByText(/45,00/)).toBeInTheDocument();
  });
});
