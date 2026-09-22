import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Product } from "@/types/catalog";

const setQuantityMock = vi.fn().mockResolvedValue(true);
const useCartMock = vi.fn();

vi.mock("@/hooks/useCart", () => ({
  useCart: () => useCartMock(),
}));

const { CartLine } = await import("./CartLine");

const product: Product = {
  sku: "SKU-1",
  name: "Groepenkast 8-groeps",
  brand: "ABB",
  price_cents: 1000,
  category_slug: "groepenkast-componenten",
  status: "published",
  attributes: {},
};

describe("CartLine", () => {
  beforeEach(() => {
    useCartMock.mockReturnValue({
      addItem: vi.fn(),
      setQuantity: setQuantityMock,
      isSubmitting: false,
      error: null,
    });
  });

  it("renders the product name, unit price, and line total for the given quantity", () => {
    render(<CartLine product={product} quantity={3} />);

    expect(screen.getByText("Groepenkast 8-groeps")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText(/30,00/)).toBeInTheDocument();
  });

  it("stepping the quantity up calls setQuantity with quantity + 1", () => {
    render(<CartLine product={product} quantity={2} />);

    fireEvent.click(screen.getByLabelText("Aantal verhogen"));

    expect(setQuantityMock).toHaveBeenCalledWith("SKU-1", 3);
  });

  it("stepping the quantity down calls setQuantity with quantity - 1", () => {
    render(<CartLine product={product} quantity={2} />);

    fireEvent.click(screen.getByLabelText("Aantal verlagen"));

    expect(setQuantityMock).toHaveBeenCalledWith("SKU-1", 1);
  });

  it("clicking Verwijderen sets the quantity to 0, removing the line", () => {
    render(<CartLine product={product} quantity={1} />);

    fireEvent.click(screen.getByText("Verwijderen"));

    expect(setQuantityMock).toHaveBeenCalledWith("SKU-1", 0);
  });

  it("stepping down at quantity 1 disables '−' and never calls setQuantity — only Verwijderen removes the line", () => {
    render(<CartLine product={product} quantity={1} />);

    const stepDown = screen.getByLabelText("Aantal verlagen");
    expect(stepDown).toBeDisabled();

    fireEvent.click(stepDown);

    expect(setQuantityMock).not.toHaveBeenCalled();
  });

  it("shows a visible pending state instead of silently disabling the row while a mutation is in flight", () => {
    useCartMock.mockReturnValue({
      addItem: vi.fn(),
      setQuantity: setQuantityMock,
      isSubmitting: true,
      error: null,
    });

    render(<CartLine product={product} quantity={2} />);

    const row = screen.getByRole("listitem");
    expect(row).toHaveAttribute("aria-busy", "true");
    expect(screen.getByLabelText("Aantal verhogen")).toBeDisabled();
    expect(screen.getByLabelText("Aantal verlagen")).toBeDisabled();
    expect(screen.getByText("Bezig…")).toBeInTheDocument();
    // the quantity number is swapped for a spinner, not left silently as-is
    expect(screen.queryByText("2")).not.toBeInTheDocument();
  });
});
