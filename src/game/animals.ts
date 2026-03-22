import { Assets, Container, Sprite, Texture, Rectangle } from "pixi.js";
import type { TMJMap } from "../shared/tmj";

const BASE = import.meta.env.BASE_URL;
const ANIM_SPEED = 0.02;
const DEPTH_SPLIT = 0.75;
const INTERACT_RANGE = 32;

interface Animal {
  spriteBottom: Sprite;
  spriteTop: Sprite;
  framesTop: Texture[];
  framesBottom: Texture[];
  frame: number;
  timer: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

let animals: Animal[] = [];
let heartEmote: Sprite | null = null;
let heartTexture: Texture | null = null;
let heartTimer = 0;
let heartTarget: Animal | null = null;

export async function loadAnimals(
  map: TMJMap,
  belowContainer: Container,
  aboveContainer: Container,
): Promise<void> {
  const spawns = map.layers.find((l) => l.type === "objectgroup" && l.name === "spawns");
  if (!spawns?.objects) return;

  const animalSpawns = spawns.objects.filter((o) => o.type === "animal");
  if (animalSpawns.length === 0) return;

  const sheets = new Map<string, Texture>();

  for (const obj of animalSpawns) {
    const sheet = obj.properties?.find((p) => p.name === "sheet")?.value ?? "cat";
    const numFrames = Number(obj.properties?.find((p) => p.name === "frames")?.value ?? 2);
    const frameW = Number(obj.properties?.find((p) => p.name === "frameW")?.value ?? 0);

    if (!sheets.has(sheet)) {
      const tex = await Assets.load<Texture>(`${BASE}sprites/${sheet}.png`);
      tex.source.scaleMode = "nearest";
      sheets.set(sheet, tex);
    }

    const baseTex = sheets.get(sheet)!;
    const fw = frameW || baseTex.width / numFrames;
    const fh = baseTex.height;
    const splitY = Math.floor(fh * DEPTH_SPLIT);

    const framesTop: Texture[] = [];
    const framesBottom: Texture[] = [];
    for (let i = 0; i < numFrames; i++) {
      const x = i * fw;
      framesTop.push(new Texture({ source: baseTex.source, frame: new Rectangle(x, 0, fw, splitY) }));
      framesBottom.push(new Texture({ source: baseTex.source, frame: new Rectangle(x, splitY, fw, fh - splitY) }));
    }

    const spriteTop = new Sprite(framesTop[0]);
    spriteTop.x = obj.x;
    spriteTop.y = obj.y;
    aboveContainer.addChild(spriteTop);

    const spriteBottom = new Sprite(framesBottom[0]);
    spriteBottom.x = obj.x;
    spriteBottom.y = obj.y + splitY;
    belowContainer.addChild(spriteBottom);

    animals.push({
      spriteBottom, spriteTop, framesTop, framesBottom,
      frame: Math.floor(Math.random() * numFrames),
      timer: Math.random(),
      x: obj.x, y: obj.y, w: fw, h: fh,
    });
  }
}

export async function loadHeartEmote(world: Container): Promise<void> {
  heartTexture = await Assets.load<Texture>(`${BASE}ui/emotes/emote27.png`);
  heartTexture.source.scaleMode = "nearest";
  heartEmote = new Sprite(heartTexture);
  heartEmote.visible = false;
  world.addChild(heartEmote);
}

function nearestAnimal(px: number, py: number): Animal | null {
  let best: Animal | null = null;
  let bestDist = INTERACT_RANGE;
  for (const a of animals) {
    const cx = a.x + a.w / 2;
    const cy = a.y + a.h / 2;
    const dist = Math.sqrt((cx - px - 8) ** 2 + (cy - py - 8) ** 2);
    if (dist < bestDist) { bestDist = dist; best = a; }
  }
  return best;
}

let trillAudio: HTMLAudioElement | null = null;
let trillTimer = 0;
let trillCount = 0;
const TRILL_INTERVAL = 3;
const TRILL_LENGTH = 15; // "happy birthday!" length

export function interactWithAnimal(px: number, py: number, inventory: Set<string>): boolean {
  if (!inventory.has("matilda")) return false;
  const animal = nearestAnimal(px, py);
  if (!animal || !heartEmote) return false;
  heartTarget = animal;
  heartTimer = 90;
  heartEmote.visible = true;

  if (!trillAudio) {
    trillAudio = new Audio(`${BASE}audio/voice/Voice9.wav`);
    trillAudio.volume = 0.4;
  }
  trillCount = 0;
  trillTimer = 1; // start immediately
  return true;
}

export function getAnimalColliders(): { x: number; y: number }[] {
  // NPC collision code adds +8, so subtract 8 to align with depth split
  return animals.map((a) => ({
    x: a.x + (a.w - 16) / 2,
    y: a.y + Math.floor(a.h * DEPTH_SPLIT) - 8,
  }));
}

export function updateAnimals(): void {
  for (const a of animals) {
    a.timer += ANIM_SPEED;
    if (a.timer >= 1) {
      a.timer -= 1;
      a.frame = (a.frame + 1) % a.framesTop.length;
      a.spriteTop.texture = a.framesTop[a.frame];
      a.spriteBottom.texture = a.framesBottom[a.frame];
    }
  }

  if (heartEmote && heartTarget) {
    if (heartTimer > 0) {
      heartTimer--;
      heartEmote.x = heartTarget.x + heartTarget.w / 2 - heartEmote.width / 2;
      heartEmote.y = heartTarget.y + 2;
    } else {
      heartEmote.visible = false;
      heartTarget = null;
    }
  }

  if (trillAudio && trillCount < TRILL_LENGTH) {
    trillTimer--;
    if (trillTimer <= 0) {
      trillAudio.currentTime = 0;
      trillAudio.play().catch(() => {});
      trillCount++;
      trillTimer = TRILL_INTERVAL;
    }
  }
}

export function destroyAnimals(): void {
  for (const a of animals) {
    a.spriteTop.destroy();
    a.spriteBottom.destroy();
  }
  animals = [];
  if (heartEmote) { heartEmote.destroy(); heartEmote = null; }
  heartTarget = null;
  heartTimer = 0;
}
