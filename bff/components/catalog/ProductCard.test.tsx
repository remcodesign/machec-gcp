import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProductCard } from "./ProductCard";
import type { Product } from "@/types/catalog";

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

  it("clicking Add to cart is a deliberate no-op (D73) — disabled, no click handler", () => {
    render(<ProductCard product={product} />);
    const button = screen.getByRole("button", {
      name: "Toevoegen aan winkelmand",
    });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    // still disabled, nothing to assert changed — a disabled button fires no click
  });

  it("renders the shared ghost image placeholder", () => {
    const { container } = render(<ProductCard product={product} />);
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      expect.stringContaining("product-placeholder.svg"),
    );
  });

  it("list layout renders a horizontal row with its own disabled Add to cart stub", () => {
    render(<ProductCard layout="list" product={product} />);
    expect(screen.getByRole("button", { name: "Toevoegen" })).toBeDisabled();
  });
});
