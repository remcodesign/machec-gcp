import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const registerMock = vi.fn();

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    login: vi.fn(),
    register: registerMock,
    logout: vi.fn(),
    isLoading: false,
    error: null,
    user: null,
  }),
}));

const { RegisterForm } = await import("./RegisterForm");

describe("RegisterForm", () => {
  it("submits all four fields, including password_confirmation", () => {
    render(<RegisterForm />);

    fireEvent.change(screen.getByLabelText("Naam"), {
      target: { value: "Test User" },
    });
    fireEvent.change(screen.getByLabelText("E-mailadres"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Wachtwoord"), {
      target: { value: "secret123" },
    });
    fireEvent.change(screen.getByLabelText("Herhaal wachtwoord"), {
      target: { value: "different" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Account aanmaken" }));

    expect(registerMock).toHaveBeenCalledWith({
      name: "Test User",
      email: "test@example.com",
      password: "secret123",
      password_confirmation: "different",
    });
  });
});
