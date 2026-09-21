import { describe, expect, it } from "vitest";
import { formatPrice } from "./formatPrice";

describe("formatPrice", () => {
  it("formats whole-euro cent amounts with two decimals", () => {
    expect(formatPrice(1999)).toMatch(/^€\s?19,99$/);
  });

  it("formats zero", () => {
    expect(formatPrice(0)).toMatch(/^€\s?0,00$/);
  });
});
