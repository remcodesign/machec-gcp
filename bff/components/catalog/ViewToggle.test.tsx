import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ViewToggle } from "./ViewToggle";

describe("ViewToggle", () => {
  it("marks the active layout via aria-pressed, and calls onChange for the other one", () => {
    const onChange = vi.fn();
    render(<ViewToggle layout="grid" onChange={onChange} />);

    expect(
      screen.getByRole("button", { name: "Rasterweergave" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "Lijstweergave" }),
    ).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(screen.getByRole("button", { name: "Lijstweergave" }));
    expect(onChange).toHaveBeenCalledWith("list");
  });
});
