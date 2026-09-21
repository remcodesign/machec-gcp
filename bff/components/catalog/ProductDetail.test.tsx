import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProductDetail } from "./ProductDetail";
import type { Category, Product } from "@/types/catalog";

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

  it("the Add to cart button is a deliberate no-op (D73)", () => {
    render(<ProductDetail category={category} product={product} />);
    expect(
      screen.getByRole("button", { name: "Toevoegen aan winkelmand" }),
    ).toBeDisabled();
  });
});
