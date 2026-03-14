import { Container } from "pixi.js";
import { INTERNAL_WIDTH, INTERNAL_HEIGHT } from "./viewport";

const SPEED = 2; // pixels per frame

interface CameraState {
  x: number;
  y: number;
}

const keys: Record<string, boolean> = {};

export function initInput(): void {
  window.addEventListener("keydown", (e) => {
    keys[e.key] = true;
  });
  window.addEventListener("keyup", (e) => {
    keys[e.key] = false;
  });
}

export function createCamera(): CameraState {
  return { x: 0, y: 0 };
}

export function updateCamera(
  camera: CameraState,
  mapWidth: number,
  mapHeight: number
): void {
  if (keys["ArrowLeft"] || keys["a"]) camera.x -= SPEED;
  if (keys["ArrowRight"] || keys["d"]) camera.x += SPEED;
  if (keys["ArrowUp"] || keys["w"]) camera.y -= SPEED;
  if (keys["ArrowDown"] || keys["s"]) camera.y += SPEED;

  // Clamp so camera doesn't go past map edges.
  const maxX = Math.max(0, mapWidth - INTERNAL_WIDTH);
  const maxY = Math.max(0, mapHeight - INTERNAL_HEIGHT);
  camera.x = Math.max(0, Math.min(camera.x, maxX));
  camera.y = Math.max(0, Math.min(camera.y, maxY));
}

export function applyCamera(stage: Container, camera: CameraState): void {
  stage.x = -camera.x;
  stage.y = -camera.y;
}
