import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FilterSidebar } from "./FilterSidebar";
import type { Category } from "@/types/catalog";

const categories: Category[] = [
  {
    slug: "groepenkast-componenten",
    name: "Groepenkasten",
    filterable_attributes: [],
  },
  {
    slug: "installatiemateriaal",
    name: "Installatiemateriaal",
    filterable_attributes: [],
  },
];

describe("FilterSidebar", () => {
  it("with no category selected, shows only global filters (category, brand, price)", () => {
    render(
      <FilterSidebar categories={categories} filters={{}} path="/products" />,
    );

    expect(screen.getByText("Categorie")).toBeInTheDocument();
    expect(screen.getByText("Merk")).toBeInTheDocument();
    expect(screen.getByText("Prijs")).toBeInTheDocument();
    expect(screen.queryByText("Amperage")).not.toBeInTheDocument();
  });

  it("selecting a category with conditional filters shows only that category's attribute filters", () => {
    render(
      <FilterSidebar
        categories={categories}
        filters={{ category: "groepenkast-componenten" }}
        path="/categories/groepenkast-componenten"
      />,
    );

    expect(screen.getByText("Type component")).toBeInTheDocument();
    expect(screen.getByText("Amperage")).toBeInTheDocument();
  });

  it("switching to a category with no matching attribute filter never shows a stale one from the previous category", () => {
    render(
      <FilterSidebar
        categories={categories}
        filters={{ category: "installatiemateriaal" }}
        path="/categories/installatiemateriaal"
      />,
    );

    expect(screen.getByText("Type materiaal")).toBeInTheDocument();
    expect(screen.queryByText("Amperage")).not.toBeInTheDocument();
    expect(screen.queryByText("Type component")).not.toBeInTheDocument();
  });

  it("the Wissen (clear) link resets to the bare path with no filters", () => {
    render(
      <FilterSidebar
        categories={categories}
        filters={{ brand: "ABB", category: "groepenkast-componenten" }}
        path="/products"
      />,
    );
    expect(screen.getByRole("link", { name: "Wissen" })).toHaveAttribute(
      "href",
      "/products",
    );
  });
});
