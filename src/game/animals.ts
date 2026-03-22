import { Assets, Container, Sprite, Texture, Rectangle } from "pixi.js";
import type { TMJMap } from "../shared/tmj";

const BASE = import.meta.env.BASE_URL;
const ANIM_SPEED = 0.02;
const DEPTH_SPLIT = 0.75; // 75% from top = 25% from bottom

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

export function getAnimalColliders(): { x: number; y: number; w: number }[] {
  return animals.map((a) => ({
    x: a.x + (a.w - 16) / 2,
    y: a.y + Math.floor(a.h * DEPTH_SPLIT),
    w: 16,
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
}

export function destroyAnimals(): void {
  for (const a of animals) {
    a.spriteTop.destroy();
    a.spriteBottom.destroy();
  }
  animals = [];
}
