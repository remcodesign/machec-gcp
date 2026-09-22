import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CartSummary } from "./CartSummary";

describe("CartSummary", () => {
  it("renders the total item count and the formatted total price", () => {
    render(<CartSummary itemCount={3} totalCents={4995} />);

    expect(screen.getByText("3 artikelen")).toBeInTheDocument();
    expect(screen.getByText(/49,95/)).toBeInTheDocument();
  });

  it("uses the singular form for exactly one item", () => {
    render(<CartSummary itemCount={1} totalCents={1000} />);

    expect(screen.getByText("1 artikel")).toBeInTheDocument();
  });

  it("renders a disabled checkout button with a note that it doesn't work yet", () => {
    render(<CartSummary itemCount={1} totalCents={1000} />);

    expect(
      screen.getByRole("button", { name: "Naar de kassa" }),
    ).toBeDisabled();
    expect(screen.getByText("Binnenkort beschikbaar!")).toBeInTheDocument();
  });
});
