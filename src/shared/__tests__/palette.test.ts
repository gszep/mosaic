import { describe, it, expect } from "vitest";
import { PALETTE, TRANSPARENT } from "../palette";

describe("palette", () => {
  it("contains at least 10 colors", () => {
    expect(PALETTE.length).toBeGreaterThanOrEqual(10);
  });

  it("all entries are valid uppercase hex colors", () => {
    for (const color of PALETTE) {
      expect(color).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it("has no duplicates", () => {
    expect(new Set(PALETTE).size).toBe(PALETTE.length);
  });

  it("TRANSPARENT is empty string", () => {
    expect(TRANSPARENT).toBe("");
  });
});
