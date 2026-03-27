import { Container } from "pixi.js";
import { INTERNAL_WIDTH, INTERNAL_HEIGHT } from "./viewport";

const PLAYER_SPEED = 1.5; // pixels per frame

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

const TILE = 16;

export interface NpcCollider {
  x: number;
  y: number;
}

export interface HalfCollision {
  left: Set<number>;   // blocks left 8px of tile
  right: Set<number>;  // blocks right 8px of tile
}

const HITBOX = 14; // 14x14 collision box, inset 1px from each edge of the 16x16 sprite
const HB_OFF = (TILE - HITBOX) / 2; // 1px inset

function blocked(x: number, y: number, mapWidth: number, collision: Set<number>, npcs?: NpcCollider[], depthTiles?: Set<number>, half?: HalfCollision): boolean {
  const cols = mapWidth / TILE;
  const HALF = TILE / 2;
  const x0 = x + HB_OFF;
  const y0 = y + HB_OFF;
  const x1 = x0 + HITBOX - 1;
  const y1 = y0 + HITBOX - 1;
  for (const [px, py] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) {
    const tx = Math.floor(px / TILE);
    const ty = Math.floor(py / TILE);
    const idx = ty * cols + tx;
    if (depthTiles?.has(idx)) {
      // Center-band collision: 2px band at tile center (rows 7-8, symmetrical)
      const bandTop = ty * TILE + TILE / 2 - 1;
      if (y0 < bandTop + 2 && y0 + HITBOX > bandTop) return true;
    } else if (half?.left.has(idx)) {
      // Only left 8px of tile blocks
      if (px < tx * TILE + HALF) return true;
    } else if (half?.right.has(idx)) {
      // Only right 8px of tile blocks
      if (px >= tx * TILE + HALF) return true;
    } else if (collision.has(idx)) {
      return true;
    }
  }
  if (npcs) {
    for (const npc of npcs) {
      // 2px horizontal collision band at NPC's vertical center (symmetrical)
      const npcBandTop = npc.y + 7;
      const overlapsX = x0 < npc.x + 16 && x0 + HITBOX > npc.x;
      const overlapsY = y0 < npcBandTop + 2 && y0 + HITBOX > npcBandTop;
      if (overlapsX && overlapsY) return true;
    }
  }
  return false;
}

export function updatePlayer(
  player: PlayerState,
  mapWidth: number,
  mapHeight: number,
  collision?: Set<number>,
  npcs?: NpcCollider[],
  depthTiles?: Set<number>,
  half?: HalfCollision,
): void {
  let dx = 0;
  let dy = 0;
  if (keys["ArrowLeft"] || keys["a"]) dx -= PLAYER_SPEED;
  if (keys["ArrowRight"] || keys["d"]) dx += PLAYER_SPEED;
  if (keys["ArrowUp"] || keys["w"]) dy -= PLAYER_SPEED;
  if (keys["ArrowDown"] || keys["s"]) dy += PLAYER_SPEED;

  if (collision) {
    // Try X then Y independently for wall sliding
    const nx = Math.max(0, Math.min(player.x + dx, mapWidth - 16));
    if (!blocked(nx, player.y, mapWidth, collision, npcs, depthTiles, half)) {
      player.x = nx;
    }
    const ny = Math.max(0, Math.min(player.y + dy, mapHeight - 16));
    if (!blocked(player.x, ny, mapWidth, collision, npcs, depthTiles, half)) {
      player.y = ny;
    }
  } else {
    player.x = Math.max(0, Math.min(player.x + dx, mapWidth - 16));
    player.y = Math.max(0, Math.min(player.y + dy, mapHeight - 16));
  }
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
