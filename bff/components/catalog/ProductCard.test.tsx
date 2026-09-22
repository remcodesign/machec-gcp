import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Product } from "@/types/catalog";

const addItemMock = vi.fn().mockResolvedValue(true);

vi.mock("@/hooks/useCart", () => ({
  useCart: () => ({
    addItem: addItemMock,
    setQuantity: vi.fn(),
    isSubmitting: false,
    error: null,
  }),
}));

const { ProductCard } = await import("./ProductCard");

const product: Product = {
  sku: "SKU-1",
  name: "Groepenkast 8-groeps",
  brand: "ABB",
  price_cents: 12999,
  category_slug: "groepenkast-componenten",
  status: "published",
  attributes: { amperage: "16A" },
};

describe("ProductCard", () => {
  it("renders name, brand, and price, and never an attribute spec list", () => {
    render(<ProductCard product={product} />);

    expect(screen.getByText("Groepenkast 8-groeps")).toBeInTheDocument();
    expect(screen.getByText("ABB")).toBeInTheDocument();
    expect(screen.getByText(/129,99/)).toBeInTheDocument();
    expect(screen.queryByText("16A")).not.toBeInTheDocument();
  });

  it("links to the product detail page by SKU", () => {
    render(<ProductCard product={product} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/products/SKU-1");
  });

  it("clicking Add to cart on ProductCard now adds that product to the cart", () => {
    render(<ProductCard product={product} />);
    const button = screen.getByRole("button", {
      name: "Toevoegen aan winkelmand",
    });
    expect(button).not.toBeDisabled();

    fireEvent.click(button);

    expect(addItemMock).toHaveBeenCalledWith("SKU-1");
  });

  it("Add to cart is disabled on a product whose cached stock is zero", () => {
    addItemMock.mockClear();
    render(<ProductCard product={{ ...product, stock: 0 }} />);
    const button = screen.getByRole("button", {
      name: "Toevoegen aan winkelmand",
    });
    expect(button).toBeDisabled();

    fireEvent.click(button);

    expect(addItemMock).not.toHaveBeenCalled();
  });

  it("renders the shared ghost image placeholder", () => {
    const { container } = render(<ProductCard product={product} />);
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      expect.stringContaining("product-placeholder.svg"),
    );
  });

  it("list layout renders a horizontal row with its own Add to cart button", () => {
    render(<ProductCard layout="list" product={product} />);
    const button = screen.getByRole("button", { name: "Toevoegen" });
    expect(button).not.toBeDisabled();

    fireEvent.click(button);

    expect(addItemMock).toHaveBeenCalledWith("SKU-1");
  });

  it("list layout also disables Add to cart when stock is zero", () => {
    addItemMock.mockClear();
    render(<ProductCard layout="list" product={{ ...product, stock: 0 }} />);
    expect(screen.getByRole("button", { name: "Toevoegen" })).toBeDisabled();
  });

  it("shows 'Op voorraad' when stock is not reported or above zero", () => {
    render(<ProductCard product={product} />);
    expect(screen.getByText("Op voorraad")).toBeInTheDocument();
  });

  it("shows 'Niet op voorraad' when stock is zero", () => {
    render(<ProductCard product={{ ...product, stock: 0 }} />);
    expect(screen.getByText("Niet op voorraad")).toBeInTheDocument();
  });

  it("list layout also renders the stock line", () => {
    render(<ProductCard layout="list" product={{ ...product, stock: 0 }} />);
    expect(screen.getByText("Niet op voorraad")).toBeInTheDocument();
  });
});
