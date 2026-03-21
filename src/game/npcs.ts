import { Assets, Container, Sprite, Texture } from "pixi.js";
import { db, ref, get } from "../shared/firebase";
import type { Submission, DialogueNode } from "../shared/types";
import type { TMJMap } from "../shared/tmj";
import { spriteDataToTexture } from "./sprites";

const TILE = 16;
const BASE = import.meta.env.BASE_URL;
const INTERACT_RANGE = 32;

let emoteSprite: Sprite | null = null;
let emoteTextures = new Map<string, Texture>();
let defaultEmoteTexture: Texture | null = null;

export interface NpcData {
  token: string;
  name: string;
  sprite: Sprite;
  dialogueTree: DialogueNode | null;
  emote: string | null;
  voice: string | null;
  voiceData: string | null;
  voiceStart: number | null;
  voiceEnd: number | null;
  giftObject: string | null;
  giftSprite: string | null;
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

    for (const [token, sub] of Object.entries(all)) {
      if (token === "player") continue;
      const spawn = spawnsByNpcId.get(token);
      if (!spawn) continue;

      const texture = sub.spriteData
        ? spriteDataToTexture(sub.spriteData)
        : fallbackTexture;
      const sprite = new Sprite(texture);
      sprite.x = spawn.x;
      sprite.y = spawn.y;

      container.addChild(sprite);
      npcs.push({
        token,
        name: sub.name || token,
        sprite,
        dialogueTree: (sub.dialogueTree as DialogueNode) ?? null,
        emote: sub.emote ?? null,
        voice: sub.voice ?? null,
        voiceData: sub.voiceData ?? null,
        voiceStart: sub.voiceStart ?? null,
        voiceEnd: sub.voiceEnd ?? null,
        giftObject: sub.giftObject ?? null,
        giftSprite: sub.giftSprite ?? null,
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

export async function initEmote(world: Container): Promise<void> {
  defaultEmoteTexture = await Assets.load<Texture>(`${BASE}ui/emote-interact.png`);
  defaultEmoteTexture.source.scaleMode = "nearest";

  // Preload emotes used by NPCs
  const usedEmotes = new Set(npcs.map((n) => n.emote).filter(Boolean) as string[]);
  for (const name of usedEmotes) {
    const tex = await Assets.load<Texture>(`${BASE}ui/emotes/${name}.png`);
    tex.source.scaleMode = "nearest";
    emoteTextures.set(name, tex);
  }

  emoteSprite = new Sprite(defaultEmoteTexture);
  emoteSprite.visible = false;
  world.addChild(emoteSprite);
}

export function updateEmote(px: number, py: number, dialogueActive: boolean): void {
  if (!emoteSprite) return;

  if (dialogueActive) {
    emoteSprite.visible = false;
    return;
  }

  const npc = findNearestNpc(px, py);
  if (npc) {
    const tex = (npc.emote && emoteTextures.get(npc.emote)) || defaultEmoteTexture;
    if (tex && emoteSprite.texture !== tex) {
      emoteSprite.texture = tex;
    }
    emoteSprite.visible = true;
    emoteSprite.x = npc.sprite.x + 8 - emoteSprite.width / 2;
    emoteSprite.y = npc.sprite.y - emoteSprite.height - 2;
  } else {
    emoteSprite.visible = false;
  }
}
