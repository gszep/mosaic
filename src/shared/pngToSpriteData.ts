import type { SpriteData } from "./types";
import { TRANSPARENT } from "./palette";

/**
 * Load a PNG image URL and convert it to SpriteData.
 * Extracts per-pixel hex colors from the image, treating
 * transparent pixels as TRANSPARENT ("").
 */
export async function pngToSpriteData(url: string): Promise<SpriteData> {
  const img = await loadImage(url);
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, img.width, img.height);
  const pixels: string[] = [];

  for (let i = 0; i < imageData.data.length; i += 4) {
    const a = imageData.data[i + 3];
    if (a < 128) {
      pixels.push(TRANSPARENT);
    } else {
      const r = imageData.data[i].toString(16).padStart(2, "0");
      const g = imageData.data[i + 1].toString(16).padStart(2, "0");
      const b = imageData.data[i + 2].toString(16).padStart(2, "0");
      pixels.push(`#${r}${g}${b}`.toUpperCase());
    }
  }

  return { width: 16, height: 16, pixels };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}