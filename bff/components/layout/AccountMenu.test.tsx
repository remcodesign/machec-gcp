import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AccountMenu } from "./AccountMenu";
import type { AuthUser } from "@/types/auth";

const user: AuthUser = {
  customer_id: 1,
  name: "test user",
  email: "test@example.com",
};

describe("AccountMenu", () => {
  it("shows the first letter of the user's name, uppercased, instead of a login link", () => {
    render(<AccountMenu isLoading={false} onLogout={vi.fn()} user={user} />);

    expect(screen.getByRole("button")).toHaveTextContent("T");
    expect(screen.queryByRole("link", { name: /inloggen/i })).toBeNull();
  });

  it("opening the menu shows exactly one Logout action, which calls onLogout", () => {
    const onLogout = vi.fn().mockResolvedValue(true);
    render(<AccountMenu isLoading={false} onLogout={onLogout} user={user} />);

    fireEvent.click(screen.getByRole("button", { name: /accountmenu/i }));

    const menuItems = screen.getAllByRole("menuitem");
    expect(menuItems).toHaveLength(1);
    expect(menuItems[0]).toHaveTextContent("Uitloggen");

    fireEvent.click(menuItems[0]);
    expect(onLogout).toHaveBeenCalledOnce();
  });
});
