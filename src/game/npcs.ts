import { Assets, Container, Sprite, Texture, Rectangle } from "pixi.js";
import { db, ref, get, update } from "../shared/firebase";
import type { Submission, DialogueNode } from "../shared/types";
import type { TMJMap } from "../shared/tmj";
import { spriteDataToTexture } from "./sprites";

const TILE = 16;
const BASE = import.meta.env.BASE_URL;
const INTERACT_RANGE = 32;
const MIN_NPC_DIST = TILE * 3; // 48px minimum distance between any two NPCs
const GRID_STEP = 3; // auto-placement grid step in tiles

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

/** Find a free spawn position on the map using a grid scan, avoiding collisions and other NPCs. */
function findSpawnPosition(
  map: TMJMap,
  collision: Set<number> | undefined,
  usedSpawns: { x: number; y: number }[],
): { x: number; y: number } | null {
  const cols = map.width;

  for (let ty = 0; ty < map.height - 1; ty += GRID_STEP) {
    for (let tx = 0; tx < map.width; tx += GRID_STEP) {
      const px = tx * TILE;
      const py = ty * TILE;

      // Skip if tile or tile south is blocked
      if (collision) {
        if (collision.has(ty * cols + tx) || collision.has((ty + 1) * cols + tx)) continue;
      }

      // Skip if too close to an existing NPC
      if (usedSpawns.some(s => Math.abs(px - s.x) < MIN_NPC_DIST && Math.abs(py - s.y) < MIN_NPC_DIST)) continue;

      return { x: px, y: py };
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

    // Also exclude animal positions from auto-placement
    const spawnsLayer = map.layers.find((l) => l.type === "objectgroup" && l.name === "spawns");
    if (spawnsLayer?.objects) {
      for (const obj of spawnsLayer.objects) {
        if (obj.type === "animal") {
          usedSpawns.push({ x: obj.x, y: obj.y });
        }
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

export function getAllNpcs(): { token: string; name: string }[] {
  return npcs.map((n) => ({ token: n.token, name: n.name }));
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

  // Preload emotes used by NPCs + pot-reaction emotes
  const usedEmotes = new Set(npcs.map((n) => n.emote).filter(Boolean) as string[]);
  usedEmotes.add("emote10");
  usedEmotes.add("emote12");
  for (const name of usedEmotes) {
    const tex = await Assets.load<Texture>(`${BASE}ui/emotes/${name}.png`);
    tex.source.scaleMode = "nearest";
    emoteTextures.set(name, tex);
  }

  emoteSprite = new Sprite(defaultEmoteTexture);
  emoteSprite.visible = false;
  world.addChild(emoteSprite);
}

const INDOOR_TINT = 0xd0c8c0;

// Per-token emote overrides and always-visible flags
const emoteOverrides = new Map<string, string>();
const alwaysShowEmote = new Set<string>();

export function setEmoteOverride(token: string, emote: string, alwaysVisible: boolean): void {
  emoteOverrides.set(token, emote);
  if (alwaysVisible) alwaysShowEmote.add(token);
}

let overrideSprites: Sprite[] = [];

export function updateEmote(px: number, py: number, dialogueActive: boolean, indoor = false): void {
  if (!emoteSprite) return;

  // Clean up previous always-visible override sprites
  for (const s of overrideSprites) s.destroy();
  overrideSprites = [];

  if (dialogueActive) {
    emoteSprite.visible = false;
    return;
  }

  // Render always-visible emote overrides
  for (const npc of npcs) {
    if (!alwaysShowEmote.has(npc.token)) continue;
    const emoteName = emoteOverrides.get(npc.token);
    const tex = emoteName ? emoteTextures.get(emoteName) : null;
    if (!tex) continue;
    const s = new Sprite(tex);
    s.tint = indoor ? INDOOR_TINT : 0xffffff;
    s.x = npc.sprite.x + 8 - s.width / 2;
    s.y = npc.sprite.y - s.height - 2;
    emoteSprite.parent?.addChild(s);
    overrideSprites.push(s);
  }

  const npc = findNearestNpc(px, py);
  if (npc && !alwaysShowEmote.has(npc.token)) {
    const emoteName = emoteOverrides.get(npc.token) ?? npc.emote;
    const tex = (emoteName && emoteTextures.get(emoteName)) || defaultEmoteTexture;
    if (tex && emoteSprite.texture !== tex) {
      emoteSprite.texture = tex;
    }
    emoteSprite.tint = indoor ? INDOOR_TINT : 0xffffff;
    emoteSprite.visible = true;
    emoteSprite.x = npc.sprite.x + 8 - emoteSprite.width / 2;
    emoteSprite.y = npc.sprite.y - emoteSprite.height - 2;
  } else {
    emoteSprite.visible = false;
  }
}
