import { describe, it, expect } from "vitest";
import { calculateScale, INTERNAL_WIDTH, INTERNAL_HEIGHT } from "../viewport";

describe("calculateScale", () => {
  it("returns 8x for 1080p", () => {
    expect(calculateScale(1920, 1080)).toBe(8);
  });

  it("returns 16x for 4K", () => {
    expect(calculateScale(3840, 2160)).toBe(16);
  });

  it("returns 5x for 720p", () => {
    // 1280/240 = 5.33, 720/135 = 5.33 -> floor = 5
    expect(calculateScale(1280, 720)).toBe(5);
  });

  it("returns 1x for very small viewports", () => {
    expect(calculateScale(400, 200)).toBe(1);
  });

  it("uses the smaller axis to avoid overflow", () => {
    // Wide but short: 1920/240=8, 300/135=2.2 -> floor min = 2
    expect(calculateScale(1920, 300)).toBe(2);
  });
});
