import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Pagination } from "./Pagination";
import type { PaginationMeta } from "@/types/catalog";

function meta(overrides: Partial<PaginationMeta>): PaginationMeta {
  return {
    current_page: 1,
    last_page: 3,
    per_page: 6,
    total: 12,
    from: 1,
    to: 6,
    ...overrides,
  };
}

describe("Pagination", () => {
  it("renders nothing at all when there's only one page", () => {
    const { container } = render(
      <Pagination
        filters={{}}
        meta={meta({ last_page: 1 })}
        path="/products"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("an unfiltered listing still shows a working control past 6 products", () => {
    render(<Pagination filters={{}} meta={meta({})} path="/products" />);
    expect(screen.getByRole("link", { name: "2" })).toHaveAttribute(
      "href",
      "/products?page=2",
    );
  });

  it("page 2 carries the active filter/sort forward in every page link", () => {
    render(
      <Pagination
        filters={{ brand: "ABB", sort: "price_desc" }}
        meta={meta({ current_page: 2 })}
        path="/products"
      />,
    );
    const page3 = screen.getByRole("link", { name: "3" });
    expect(page3).toHaveAttribute(
      "href",
      "/products?brand=ABB&sort=price_desc&page=3",
    );
  });

  it("no prev arrow on page 1, no next arrow on the last page", () => {
    const { rerender } = render(
      <Pagination
        filters={{}}
        meta={meta({ current_page: 1 })}
        path="/products"
      />,
    );
    expect(screen.queryByRole("link", { name: "←" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "→" })).toBeInTheDocument();

    rerender(
      <Pagination
        filters={{}}
        meta={meta({ current_page: 3 })}
        path="/products"
      />,
    );
    expect(screen.getByRole("link", { name: "←" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "→" })).not.toBeInTheDocument();
  });
});
