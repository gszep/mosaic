import { describe, it, expect } from "vitest";
import { calculateScale, INTERNAL_WIDTH, INTERNAL_HEIGHT } from "../viewport";

describe("calculateScale", () => {
  it("returns 4x (capped) for 1080p", () => {
    expect(calculateScale(1920, 1080)).toBe(4);
  });

  it("returns 4x (capped) for 4K", () => {
    expect(calculateScale(3840, 2160)).toBe(4);
  });

  it("returns 4x (capped) for 720p", () => {
    expect(calculateScale(1280, 720)).toBe(4);
  });

  it("returns 1x for very small viewports", () => {
    expect(calculateScale(400, 200)).toBe(2);
  });

  it("uses the smaller axis to avoid overflow", () => {
    // Wide but short: 1920/160=12, 300/90=3.3 -> floor min = 3
    expect(calculateScale(1920, 300)).toBe(3);
  });
});
