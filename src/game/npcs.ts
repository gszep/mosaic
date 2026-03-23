import { Assets, Container, Sprite, Texture, Rectangle } from "pixi.js";
import { db, ref, get, update } from "../shared/firebase";
import type { Submission, DialogueNode } from "../shared/types";
import type { TMJMap } from "../shared/tmj";
import { spriteDataToTexture } from "./sprites";

const TILE = 16;
const BASE = import.meta.env.BASE_URL;
const INTERACT_RANGE = 32;
const MIN_NPC_DIST = TILE * 3; // 48px minimum distance between any two NPCs
const SPACING = TILE * 3; // auto-placement grid step

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

/** Find a free spawn position on the village map, avoiding collisions and other NPCs. */
function findSpawnPosition(
  map: TMJMap,
  collision: Set<number> | undefined,
  usedSpawns: { x: number; y: number }[],
): { x: number; y: number } | null {
  const cols = map.width;
  const mapCenterX = Math.floor(map.width / 2) * TILE;
  const mapCenterY = Math.floor(map.height / 2) * TILE;

  for (let r = 1; r < 20; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const px = mapCenterX + dx * SPACING;
        const py = mapCenterY + dy * SPACING;
        if (px < 0 || py < 0 || px >= map.width * TILE || py >= map.height * TILE) continue;

        // Check minimum distance from all existing spawns
        let tooClose = false;
        for (const s of usedSpawns) {
          if (Math.abs(px - s.x) < MIN_NPC_DIST && Math.abs(py - s.y) < MIN_NPC_DIST) {
            tooClose = true;
            break;
          }
        }
        if (tooClose) continue;

        // Skip positions where the NPC tile or the tile south are blocked
        if (collision) {
          const tx = Math.floor(px / TILE);
          const ty = Math.floor(py / TILE);
          const npcIdx = ty * cols + tx;
          const southIdx = (ty + 1) * cols + tx;
          if (collision.has(npcIdx) || collision.has(southIdx)) continue;
        }

        return { x: px, y: py };
      }
    }
  }
  return null;
}

export async function loadNpcSprites(
  mapName: string,
  map: TMJMap,
  collision?: Set<number>,
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

    // Collect positions of all NPCs already placed on this map
    const usedSpawns: { x: number; y: number }[] = [];
    for (const sub of Object.values(all)) {
      if (sub.map === mapName && sub.spawnX != null && sub.spawnY != null) {
        usedSpawns.push({ x: sub.spawnX, y: sub.spawnY });
      }
    }

    for (const [token, sub] of Object.entries(all)) {
      if (token === "player") continue;

      let x: number | null = null;
      let y: number | null = null;

      if (sub.map === mapName && sub.spawnX != null && sub.spawnY != null) {
        // NPC is assigned to this map with a position
        x = sub.spawnX;
        y = sub.spawnY;
      } else if (sub.map == null && mapName === "village") {
        // Unplaced NPC — auto-assign to village
        const pos = findSpawnPosition(map, collision, usedSpawns);
        if (!pos) continue;
        x = pos.x;
        y = pos.y;
        usedSpawns.push(pos);

        // Write position back to Firebase so it persists
        update(ref(db, `submissions/${token}`), {
          map: "village",
          spawnX: x,
          spawnY: y,
        }).catch((err) =>
          console.warn(`Failed to save spawn for ${token}:`, err)
        );
      } else {
        // NPC belongs to a different map — skip
        continue;
      }

      // Clear collision on the NPC tile and the tile directly south,
      // so the player can always move near NPCs
      if (collision) {
        const cols = map.width;
        const tx = Math.floor(x / TILE);
        const ty = Math.floor(y / TILE);
        collision.delete(ty * cols + tx);
        collision.delete((ty + 1) * cols + tx);
      }

      const texture = sub.spriteData
        ? spriteDataToTexture(sub.spriteData)
        : fallbackTexture;

      // Full sprite (hidden, used for position tracking)
      const sprite = new Sprite(texture);
      sprite.x = x;
      sprite.y = y;
      sprite.visible = false;

      // Bottom half (rendered below player)
      const bottomTex = new Texture({ source: texture.source, frame: new Rectangle(0, 8, texture.width, texture.height - 8) });
      const spriteBottom = new Sprite(bottomTex);
      spriteBottom.x = x;
      spriteBottom.y = y + 8;
      bottom.addChild(spriteBottom);

      // Top half (rendered above player)
      const topTex = new Texture({ source: texture.source, frame: new Rectangle(0, 0, texture.width, 8) });
      const spriteTop = new Sprite(topTex);
      spriteTop.x = x;
      spriteTop.y = y;
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
