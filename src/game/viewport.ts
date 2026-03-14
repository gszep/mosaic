import { Application } from "pixi.js";

export const INTERNAL_WIDTH = 480;
export const INTERNAL_HEIGHT = 270;

/**
 * Calculate the largest integer scale factor that fits the viewport.
 * Returns at minimum 1.
 */
export function calculateScale(viewportW: number, viewportH: number): number {
  const scaleX = Math.floor(viewportW / INTERNAL_WIDTH);
  const scaleY = Math.floor(viewportH / INTERNAL_HEIGHT);
  return Math.max(1, Math.min(scaleX, scaleY));
}

/**
 * Resize and center the PixiJS canvas within the viewport.
 */
export function applyViewport(app: Application): void {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const scale = calculateScale(vw, vh);
  const canvasW = INTERNAL_WIDTH * scale;
  const canvasH = INTERNAL_HEIGHT * scale;

  app.renderer.resize(INTERNAL_WIDTH, INTERNAL_HEIGHT);
  const canvas = app.canvas as HTMLCanvasElement;
  canvas.style.width = `${canvasW}px`;
  canvas.style.height = `${canvasH}px`;
  canvas.style.position = "absolute";
  canvas.style.left = `${(vw - canvasW) / 2}px`;
  canvas.style.top = `${(vh - canvasH) / 2}px`;
  canvas.style.imageRendering = "pixelated";
}
