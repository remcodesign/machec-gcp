import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@/types/auth";

const useAuthMock = vi.fn();
const usePathnameMock = vi.fn(() => "/");

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
}));

const { SiteHeader } = await import("./SiteHeader");

describe("SiteHeader", () => {
  it("shows a plain /login link and never a /register link for a guest", () => {
    useAuthMock.mockReturnValue({
      user: null,
      isLoading: false,
      logout: vi.fn(),
    });

    render(<SiteHeader />);

    expect(screen.getByRole("link", { name: "Inloggen" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(screen.queryByRole("link", { name: /register/i })).toBeNull();
  });

  it("shows AccountMenu instead of the login link once a session exists", () => {
    const user: AuthUser = {
      customer_id: 1,
      name: "Test User",
      email: "test@example.com",
    };
    useAuthMock.mockReturnValue({ user, isLoading: false, logout: vi.fn() });

    render(<SiteHeader />);

    expect(screen.queryByRole("link", { name: "Inloggen" })).toBeNull();
    expect(
      screen.getByRole("button", { name: /accountmenu van test user/i }),
    ).toBeInTheDocument();
  });

  it("links to /, /products, and /cart on every render", () => {
    useAuthMock.mockReturnValue({
      user: null,
      isLoading: false,
      logout: vi.fn(),
    });

    render(<SiteHeader />);

    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: "Producten" })).toHaveAttribute(
      "href",
      "/products",
    );
    expect(screen.getByRole("link", { name: "Winkelmand" })).toHaveAttribute(
      "href",
      "/cart",
    );
  });

  it("marks Producten as the active nav link on /products and on a product detail page", () => {
    useAuthMock.mockReturnValue({
      user: null,
      isLoading: false,
      logout: vi.fn(),
    });
    usePathnameMock.mockReturnValue("/products/prod_12");

    render(<SiteHeader />);

    expect(screen.getByRole("link", { name: "Producten" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute(
      "aria-current",
    );
  });
});
