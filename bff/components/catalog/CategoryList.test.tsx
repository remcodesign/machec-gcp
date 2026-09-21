import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CategoryList } from "./CategoryList";
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
    description: "Buizen, dozen en meer",
    filterable_attributes: [],
  },
];

describe("CategoryList", () => {
  it("renders one link per category, to its own category page", () => {
    render(<CategoryList categories={categories} />);

    expect(screen.getByRole("link", { name: /Groepenkasten/ })).toHaveAttribute(
      "href",
      "/categories/groepenkast-componenten",
    );
    expect(
      screen.getByRole("link", { name: /Installatiemateriaal/ }),
    ).toHaveAttribute("href", "/categories/installatiemateriaal");
  });

  it("only renders a description when the category has one", () => {
    render(<CategoryList categories={categories} />);
    expect(screen.getByText("Buizen, dozen en meer")).toBeInTheDocument();
  });
});
