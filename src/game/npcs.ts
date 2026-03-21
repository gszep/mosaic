import { Assets, Container, Sprite, Texture } from "pixi.js";
import { db, ref, get } from "../shared/firebase";
import type { Submission, DialogueNode } from "../shared/types";
import type { TMJMap } from "../shared/tmj";
import { spriteDataToTexture } from "./sprites";

const TILE = 16;
const BASE = import.meta.env.BASE_URL;
const INTERACT_RANGE = 32; // pixels

export interface NpcData {
  token: string;
  name: string;
  sprite: Sprite;
  dialogueTree: DialogueNode | null;
  interacted: boolean;
}

let npcs: NpcData[] = [];

export async function loadNpcSprites(
  map: TMJMap
): Promise<Container> {
  const container = new Container();
  npcs = [];

  try {
    const [snapshot, fallbackTexture] = await Promise.all([
      get(ref(db, "submissions")),
      Assets.load<Texture>(`${BASE}sprites/npc-default.png`),
    ]);
    if (!snapshot.exists()) return container;

    const all = snapshot.val() as Record<string, Submission>;

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
      npcs.push({
        token,
        name: sub.name || token,
        sprite,
        dialogueTree: (sub.dialogueTree as DialogueNode) ?? null,
        interacted: false,
      });
    }
  } catch (err) {
    console.error("Failed to fetch submissions:", (err as Error).message);
  }

  return container;
}

export function findNearestNpc(px: number, py: number): NpcData | null {
  let best: NpcData | null = null;
  let bestDist = INTERACT_RANGE;
  for (const npc of npcs) {
    const dx = (npc.sprite.x + 8) - (px + 8);
    const dy = (npc.sprite.y + 8) - (py + 8);
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < bestDist) {
      bestDist = dist;
      best = npc;
    }
  }
  return best;
}
