import { describe, expect, it } from "vitest";
import { catalogHref, parseCatalogFilters } from "./catalogParams";

describe("parseCatalogFilters", () => {
  it("selecting amperage=16A inside groepenkast-componenten narrows the grid via the parsed filters", () => {
    const filters = parseCatalogFilters({
      category: "groepenkast-componenten",
      amperage: "16A",
    });

    expect(filters).toEqual({
      category: "groepenkast-componenten",
      amperage: "16A",
    });
  });

  it("switching to a category with no material_type filter never carries a stale attribute filter from the previous category", () => {
    const filters = parseCatalogFilters({
      category: "installatiemateriaal",
      // stale query-string leftovers from a previous category selection
      component_type: "stale",
      amperage: "stale",
    });

    expect(filters).toEqual({ category: "installatiemateriaal" });
  });

  it("with no category selected, only global filters are ever parsed, never an attribute key", () => {
    const filters = parseCatalogFilters({
      brand: "ABB",
      amperage: "16A",
    });

    expect(filters).toEqual({ brand: "ABB" });
  });

  it("ignores an unrecognized sort value instead of forwarding it to PIM Core", () => {
    const filters = parseCatalogFilters({ sort: "totally_bogus" });

    expect(filters.sort).toBeUndefined();
  });

  it("accepts each of the four allowed sort values", () => {
    for (const sort of ["name_asc", "name_desc", "price_asc", "price_desc"]) {
      expect(parseCatalogFilters({ sort }).sort).toBe(sort);
    }
  });

  it("page 1 is the implicit default and never appears in the parsed filters", () => {
    expect(parseCatalogFilters({ page: "1" }).page).toBeUndefined();
    expect(parseCatalogFilters({}).page).toBeUndefined();
  });

  it("a non-numeric or malformed page value never crashes and falls back to no page filter", () => {
    expect(() => parseCatalogFilters({ page: "not-a-number" })).not.toThrow();
    expect(parseCatalogFilters({ page: "not-a-number" }).page).toBeUndefined();
    expect(() => parseCatalogFilters({ page: "-5" })).not.toThrow();
  });

  it("a crafted array-valued query-string entry never crashes, only the first value is used", () => {
    expect(() =>
      parseCatalogFilters({ category: ["a", "b"], brand: ["x"] }),
    ).not.toThrow();
    expect(parseCatalogFilters({ category: ["a", "b"] }).category).toBe("a");
  });

  it("an empty-string filter value is treated as absent, not forwarded", () => {
    expect(parseCatalogFilters({ brand: "" })).toEqual({});
  });

  it("a categoryOverride (the /categories/[slug] route's own path segment) still resolves that category's attribute filters, since the category never appears in the query string on that route", () => {
    const filters = parseCatalogFilters(
      { amperage: "16A" },
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
