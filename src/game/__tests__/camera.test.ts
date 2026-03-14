import { describe, it, expect } from "vitest";
import { createCamera, updateCamera } from "../camera";

describe("updateCamera", () => {
  it("clamps to zero at top-left", () => {
    const cam = createCamera();
    cam.x = -10;
    cam.y = -10;
    updateCamera(cam, 640, 480);
    expect(cam.x).toBe(0);
    expect(cam.y).toBe(0);
  });

  it("clamps to max at bottom-right", () => {
    const cam = createCamera();
    cam.x = 9999;
    cam.y = 9999;
    updateCamera(cam, 640, 480);
    // maxX = 640 - 480 = 160, maxY = 480 - 270 = 210
    expect(cam.x).toBe(160);
    expect(cam.y).toBe(210);
  });
});
