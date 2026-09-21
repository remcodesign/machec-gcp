import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const getCatalogCategories = vi.fn();

vi.mock("@/hooks/useCatalog", () => ({ getCatalogCategories }));

const { SiteFooter } = await import("./SiteFooter");

describe("SiteFooter", () => {
  it("renders a category quick-link per category", async () => {
    getCatalogCategories.mockResolvedValueOnce({
      data: [
        {
          slug: "groepenkast-componenten",
          name: "Groepenkasten",
          filterable_attributes: [],
        },
      ],
      meta: {
        current_page: 1,
        last_page: 1,
        per_page: 6,
        total: 1,
        from: 1,
        to: 1,
      },
    });

    render(await SiteFooter());

    expect(screen.getByRole("link", { name: "Groepenkasten" })).toHaveAttribute(
      "href",
      "/categories/groepenkast-componenten",
    );
  });

  it("degrades to no category links, not a crashed footer, on a PIM/Firestore failure", async () => {
    getCatalogCategories.mockRejectedValueOnce(
      new Error("Firestore unavailable"),
    );

    render(await SiteFooter());

    expect(screen.getByText(/MACHEC/)).toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});
