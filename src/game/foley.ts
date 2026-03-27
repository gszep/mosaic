const BASE = import.meta.env.BASE_URL as string;
const TILE = 16;
const WATER_RANGE = 2; // tiles

let grassSounds: HTMLAudioElement[] = [];
let waveAudio: HTMLAudioElement | null = null;
let lastX = -1;
let lastY = -1;

export function initFoley(): void {
  grassSounds = [
    new Audio(`${BASE}audio/grass1.wav`),
    new Audio(`${BASE}audio/grass2.wav`),
  ];
  for (const a of grassSounds) a.volume = 0.15;
}

export function initWaterAmbient(): void {
  if (waveAudio) return;
  waveAudio = new Audio(`${BASE}audio/wave.wav`);
  waveAudio.loop = true;
  waveAudio.volume = 0;
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

export function updateWaterAmbient(
  px: number,
  py: number,
  mapWidth: number,
  waterTiles: Set<number>,
): void {
  if (!waveAudio || waterTiles.size === 0) return;

  const cx = Math.floor((px + 8) / TILE);
  const cy = Math.floor((py + 8) / TILE);
  const cols = mapWidth / TILE;

  // Check if any water tile is within range
  let near = false;
  for (let dy = -WATER_RANGE; dy <= WATER_RANGE && !near; dy++) {
    for (let dx = -WATER_RANGE; dx <= WATER_RANGE && !near; dx++) {
      const idx = (cy + dy) * cols + (cx + dx);
      if (waterTiles.has(idx)) near = true;
    }
  }

  if (near) {
    if (waveAudio.paused) waveAudio.play().catch(() => {});
    // Fade in
    waveAudio.volume = Math.min(waveAudio.volume + 0.01, 0.2);
  } else {
    // Fade out
    waveAudio.volume = Math.max(waveAudio.volume - 0.01, 0);
    if (waveAudio.volume === 0 && !waveAudio.paused) waveAudio.pause();
  }
}

export function destroyWaterAmbient(): void {
  if (waveAudio) {
    waveAudio.pause();
    waveAudio = null;
  }
}
