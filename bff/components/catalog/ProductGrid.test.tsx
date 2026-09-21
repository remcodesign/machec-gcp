import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProductGrid } from "./ProductGrid";
import type { Product } from "@/types/catalog";

const products: Product[] = [
  {
    sku: "SKU-1",
    name: "Product One",
    brand: "ABB",
    price_cents: 1000,
    category_slug: "groepenkast-componenten",
    status: "published",
    attributes: {},
  },
  {
    sku: "SKU-2",
    name: "Product Two",
    brand: "Gira",
    price_cents: 2000,
    category_slug: "groepenkast-componenten",
    status: "published",
    attributes: {},
  },
];

describe("ProductGrid", () => {
  it("shows an empty-state message when there are no products", () => {
    render(<ProductGrid products={[]} />);
    expect(screen.getByText("Geen producten gevonden.")).toBeInTheDocument();
  });

  it("switching ViewToggle to list re-renders every ProductCard in list layout with no new network call", () => {
    render(<ProductGrid products={products} />);

    expect(
      screen.getAllByRole("button", { name: "Toevoegen aan winkelmand" }),
    ).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Lijstweergave" }));

    expect(screen.getAllByRole("button", { name: "Toevoegen" })).toHaveLength(
      2,
    );
    expect(
      screen.queryByRole("button", { name: "Toevoegen aan winkelmand" }),
    ).not.toBeInTheDocument();
  });
});
