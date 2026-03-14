import { describe, it, expect } from "vitest";
import { calculateScale, INTERNAL_WIDTH, INTERNAL_HEIGHT } from "../viewport";

describe("calculateScale", () => {
  it("returns 4x for 1080p", () => {
    expect(calculateScale(1920, 1080)).toBe(4);
  });

  it("returns 8x for 4K", () => {
    expect(calculateScale(3840, 2160)).toBe(8);
  });

  it("returns 2x for 720p", () => {
    // 1280/480 = 2.67, 720/270 = 2.67 -> floor = 2
    expect(calculateScale(1280, 720)).toBe(2);
  });

  it("returns 1x for very small viewports", () => {
    expect(calculateScale(400, 200)).toBe(1);
  });

  it("uses the smaller axis to avoid overflow", () => {
    // Wide but short: 1920/480=4, 300/270=1.1 -> floor min = 1
    expect(calculateScale(1920, 300)).toBe(1);
  });
});
