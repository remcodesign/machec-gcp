import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Category, Product } from "@/types/catalog";

const addItemMock = vi.fn().mockResolvedValue(true);

vi.mock("@/hooks/useCart", () => ({
  useCart: () => ({
    addItem: addItemMock,
    setQuantity: vi.fn(),
    isSubmitting: false,
    error: null,
  }),
}));

const { ProductDetail } = await import("./ProductDetail");

const product: Product = {
  sku: "SKU-1",
  name: "Groepenkast 8-groeps",
  brand: "ABB",
  price_cents: 12999,
  category_slug: "groepenkast-componenten",
  status: "published",
  attributes: { amperage: "16A", component_type: "Installatieautomaat" },
};

const category: Category = {
  slug: "groepenkast-componenten",
  name: "Groepenkasten",
  filterable_attributes: ["component_type", "amperage"],
};

describe("ProductDetail", () => {
  it("renders one spec row per attribute key in the product's category filterable_attributes, in order", () => {
    render(<ProductDetail category={category} product={product} />);

    const rows = screen.getAllByRole("term");
    expect(rows.map((row) => row.textContent)).toEqual([
      "component type",
      "amperage",
    ]);
  });

  it("falls back to the product's own attribute keys when no category is passed", () => {
    render(<ProductDetail product={product} />);
    expect(screen.getAllByRole("term")).toHaveLength(2);
  });

  it("links the category name back to its own category page", () => {
    render(<ProductDetail category={category} product={product} />);

    expect(screen.getByRole("link", { name: category.name })).toHaveAttribute(
      "href",
      "/categories/groepenkast-componenten",
    );
  });

  it("renders nothing category-related when no category resolves (e.g. an unknown category_slug)", () => {
    render(<ProductDetail product={product} />);

    expect(screen.queryByRole("link", { name: /./ })).not.toBeInTheDocument();
  });

  it("shows stock when defined and zero as out of stock", () => {
    const { rerender } = render(
      <ProductDetail category={category} product={{ ...product, stock: 0 }} />,
    );
    expect(screen.getByText("Niet op voorraad")).toBeInTheDocument();

    rerender(
      <ProductDetail category={category} product={{ ...product, stock: 5 }} />,
    );
    expect(screen.getByText("Op voorraad")).toBeInTheDocument();
  });

  it("assumes in stock when stock is not reported at all", () => {
    render(<ProductDetail category={category} product={product} />);
    expect(screen.getByText("Op voorraad")).toBeInTheDocument();
  });

  it("clicking Add to cart adds this product to the cart via useCart", () => {
    render(<ProductDetail category={category} product={product} />);
    const button = screen.getByRole("button", {
      name: "Toevoegen aan winkelmand",
    });
    expect(button).not.toBeDisabled();

    fireEvent.click(button);

    expect(addItemMock).toHaveBeenCalledWith("SKU-1");
  });

  it("Add to cart is disabled on a product whose cached stock is zero", () => {
    addItemMock.mockClear();
    render(
      <ProductDetail category={category} product={{ ...product, stock: 0 }} />,
    );
    const button = screen.getByRole("button", {
      name: "Toevoegen aan winkelmand",
    });
    expect(button).toBeDisabled();

    fireEvent.click(button);

    expect(addItemMock).not.toHaveBeenCalled();
  });
});
