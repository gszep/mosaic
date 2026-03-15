import { Container, Sprite, Texture } from "pixi.js";
import { db, ref, get } from "../shared/firebase";
import type { Submission, SpriteData } from "../shared/types";

const TILE = 16;

function spriteDataToTexture(data: SpriteData): Texture {
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

export async function loadNpcSprites(
  mapWidth: number,
  mapHeight: number
): Promise<Container> {
  const container = new Container();

  try {
    const snapshot = await get(ref(db, "submissions"));
    if (!snapshot.exists()) return container;

    const all = snapshot.val() as Record<string, Submission>;
    const submissions = Object.values(all).filter(
      (s) => s.spriteData != null && s.token !== "player"
    );

    const cols = Math.ceil(Math.sqrt(submissions.length));
    const startX = Math.floor(mapWidth / 2 / TILE - cols) * TILE;
    const startY = Math.floor(mapHeight / 2 / TILE - 2) * TILE;

    for (let i = 0; i < submissions.length; i++) {
      const sub = submissions[i];

      const texture = spriteDataToTexture(sub.spriteData!);
      const sprite = new Sprite(texture);
      const col = i % cols;
      const row = Math.floor(i / cols);
      sprite.x = startX + col * TILE * 3;
      sprite.y = startY + row * TILE * 3;
      container.addChild(sprite);
    }
  } catch (err) {
    console.error("Failed to fetch submissions:", (err as Error).message);
  }

  return container;
}
