import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Cart } from "@/types/cart";

const cookieStore = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      cookieStore.has(name) ? { value: cookieStore.get(name) } : undefined,
  })),
}));

const setItemQuantity =
  vi.fn<(cartId: string, sku: string, quantity: number) => Promise<Cart>>();
vi.mock("@/lib/cartStore", () => ({
  CART_COOKIE: "cart_id",
  cartStore: { addItem: vi.fn(), setItemQuantity },
}));

const { PATCH } = await import("./route");

function request(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://shop.example.com/api/v1/cart/items/SKU-1", {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      origin: "http://shop.example.com",
      host: "shop.example.com",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function context(sku = "SKU-1") {
  return { params: Promise.resolve({ sku }) };
}

describe("PATCH /api/v1/cart/items/[sku]", () => {
  beforeEach(() => {
    cookieStore.clear();
    cookieStore.set("cart_id", "cart-1");
  });

  afterEach(() => {
    setItemQuantity.mockReset();
  });

  it("sets an exact quantity on the cookie's cart", async () => {
    setItemQuantity.mockResolvedValue({
      cart_id: "cart-1",
      items: [{ sku: "SKU-1", quantity: 3 }],
    });

    const response = await PATCH(request({ quantity: 3 }), context());

    expect(response.status).toBe(200);
    expect(setItemQuantity).toHaveBeenCalledWith("cart-1", "SKU-1", 3);
  });

  it("removing the last item empties the cart view without an error", async () => {
    setItemQuantity.mockResolvedValue({ cart_id: "cart-1", items: [] });

    const response = await PATCH(request({ quantity: 0 }), context());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ cart_id: "cart-1", items: [] });
    expect(setItemQuantity).toHaveBeenCalledWith("cart-1", "SKU-1", 0);
  });

  it("a cart mutation with a cross-site Origin header is rejected with 403", async () => {
    const response = await PATCH(
      request({ quantity: 1 }, { origin: "https://evil.example.com" }),
      context(),
    );

    expect(response.status).toBe(403);
    expect(setItemQuantity).not.toHaveBeenCalled();
  });

  it("returns 404 when there is no cart cookie to patch", async () => {
    cookieStore.clear();

    const response = await PATCH(request({ quantity: 1 }), context());

    expect(response.status).toBe(404);
    expect(setItemQuantity).not.toHaveBeenCalled();
  });

  it("rejects a non-integer quantity", async () => {
    const response = await PATCH(request({ quantity: 1.5 }), context());

    expect(response.status).toBe(422);
    expect(setItemQuantity).not.toHaveBeenCalled();
  });
});
