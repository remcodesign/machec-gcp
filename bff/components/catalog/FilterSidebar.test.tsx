import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FilterSidebar } from "./FilterSidebar";
import type { Category } from "@/types/catalog";

const pushMock = vi.fn();
let currentSearchParams = new URLSearchParams("");

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => currentSearchParams,
}));

const writeTextMock = vi.fn();

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
  beforeEach(() => {
    vi.useFakeTimers();
    writeTextMock.mockReset().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: writeTextMock } });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    pushMock.mockClear();
    currentSearchParams = new URLSearchParams("");
  });

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

  it("changing the brand select applies the filter immediately, with no separate submit step", () => {
    render(
      <FilterSidebar categories={categories} filters={{}} path="/products" />,
    );

    fireEvent.change(screen.getByLabelText("Merk"), {
      target: { value: "ABB" },
    });

    expect(pushMock).toHaveBeenCalledWith("/products?brand=ABB");
  });

  it("changing category clears any attribute filter that belonged to the previous category", () => {
    render(
      <FilterSidebar
        categories={categories}
        filters={{ category: "groepenkast-componenten", amperage: "16A" }}
        path="/products"
      />,
    );

    fireEvent.change(screen.getByLabelText("Categorie"), {
      target: { value: "installatiemateriaal" },
    });

    const [url] = pushMock.mock.calls[0] as [string];
    expect(url).toContain("category=installatiemateriaal");
    expect(url).not.toContain("amperage");
  });

  it("on a /categories/[slug] page, changing category navigates to the new category's own path instead of adding a no-op query param to the current one", () => {
    render(
      <FilterSidebar
        categories={categories}
        filters={{ category: "groepenkast-componenten", amperage: "16A" }}
        path="/categories/groepenkast-componenten"
      />,
    );

    fireEvent.change(screen.getByLabelText("Categorie"), {
      target: { value: "installatiemateriaal" },
    });

    expect(pushMock).toHaveBeenCalledWith("/categories/installatiemateriaal");
  });

  it("on a /categories/[slug] page, clearing the category select navigates to the unfiltered all-products listing", () => {
    render(
      <FilterSidebar
        categories={categories}
        filters={{ category: "groepenkast-componenten" }}
        path="/categories/groepenkast-componenten"
      />,
    );

    fireEvent.change(screen.getByLabelText("Categorie"), {
      target: { value: "" },
    });

    expect(pushMock).toHaveBeenCalledWith("/products");
  });

  it("typing in the price inputs debounces the applied filter instead of firing on every keystroke", () => {
    render(
      <FilterSidebar categories={categories} filters={{}} path="/products" />,
    );

    fireEvent.change(screen.getByPlaceholderText("Vanaf"), {
      target: { value: "1" },
    });
    fireEvent.change(screen.getByPlaceholderText("Vanaf"), {
      target: { value: "10" },
    });
    fireEvent.change(screen.getByPlaceholderText("Vanaf"), {
      target: { value: "100" },
    });

    expect(pushMock).not.toHaveBeenCalled();

    vi.runAllTimers();

    expect(pushMock).toHaveBeenCalledTimes(1);
    // The field is entered/displayed in euros (matching formatPrice.ts
    // everywhere else a price shows), converted to price_cents at the URL
    // boundary since that's what PIM Core's own filter scope compares
    // against — "100" here means €100, i.e. 10000 cents.
    expect(pushMock).toHaveBeenCalledWith("/products?price_min=10000");
  });

  it("typing a comma-decimal euro amount (the Dutch locale's own decimal separator) converts correctly to price_cents", () => {
    render(
      <FilterSidebar categories={categories} filters={{}} path="/products" />,
    );

    fireEvent.change(screen.getByPlaceholderText("Vanaf"), {
      target: { value: "44,95" },
    });

    vi.runAllTimers();

    expect(pushMock).toHaveBeenCalledWith("/products?price_min=4495");
  });

  it("a price_min already in the URL (price_cents) is displayed back to the user in euros, not raw cents", () => {
    render(
      <FilterSidebar
        categories={categories}
        filters={{ price_min: "4495" }}
        path="/products"
      />,
    );

    expect(screen.getByPlaceholderText("Vanaf")).toHaveValue("44,95");
  });

  it("a filter change always drops any existing page param, resetting pagination", () => {
    currentSearchParams = new URLSearchParams("page=2");
    render(
      <FilterSidebar
        categories={categories}
        filters={{ page: 2 }}
        path="/products"
      />,
    );

    fireEvent.change(screen.getByLabelText("Merk"), {
      target: { value: "Gira" },
    });

    expect(pushMock).toHaveBeenCalledWith("/products?brand=Gira");
  });

  it("Huidige selectie delen copies the absolute current-filter URL to the clipboard and confirms it with a status message", async () => {
    render(
      <FilterSidebar
        categories={categories}
        filters={{ brand: "ABB" }}
        path="/products"
      />,
    );

    const shareButton = screen.getByRole("button", {
      name: "Huidige selectie delen",
    });
    expect(shareButton.querySelector("svg")).not.toBeNull();

    await act(async () => {
      fireEvent.click(shareButton);
      await Promise.resolve();
    });

    expect(writeTextMock).toHaveBeenCalledWith(
      `${window.location.origin}/products?brand=ABB`,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Link gekopieerd naar klembord",
    );
  });

  it("shows an error status instead of a silent failure when the clipboard write rejects", async () => {
    writeTextMock.mockRejectedValueOnce(new Error("denied"));
    render(
      <FilterSidebar
        categories={categories}
        filters={{ brand: "ABB" }}
        path="/products"
      />,
    );

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Huidige selectie delen" }),
      );
      await Promise.resolve();
    });

    expect(screen.getByRole("status")).toHaveTextContent(
      "Kopiëren is niet gelukt",
    );
  });
});
