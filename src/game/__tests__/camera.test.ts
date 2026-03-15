import { describe, it, expect } from "vitest";
import { createCamera, createPlayer, updateCamera } from "../camera";

describe("updateCamera", () => {
  it("centers camera on player", () => {
    const player = createPlayer(320, 240);
    const cam = createCamera();
    updateCamera(cam, player, 640, 480);
    // camera.x = player.x + 8 - 120 = 328 - 120 = 208
    // camera.y = player.y + 8 - 67.5 = 248 - 67.5 = 180.5
    expect(cam.x).toBe(208);
    expect(cam.y).toBe(180.5);
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
    // maxX = 640 - 240 = 400, maxY = 480 - 135 = 345
    expect(cam.x).toBe(400);
    expect(cam.y).toBe(345);
  });
});
