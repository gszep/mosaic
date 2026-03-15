import { Texture } from "pixi.js";
import type { SpriteData } from "../shared/types";

export function spriteDataToTexture(data: SpriteData): Texture {
  const canvas = document.createElement("canvas");
  canvas.width = data.width;
  canvas.height = data.height;
  const ctx = canvas.getContext("2d")!;
  const imageData = ctx.createImageData(data.width, data.height);

  for (let i = 0; i < data.pixels.length; i++) {
    const hex = data.pixels[i];
    const offset = i * 4;
    if (!hex) {
      imageData.data[offset + 3] = 0;
      continue;
    }
    imageData.data[offset] = parseInt(hex.slice(1, 3), 16);
    imageData.data[offset + 1] = parseInt(hex.slice(3, 5), 16);
    imageData.data[offset + 2] = parseInt(hex.slice(5, 7), 16);
    imageData.data[offset + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);
  return Texture.from(canvas);
}
