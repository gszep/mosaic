import { describe, it, expect } from "vitest";
import { createCamera, createPlayer, updateCamera } from "../camera";

describe("updateCamera", () => {
  it("centers camera on player", () => {
    const player = createPlayer(320, 240);
    const cam = createCamera();
    updateCamera(cam, player, 640, 480);
    // camera.x = player.x + 8 - 240 = 328 - 240 = 88
    // camera.y = player.y + 8 - 135 = 248 - 135 = 113
    expect(cam.x).toBe(88);
    expect(cam.y).toBe(113);
  });

  it("clamps to zero at top-left", () => {
    const player = createPlayer(0, 0);
    const cam = createCamera();
    updateCamera(cam, player, 640, 480);
    expect(cam.x).toBe(0);
    expect(cam.y).toBe(0);
  });

  it("clamps to max at bottom-right", () => {
    const player = createPlayer(9999, 9999);
    const cam = createCamera();
    updateCamera(cam, player, 640, 480);
    // maxX = 640 - 480 = 160, maxY = 480 - 270 = 210
    expect(cam.x).toBe(160);
    expect(cam.y).toBe(210);
  });
});
