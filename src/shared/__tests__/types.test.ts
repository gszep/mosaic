import { describe, it, expect } from "vitest";
import type { SpriteData } from "../types";

describe("SpriteData", () => {
  it("accepts a valid 16x16 pixel grid", () => {
    const data: SpriteData = {
      width: 16,
      height: 16,
      pixels: Array(16 * 16).fill("#000000"),
    };
    expect(data.pixels).toHaveLength(256);
  });
});
