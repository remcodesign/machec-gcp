import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GhostImage } from "./GhostImage";

describe("GhostImage", () => {
  it("renders the shared placeholder image", () => {
    render(<GhostImage alt="Test product" />);
    expect(screen.getByRole("img", { name: "Test product" })).toHaveAttribute(
      "src",
      expect.stringContaining("product-placeholder.svg"),
    );
  });

  it("defaults to the md size when none is given", () => {
    const { container } = render(<GhostImage />);
    expect(container.querySelector(".h-56")).toBeInTheDocument();
  });

  it("renders each declared size with its own dimensions", () => {
    const { container: sm } = render(<GhostImage size="sm" />);
    expect(sm.querySelector(".h-20")).toBeInTheDocument();

    const { container: lg } = render(<GhostImage size="lg" />);
    expect(lg.querySelector(".h-96")).toBeInTheDocument();
  });

  it("lazy-loads by default and only eager-loads when marked priority", () => {
    const { rerender } = render(<GhostImage alt="Test product" />);
    expect(screen.getByRole("img", { name: "Test product" })).toHaveAttribute(
      "loading",
      "lazy",
    );

    rerender(<GhostImage alt="Test product" priority />);
    expect(
      screen.getByRole("img", { name: "Test product" }),
    ).not.toHaveAttribute("loading");
  });
});
