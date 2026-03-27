const BASE = import.meta.env.BASE_URL as string;
const TILE = 16;

let grassSounds: HTMLAudioElement[] = [];
let lastX = -1;
let lastY = -1;

export function initFoley(): void {
  grassSounds = [
    new Audio(`${BASE}audio/grass1.wav`),
    new Audio(`${BASE}audio/grass2.wav`),
  ];
  for (const a of grassSounds) a.volume = 0.15;
}

export function updateFoley(
  px: number,
  py: number,
  mapWidth: number,
  fieldTiles: Set<number>,
): void {
  const moving = px !== lastX || py !== lastY;
  lastX = px;
  lastY = py;

  if (!moving || fieldTiles.size === 0) return;

  // Check if player center is on a field tile
  const cx = Math.floor((px + 8) / TILE);
  const cy = Math.floor((py + 8) / TILE);
  const cols = mapWidth / TILE;
  const idx = cy * cols + cx;

  if (!fieldTiles.has(idx)) return;

  const sound = grassSounds[Math.random() < 0.5 ? 0 : 1];
  const clip = sound.cloneNode() as HTMLAudioElement;
  clip.volume = sound.volume;
  clip.play().catch(() => {});
}
