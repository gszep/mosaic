import { Sprite, Texture, Container } from "pixi.js";
import { db, ref, get } from "../shared/firebase";
import type { Submission, SpriteData } from "../shared/types";
import type { PlayerState } from "./camera";

const TRANSPARENT = "";
const SKIN = "#D3865F";
const HAIR = "#352D2A";
const SHIRT = "#4A5270";
const PANTS = "#2E2B30";
const SHOE = "#3B3643";
const EYE = "#090B0C";
const _ = TRANSPARENT;

/* 16x32 default character placeholder */
const DEFAULT_PIXELS: string[] = [
  // row 0-1: hair top
  _,_,_,_,_,_,HAIR,HAIR,HAIR,HAIR,_,_,_,_,_,_,
  _,_,_,_,_,HAIR,HAIR,HAIR,HAIR,HAIR,HAIR,_,_,_,_,_,
  // row 2-3: hair sides + forehead
  _,_,_,_,HAIR,HAIR,HAIR,HAIR,HAIR,HAIR,HAIR,HAIR,_,_,_,_,
  _,_,_,_,HAIR,HAIR,SKIN,SKIN,SKIN,SKIN,HAIR,HAIR,_,_,_,_,
  // row 4-5: face
  _,_,_,_,HAIR,SKIN,SKIN,SKIN,SKIN,SKIN,SKIN,HAIR,_,_,_,_,
  _,_,_,_,_,SKIN,EYE,SKIN,SKIN,EYE,SKIN,_,_,_,_,_,
  // row 6-7: face bottom
  _,_,_,_,_,SKIN,SKIN,SKIN,SKIN,SKIN,SKIN,_,_,_,_,_,
  _,_,_,_,_,_,SKIN,SKIN,SKIN,SKIN,_,_,_,_,_,_,
  // row 8: neck
  _,_,_,_,_,_,_,SKIN,SKIN,_,_,_,_,_,_,_,
  // row 9-10: shoulders
  _,_,_,_,_,SHIRT,SHIRT,SHIRT,SHIRT,SHIRT,SHIRT,_,_,_,_,_,
  _,_,_,_,SHIRT,SHIRT,SHIRT,SHIRT,SHIRT,SHIRT,SHIRT,SHIRT,_,_,_,_,
  // row 11-16: torso
  _,_,_,SHIRT,SHIRT,SHIRT,SHIRT,SHIRT,SHIRT,SHIRT,SHIRT,SHIRT,SHIRT,_,_,_,
  _,_,_,SHIRT,SHIRT,SHIRT,SHIRT,SHIRT,SHIRT,SHIRT,SHIRT,SHIRT,SHIRT,_,_,_,
  _,_,_,SHIRT,SHIRT,SHIRT,SHIRT,SHIRT,SHIRT,SHIRT,SHIRT,SHIRT,SHIRT,_,_,_,
  _,_,_,SHIRT,SHIRT,SHIRT,SHIRT,SHIRT,SHIRT,SHIRT,SHIRT,SHIRT,SHIRT,_,_,_,
  _,_,_,SHIRT,SHIRT,SHIRT,SHIRT,SHIRT,SHIRT,SHIRT,SHIRT,SHIRT,SHIRT,_,_,_,
  _,_,_,SHIRT,SHIRT,SHIRT,SHIRT,SHIRT,SHIRT,SHIRT,SHIRT,SHIRT,SHIRT,_,_,_,
  _,_,_,_,SHIRT,SHIRT,SHIRT,SHIRT,SHIRT,SHIRT,SHIRT,SHIRT,_,_,_,_,
  // row 18-19: belt / waist
  _,_,_,_,PANTS,PANTS,PANTS,PANTS,PANTS,PANTS,PANTS,PANTS,_,_,_,_,
  _,_,_,_,PANTS,PANTS,PANTS,PANTS,PANTS,PANTS,PANTS,PANTS,_,_,_,_,
  // row 20-26: legs
  _,_,_,_,PANTS,PANTS,PANTS,_,_,PANTS,PANTS,PANTS,_,_,_,_,
  _,_,_,_,PANTS,PANTS,PANTS,_,_,PANTS,PANTS,PANTS,_,_,_,_,
  _,_,_,_,PANTS,PANTS,PANTS,_,_,PANTS,PANTS,PANTS,_,_,_,_,
  _,_,_,_,PANTS,PANTS,PANTS,_,_,PANTS,PANTS,PANTS,_,_,_,_,
  _,_,_,_,PANTS,PANTS,PANTS,_,_,PANTS,PANTS,PANTS,_,_,_,_,
  _,_,_,_,PANTS,PANTS,PANTS,_,_,PANTS,PANTS,PANTS,_,_,_,_,
  _,_,_,_,PANTS,PANTS,PANTS,_,_,PANTS,PANTS,PANTS,_,_,_,_,
  // row 27-28: ankles
  _,_,_,_,PANTS,PANTS,PANTS,_,_,PANTS,PANTS,PANTS,_,_,_,_,
  _,_,_,_,PANTS,PANTS,PANTS,_,_,PANTS,PANTS,PANTS,_,_,_,_,
  // row 29-31: shoes
  _,_,_,SHOE,SHOE,SHOE,SHOE,_,_,SHOE,SHOE,SHOE,SHOE,_,_,_,
  _,_,_,SHOE,SHOE,SHOE,SHOE,_,_,SHOE,SHOE,SHOE,SHOE,_,_,_,
  _,_,_,SHOE,SHOE,SHOE,SHOE,_,_,SHOE,SHOE,SHOE,SHOE,_,_,_,
];

const DEFAULT_SPRITE_DATA: SpriteData = {
  width: 16,
  height: 32,
  pixels: DEFAULT_PIXELS,
};

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

export async function loadPlayerSprite(): Promise<Sprite> {
  let data = DEFAULT_SPRITE_DATA;

  try {
    const snapshot = await get(ref(db, "submissions/player"));
    if (snapshot.exists()) {
      const sub = snapshot.val() as Submission;
      if (sub.spriteData) data = sub.spriteData;
    }
  } catch (err) {
    console.error("Failed to load player sprite:", (err as Error).message);
  }

  return new Sprite(spriteDataToTexture(data));
}

export function updatePlayerSprite(
  sprite: Sprite,
  player: PlayerState
): void {
  sprite.x = player.x;
  sprite.y = player.y;
}
