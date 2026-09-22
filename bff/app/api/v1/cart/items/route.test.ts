import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Cart } from "@/types/cart";

const cookieStore = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      cookieStore.has(name) ? { value: cookieStore.get(name) } : undefined,
  })),
}));

const addItem =
  vi.fn<(cartId: string, sku: string, quantity: number) => Promise<Cart>>();
vi.mock("@/lib/cartStore", () => ({
  CART_COOKIE: "cart_id",
  cartStore: { addItem, setItemQuantity: vi.fn() },
}));

const { POST } = await import("./route");

function request(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://shop.example.com/api/v1/cart/items", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://shop.example.com",
      host: "shop.example.com",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/cart/items", () => {
  beforeEach(() => {
    cookieStore.clear();
  });

  afterEach(() => {
    addItem.mockReset();
  });

  it("a first-time visitor with no cart cookie gets one minted on their first add", async () => {
    addItem.mockResolvedValue({
      cart_id: "any",
      items: [{ sku: "SKU-1", quantity: 1 }],
    });

    const response = await POST(request({ sku: "SKU-1", quantity: 1 }));

    expect(response.status).toBe(200);
    expect(addItem).toHaveBeenCalledTimes(1);
    const [mintedCartId, sku, quantity] = addItem.mock.calls[0]!;
    expect(mintedCartId).toMatch(/^[0-9a-f-]{36}$/);
    expect(sku).toBe("SKU-1");
    expect(quantity).toBe(1);

    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toContain(`cart_id=${mintedCartId}`);
    expect(setCookie).toContain("HttpOnly");
  });

  it("a returning visitor's existing cart cookie is reused, not replaced", async () => {
    cookieStore.set("cart_id", "existing-cart-id");
    addItem.mockResolvedValue({ cart_id: "existing-cart-id", items: [] });

    const response = await POST(request({ sku: "SKU-1", quantity: 1 }));

    expect(addItem).toHaveBeenCalledWith("existing-cart-id", "SKU-1", 1);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("a cart mutation with a cross-site Origin header is rejected with 403", async () => {
    const response = await POST(
      request(
        { sku: "SKU-1", quantity: 1 },
        { origin: "https://evil.example.com" },
      ),
    );

    expect(response.status).toBe(403);
    expect(addItem).not.toHaveBeenCalled();
  });

  it("rejects a missing sku or a non-positive quantity before ever touching the cart store", async () => {
    const missingSku = await POST(request({ quantity: 1 }));
    const zeroQuantity = await POST(request({ sku: "SKU-1", quantity: 0 }));

    expect(missingSku.status).toBe(422);
    expect(zeroQuantity.status).toBe(422);
    expect(addItem).not.toHaveBeenCalled();
  });
});
