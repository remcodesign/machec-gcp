import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const loginMock = vi.fn();

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    login: loginMock,
    register: vi.fn(),
    logout: vi.fn(),
    isLoading: false,
    error: null,
    user: null,
  }),
}));

const { LoginForm } = await import("./LoginForm");

describe("LoginForm", () => {
  it("submits the entered email and password", () => {
    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText("E-mailadres"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Wachtwoord"), {
      target: { value: "secret123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Inloggen" }));

    expect(loginMock).toHaveBeenCalledWith({
      email: "test@example.com",
      password: "secret123",
    });
  });

  it("shows the error message inline when the hook reports one", async () => {
    vi.doMock("@/hooks/useAuth", () => ({
      useAuth: () => ({
        login: loginMock,
        register: vi.fn(),
        logout: vi.fn(),
        isLoading: false,
        error: "These credentials do not match our records.",
        user: null,
      }),
    }));
    vi.resetModules();
    const { LoginForm: LoginFormWithError } = await import("./LoginForm");

    render(<LoginFormWithError />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "These credentials do not match our records.",
    );
  });
});
