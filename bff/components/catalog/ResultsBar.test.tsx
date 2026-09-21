import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/products",
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const { ResultsBar } = await import("./ResultsBar");

describe("ResultsBar", () => {
  it("shows the result count range and total", () => {
    render(
      <ResultsBar
        meta={{
          current_page: 1,
          last_page: 2,
          per_page: 6,
          total: 12,
          from: 1,
          to: 6,
        }}
      />,
    );
    expect(screen.getByText(/1–6/)).toBeInTheDocument();
    expect(screen.getByText(/12 producten/)).toBeInTheDocument();
  });

  it("shows 0-0 when there are no results at all", () => {
    render(
      <ResultsBar
        meta={{
          current_page: 1,
          last_page: 0,
          per_page: 6,
          total: 0,
          from: null,
          to: null,
        }}
      />,
    );
    expect(screen.getByText(/0–0/)).toBeInTheDocument();
  });
});
