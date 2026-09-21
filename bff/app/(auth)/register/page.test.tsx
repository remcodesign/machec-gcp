import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    isLoading: false,
    error: null,
    user: null,
  }),
}));

const { default: RegisterPage } = await import("./page");

describe("RegisterPage", () => {
  it("links back to /login for a guest who already has an account", () => {
    render(<RegisterPage />);

    expect(screen.getByRole("link", { name: "Inloggen" })).toHaveAttribute(
      "href",
      "/login",
    );
  });
});
