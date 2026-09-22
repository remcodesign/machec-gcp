import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ResolvedCart } from "@/hooks/useResolvedCart";

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

const { CartCountBadge } = await import("./CartCountBadge");

describe("CartCountBadge", () => {
  it("renders nothing when the cart is empty", async () => {
    cookieStore.clear();
    getResolvedCart.mockResolvedValue({ lines: [], itemCount: 0 });

    const { container } = render(await CartCountBadge());

    expect(container.textContent).toBe("");
  });

  it("renders the item count in parentheses when there are items", async () => {
    cookieStore.set("cart_id", "cart-1");
    getResolvedCart.mockResolvedValue({ lines: [], itemCount: 3 });

    render(await CartCountBadge());

    expect(screen.getByText("(3)")).toBeInTheDocument();
    expect(getResolvedCart).toHaveBeenCalledWith("cart-1");
  });
});
