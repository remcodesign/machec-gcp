import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Product } from "@/types/catalog";

const addItemMock = vi.fn().mockResolvedValue(true);
const useCartMock = vi.fn();

vi.mock("@/hooks/useCart", () => ({
  useCart: () => useCartMock(),
}));

const { AddToCartButton } = await import("./AddToCartButton");

const product: Product = {
  sku: "SKU-1",
  name: "Groepenkast 8-groeps",
  brand: "ABB",
  price_cents: 12999,
  category_slug: "groepenkast-componenten",
  status: "published",
  attributes: {},
};

describe("AddToCartButton", () => {
  beforeEach(() => {
    useCartMock.mockReturnValue({
      addItem: addItemMock,
      setQuantity: vi.fn(),
      isSubmitting: false,
      error: null,
    });
  });

  it("renders the given label and className", () => {
    render(
      <AddToCartButton
        className="my-class"
        label="Toevoegen"
        product={product}
      />,
    );

    const button = screen.getByRole("button", { name: "Toevoegen" });
    expect(button).toHaveClass("my-class");
  });

  it("clicking it calls useCart().addItem with the product's sku", () => {
    render(
      <AddToCartButton
        className=""
        label="Toevoegen aan winkelmand"
        product={product}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Toevoegen aan winkelmand" }),
    );

    expect(addItemMock).toHaveBeenCalledWith("SKU-1");
  });

  it("is disabled when the cached stock is zero, and clicking does nothing", () => {
    render(
      <AddToCartButton
        className=""
        label="Toevoegen aan winkelmand"
        product={{ ...product, stock: 0 }}
      />,
    );

    const button = screen.getByRole("button", {
      name: "Toevoegen aan winkelmand",
    });
    expect(button).toBeDisabled();

    fireEvent.click(button);

    expect(addItemMock).not.toHaveBeenCalled();
  });

  it("is disabled while a previous submission is still in flight", () => {
    useCartMock.mockReturnValue({
      addItem: addItemMock,
      setQuantity: vi.fn(),
      isSubmitting: true,
      error: null,
    });

    render(
      <AddToCartButton
        className=""
        label="Toevoegen aan winkelmand"
        product={product}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Toevoegen aan winkelmand" }),
    ).toBeDisabled();
  });
});
