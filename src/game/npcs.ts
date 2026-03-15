import { Assets, Container, Sprite, Texture } from "pixi.js";
import { db, ref, get } from "../shared/firebase";
import type { Submission } from "../shared/types";
import { spriteDataToTexture } from "./sprites";

const TILE = 16;
const BASE = import.meta.env.BASE_URL;

export async function loadNpcSprites(
  mapWidth: number,
  mapHeight: number
): Promise<Container> {
  const container = new Container();

  try {
    const [snapshot, fallbackTexture] = await Promise.all([
      get(ref(db, "submissions")),
      Assets.load<Texture>(`${BASE}sprites/npc-default.png`),
    ]);
    if (!snapshot.exists()) return container;

    const all = snapshot.val() as Record<string, Submission>;
    const submissions = Object.values(all).filter(
      (s) => s.token !== "player"
    );

    const cols = Math.ceil(Math.sqrt(submissions.length));
    const startX = Math.floor(mapWidth / 2 / TILE - cols) * TILE;
    const startY = Math.floor(mapHeight / 2 / TILE - 2) * TILE;

    for (let i = 0; i < submissions.length; i++) {
      const sub = submissions[i];

      const texture = sub.spriteData
        ? spriteDataToTexture(sub.spriteData)
        : fallbackTexture;
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
