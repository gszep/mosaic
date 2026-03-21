import { Application } from "pixi.js";

export const INTERNAL_WIDTH = 160;
export const INTERNAL_HEIGHT = 90;

export function calculateScale(viewportW: number, viewportH: number): number {
  const scaleX = Math.floor(viewportW / INTERNAL_WIDTH);
  const scaleY = Math.floor(viewportH / INTERNAL_HEIGHT);
  return Math.max(1, Math.min(scaleX, scaleY));
}

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

  const controls = document.querySelector(".controls") as HTMLElement | null;
  if (controls) {
    const canvasBottom = (vh - canvasH) / 2 + canvasH;
    controls.style.top = `${canvasBottom + 8}px`;
  }
}
