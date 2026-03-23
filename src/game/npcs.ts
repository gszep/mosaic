import { Assets, Container, Sprite, Texture, Rectangle } from "pixi.js";
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
  spriteTop: Sprite;
  spriteBottom: Sprite;
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
  map: TMJMap,
  collision?: Set<number>,
  autoPlace = true,
): Promise<{ bottom: Container; top: Container }> {
  const bottom = new Container();
  const top = new Container();
  npcs = [];

  try {
    const [snapshot, fallbackTexture] = await Promise.all([
      get(ref(db, "submissions")),
      Assets.load<Texture>(`${BASE}sprites/npc-default.png`),
    ]);
    if (!snapshot.exists()) return { bottom, top };

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

    // Collect all used spawn positions for auto-placement (min 48px apart)
    const MIN_NPC_DIST = TILE * 3; // 48px minimum distance between any two NPCs
    const usedSpawns: { x: number; y: number }[] = [...spawnsByNpcId.values()];
    function tooCloseToExisting(px: number, py: number): boolean {
      for (const s of usedSpawns) {
        if (Math.abs(px - s.x) < MIN_NPC_DIST && Math.abs(py - s.y) < MIN_NPC_DIST) return true;
      }
      return false;
    }

    const mapCenterX = Math.floor(map.width / 2) * TILE;
    const mapCenterY = Math.floor(map.height / 2) * TILE;

    for (const [token, sub] of Object.entries(all)) {
      if (token === "player") continue;
      let spawn = spawnsByNpcId.get(token);

      // Auto-assign a spawn position for NPCs without a map spawn point
      // Use 3-tile spacing so the player can walk between NPCs
      if (!spawn && !autoPlace) continue;
      if (!spawn) {
        const cols = map.width;
        const SPACING = TILE * 3; // 48px minimum gap between NPCs
        let placed = false;
        for (let r = 1; r < 20 && !placed; r++) {
          for (let dx = -r; dx <= r && !placed; dx++) {
            for (let dy = -r; dy <= r && !placed; dy++) {
              if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
              const px = mapCenterX + dx * SPACING;
              const py = mapCenterY + dy * SPACING;
              if (px < 0 || py < 0 || px >= map.width * TILE || py >= map.height * TILE) continue;
              if (tooCloseToExisting(px, py)) continue;
              // Skip positions where the NPC tile or the tile south are blocked
              if (collision) {
                const tx = Math.floor(px / TILE);
                const ty = Math.floor(py / TILE);
                const npcIdx = ty * cols + tx;
                const southIdx = (ty + 1) * cols + tx;
                if (collision.has(npcIdx) || collision.has(southIdx)) continue;
              }
              spawn = { x: px, y: py };
              usedSpawns.push({ x: px, y: py });
              placed = true;
            }
          }
        }
        if (!spawn) continue;
      }

      // Clear collision on the NPC tile and the tile directly south,
      // so the player (who spawns south of NPC) can always move
      if (collision) {
        const cols = map.width;
        const tx = Math.floor(spawn.x / TILE);
        const ty = Math.floor(spawn.y / TILE);
        collision.delete(ty * cols + tx);
        collision.delete((ty + 1) * cols + tx);
      }

      const texture = sub.spriteData
        ? spriteDataToTexture(sub.spriteData)
        : fallbackTexture;

      // Full sprite (hidden, used for position tracking)
      const sprite = new Sprite(texture);
      sprite.x = spawn.x;
      sprite.y = spawn.y;
      sprite.visible = false;

      // Bottom half (rendered below player)
      const bottomTex = new Texture({ source: texture.source, frame: new Rectangle(0, 8, texture.width, texture.height - 8) });
      const spriteBottom = new Sprite(bottomTex);
      spriteBottom.x = spawn.x;
      spriteBottom.y = spawn.y + 8;
      bottom.addChild(spriteBottom);

      // Top half (rendered above player)
      const topTex = new Texture({ source: texture.source, frame: new Rectangle(0, 0, texture.width, 8) });
      const spriteTop = new Sprite(topTex);
      spriteTop.x = spawn.x;
      spriteTop.y = spawn.y;
      top.addChild(spriteTop);

      npcs.push({
        token,
        name: sub.name || token,
        sprite,
        spriteTop,
        spriteBottom,
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

  return { bottom, top };
}

export function getNpcPositions(): { x: number; y: number }[] {
  return npcs.map((n) => ({ x: n.sprite.x, y: n.sprite.y }));
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
