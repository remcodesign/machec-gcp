import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/products",
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => new URLSearchParams("page=3&brand=ABB"),
}));

const { SortSelect } = await import("./SortSelect");

describe("SortSelect", () => {
  it("selecting price_desc requests a new page sorted by price descending and clears the page param", () => {
    render(<SortSelect value="name_asc" />);

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "price_desc" },
    });

    expect(pushMock).toHaveBeenCalledWith(
      "/products?brand=ABB&sort=price_desc",
    );
  });

  it("defaults to name_asc when no value is given", () => {
    render(<SortSelect />);
    expect(screen.getByRole("combobox")).toHaveValue("name_asc");
  });
});
