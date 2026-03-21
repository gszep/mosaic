import { Assets, Container, Sprite, Texture } from "pixi.js";
import { db, ref, get } from "../shared/firebase";
import type { Submission } from "../shared/types";
import type { TMJMap } from "../shared/tmj";
import { spriteDataToTexture } from "./sprites";

const TILE = 16;
const BASE = import.meta.env.BASE_URL;

export async function loadNpcSprites(
  map: TMJMap
): Promise<Container> {
  const container = new Container();

  try {
    const [snapshot, fallbackTexture] = await Promise.all([
      get(ref(db, "submissions")),
      Assets.load<Texture>(`${BASE}sprites/npc-default.png`),
    ]);
    if (!snapshot.exists()) return container;

    const all = snapshot.val() as Record<string, Submission>;

    // Read spawn positions from map
    const spawnsLayer = map.layers.find(
      (l) => l.type === "objectgroup" && l.name === "spawns"
    );
    const spawnsByNpcId = new Map<string, { x: number; y: number }>();
    if (spawnsLayer?.objects) {
      for (const obj of spawnsLayer.objects) {
        const npcId = obj.properties?.find((p) => p.name === "npcId")?.value;
        if (npcId) spawnsByNpcId.set(npcId, { x: obj.x, y: obj.y });
      }
    }

    // Fallback grid for NPCs without spawn points
    const unplaced = Object.entries(all).filter(
      ([token]) => token !== "player" && !spawnsByNpcId.has(token)
    );
    const cols = Math.max(1, Math.ceil(Math.sqrt(unplaced.length)));
    const startX = Math.floor(map.width / 2 - cols) * TILE;
    const startY = Math.floor(map.height / 2 - 2) * TILE;

    let fallbackIdx = 0;
    for (const [token, sub] of Object.entries(all)) {
      if (token === "player") continue;

      const texture = sub.spriteData
        ? spriteDataToTexture(sub.spriteData)
        : fallbackTexture;
      const sprite = new Sprite(texture);

      const spawn = spawnsByNpcId.get(token);
      if (spawn) {
        sprite.x = spawn.x;
        sprite.y = spawn.y;
      } else {
        const col = fallbackIdx % cols;
        const row = Math.floor(fallbackIdx / cols);
        sprite.x = startX + col * TILE * 3;
        sprite.y = startY + row * TILE * 3;
        fallbackIdx++;
      }

      container.addChild(sprite);
    }
  } catch (err) {
    console.error("Failed to fetch submissions:", (err as Error).message);
  }

  return container;
}
