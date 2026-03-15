import { describe, it, expect } from "vitest";
import { createCamera, createPlayer, updateCamera } from "../camera";

describe("updateCamera", () => {
  it("centers camera on player", () => {
    const player = createPlayer(320, 240);
    const cam = createCamera();
    updateCamera(cam, player, 640, 480);
    // camera.x = player.x + 8 - 80 = 328 - 80 = 248
    // camera.y = player.y + 8 - 45 = 248 - 45 = 203
    expect(cam.x).toBe(248);
    expect(cam.y).toBe(203);
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
    // maxX = 640 - 160 = 480, maxY = 480 - 90 = 390
    expect(cam.x).toBe(480);
    expect(cam.y).toBe(390);
  });
});
