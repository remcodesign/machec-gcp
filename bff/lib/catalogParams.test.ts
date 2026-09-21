import { describe, expect, it } from "vitest";
import { catalogHref, parseCatalogFilters } from "./catalogParams";
import type { Category } from "@/types/catalog";

const categories: Category[] = [
  {
    slug: "groepenkast-componenten",
    name: "Groepenkasten",
    filterable_attributes: ["component_type", "amperage"],
  },
  {
    slug: "installatiemateriaal",
    name: "Installatiemateriaal",
    filterable_attributes: ["material_type"],
  },
];

describe("parseCatalogFilters", () => {
  it("selecting amperage=16A inside groepenkast-componenten narrows the grid via the parsed filters", () => {
    const filters = parseCatalogFilters(
      { category: "groepenkast-componenten", amperage: "16A" },
      categories,
    );

    expect(filters).toEqual({
      category: "groepenkast-componenten",
      amperage: "16A",
    });
  });

  it("switching to a category with no material_type filter never carries a stale attribute filter from the previous category", () => {
    const filters = parseCatalogFilters(
      {
        category: "installatiemateriaal",
        // stale query-string leftovers from a previous category selection
        component_type: "stale",
        amperage: "stale",
      },
      categories,
    );

    expect(filters).toEqual({ category: "installatiemateriaal" });
  });

  it("with no category selected, only global filters are ever parsed, never an attribute key", () => {
    const filters = parseCatalogFilters(
      { brand: "ABB", amperage: "16A" },
      categories,
    );

    expect(filters).toEqual({ brand: "ABB" });
  });

  it("a category with no matching entry in the live category list resolves no attribute filters, but never crashes", () => {
    const filters = parseCatalogFilters(
      { category: "unknown-category", amperage: "16A" },
      categories,
    );

    expect(filters).toEqual({ category: "unknown-category" });
  });

  it("an attribute key a category adds later (not hardcoded anywhere) is forwarded the moment it appears in the live category list", () => {
    const categoriesWithNewAttribute: Category[] = [
      {
        slug: "groepenkast-componenten",
        name: "Groepenkasten",
        filterable_attributes: ["component_type", "amperage", "voltage"],
      },
    ];

    const filters = parseCatalogFilters(
      { category: "groepenkast-componenten", voltage: "230V" },
      categoriesWithNewAttribute,
    );

    expect(filters).toEqual({
      category: "groepenkast-componenten",
      voltage: "230V",
    });
  });

  it("ignores an unrecognized sort value instead of forwarding it to PIM Core", () => {
    const filters = parseCatalogFilters({ sort: "totally_bogus" }, categories);

    expect(filters.sort).toBeUndefined();
  });

  it("accepts each of the four allowed sort values", () => {
    for (const sort of ["name_asc", "name_desc", "price_asc", "price_desc"]) {
      expect(parseCatalogFilters({ sort }, categories).sort).toBe(sort);
    }
  });

  it("page 1 is the implicit default and never appears in the parsed filters", () => {
    expect(parseCatalogFilters({ page: "1" }, categories).page).toBeUndefined();
    expect(parseCatalogFilters({}, categories).page).toBeUndefined();
  });

  it("a non-numeric or malformed page value never crashes and falls back to no page filter", () => {
    expect(() =>
      parseCatalogFilters({ page: "not-a-number" }, categories),
    ).not.toThrow();
    expect(
      parseCatalogFilters({ page: "not-a-number" }, categories).page,
    ).toBeUndefined();
    expect(() => parseCatalogFilters({ page: "-5" }, categories)).not.toThrow();
  });

  it("a crafted array-valued query-string entry never crashes, only the first value is used", () => {
    expect(() =>
      parseCatalogFilters({ category: ["a", "b"], brand: ["x"] }, categories),
    ).not.toThrow();
    expect(
      parseCatalogFilters({ category: ["a", "b"] }, categories).category,
    ).toBe("a");
  });

  it("an empty-string filter value is treated as absent, not forwarded", () => {
    expect(parseCatalogFilters({ brand: "" }, categories)).toEqual({});
  });

  it("a categoryOverride (the /categories/[slug] route's own path segment) still resolves that category's attribute filters, since the category never appears in the query string on that route", () => {
    const filters = parseCatalogFilters(
      { amperage: "16A" },
      categories,
      "groepenkast-componenten",
    );

    expect(filters).toEqual({
      category: "groepenkast-componenten",
      amperage: "16A",
    });
  });

  it("a categoryOverride still rejects an attribute key that doesn't belong to that category", () => {
    const filters = parseCatalogFilters(
      { material_type: "Buizen" },
      categories,
      "groepenkast-componenten",
    );

    expect(filters).toEqual({ category: "groepenkast-componenten" });
  });
});

describe("catalogHref", () => {
  it("builds a query string from the active filters and updates the URL", () => {
    expect(
      catalogHref(
        "/products",
        { category: "groepenkast-componenten" },
        { amperage: "16A" },
      ),
    ).toBe("/products?category=groepenkast-componenten&amperage=16A");
  });

  it("returns the bare path when there are no active filters", () => {
    expect(catalogHref("/products", {})).toBe("/products");
  });

  it("an override replaces the base filter's value for the same key", () => {
    expect(
      catalogHref("/products", { sort: "name_asc" }, { sort: "price_desc" }),
    ).toBe("/products?sort=price_desc");
  });

  it("an override of empty string removes that key from the URL entirely", () => {
    expect(catalogHref("/products", { brand: "ABB" }, { brand: "" })).toBe(
      "/products",
    );
  });
});
