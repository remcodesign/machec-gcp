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

const { default: LoginPage } = await import("./page");

describe("LoginPage", () => {
  it("links to /register for a guest with no account", () => {
    render(<LoginPage />);

    expect(
      screen.getByRole("link", { name: "Account aanmaken" }),
    ).toHaveAttribute("href", "/register");
  });
});
