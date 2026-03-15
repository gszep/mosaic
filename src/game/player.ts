import { Assets, Sprite, Texture } from "pixi.js";
import { db, ref, get } from "../shared/firebase";
import type { Submission, SpriteData } from "../shared/types";
import type { PlayerState } from "./camera";
import { spriteDataToTexture } from "./sprites";

const BASE = import.meta.env.BASE_URL;

export async function loadPlayerSprite(): Promise<Sprite> {
  try {
    const snapshot = await get(ref(db, "submissions/player"));
    if (snapshot.exists()) {
      const sub = snapshot.val() as Submission;
      if (sub.spriteData) {
        return new Sprite(spriteDataToTexture(sub.spriteData));
      }
    }
  } catch (err) {
    console.error("Failed to load player sprite:", (err as Error).message);
  }

  const texture = await Assets.load<Texture>(`${BASE}sprites/player-default.png`);
  return new Sprite(texture);
}

export function updatePlayerSprite(
  sprite: Sprite,
  player: PlayerState
): void {
  sprite.x = player.x;
  sprite.y = player.y;
}
