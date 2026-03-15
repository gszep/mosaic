import { Container } from "pixi.js";
import { INTERNAL_WIDTH, INTERNAL_HEIGHT } from "./viewport";

const PLAYER_SPEED = 2; // pixels per frame

export interface PlayerState {
  x: number;
  y: number;
}

interface CameraState {
  x: number;
  y: number;
}

const keys: Record<string, boolean> = {};

export function initInput(): () => void {
  const onKeyDown = (e: KeyboardEvent) => { keys[e.key] = true; };
  const onKeyUp = (e: KeyboardEvent) => { keys[e.key] = false; };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  return () => {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
  };
}

export function createPlayer(x: number, y: number): PlayerState {
  return { x, y };
}

export function createCamera(): CameraState {
  return { x: 0, y: 0 };
}

export function updatePlayer(
  player: PlayerState,
  mapWidth: number,
  mapHeight: number
): void {
  if (keys["ArrowLeft"] || keys["a"]) player.x -= PLAYER_SPEED;
  if (keys["ArrowRight"] || keys["d"]) player.x += PLAYER_SPEED;
  if (keys["ArrowUp"] || keys["w"]) player.y -= PLAYER_SPEED;
  if (keys["ArrowDown"] || keys["s"]) player.y += PLAYER_SPEED;

  player.x = Math.max(0, Math.min(player.x, mapWidth - 16));
  player.y = Math.max(0, Math.min(player.y, mapHeight - 16));
}

export function updateCamera(
  camera: CameraState,
  player: PlayerState,
  mapWidth: number,
  mapHeight: number
): void {
  camera.x = player.x + 8 - INTERNAL_WIDTH / 2;
  camera.y = player.y + 8 - INTERNAL_HEIGHT / 2;

  const maxX = Math.max(0, mapWidth - INTERNAL_WIDTH);
  const maxY = Math.max(0, mapHeight - INTERNAL_HEIGHT);
  camera.x = Math.max(0, Math.min(camera.x, maxX));
  camera.y = Math.max(0, Math.min(camera.y, maxY));

  // Keep player within the camera viewport so movement stays responsive at edges
  player.x = Math.max(camera.x, Math.min(player.x, camera.x + INTERNAL_WIDTH - 16));
  player.y = Math.max(camera.y, Math.min(player.y, camera.y + INTERNAL_HEIGHT - 16));
}

export function applyCamera(stage: Container, camera: CameraState): void {
  const tx = -Math.round(camera.x);
  const ty = -Math.round(camera.y);
  if (stage.x === tx && stage.y === ty) return;
  stage.x = tx;
  stage.y = ty;
}
