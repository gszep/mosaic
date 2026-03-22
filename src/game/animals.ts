import { Assets, Container, Sprite, Texture, Rectangle } from "pixi.js";
import type { TMJMap } from "../shared/tmj";

const BASE = import.meta.env.BASE_URL;
const ANIM_SPEED = 0.02;

interface Animal {
  sprite: Sprite;
  frames: Texture[];
  frame: number;
  timer: number;
}

let animals: Animal[] = [];

export async function loadAnimals(map: TMJMap, world: Container): Promise<void> {
  const spawns = map.layers.find((l) => l.type === "objectgroup" && l.name === "spawns");
  if (!spawns?.objects) return;

  const animalSpawns = spawns.objects.filter((o) => o.type === "animal");
  if (animalSpawns.length === 0) return;

  const sheets = new Map<string, Texture>();

  for (const obj of animalSpawns) {
    const sheet = obj.properties?.find((p) => p.name === "sheet")?.value ?? "cat";
    const cols = Number(obj.properties?.find((p) => p.name === "frames")?.value ?? 2);

    if (!sheets.has(sheet)) {
      const tex = await Assets.load<Texture>(`${BASE}sprites/${sheet}.png`);
      tex.source.scaleMode = "nearest";
      sheets.set(sheet, tex);
    }

    const baseTex = sheets.get(sheet)!;
    const fw = baseTex.width / cols;
    const fh = baseTex.height;
    const frames: Texture[] = [];
    for (let i = 0; i < cols; i++) {
      frames.push(new Texture({ source: baseTex.source, frame: new Rectangle(i * fw, 0, fw, fh) }));
    }

    const sprite = new Sprite(frames[0]);
    sprite.x = obj.x;
    sprite.y = obj.y;
    world.addChild(sprite);

    animals.push({ sprite, frames, frame: 0, timer: Math.random() });
  }
}

export function updateAnimals(): void {
  for (const a of animals) {
    a.timer += ANIM_SPEED;
    if (a.timer >= 1) {
      a.timer -= 1;
      a.frame = (a.frame + 1) % a.frames.length;
      a.sprite.texture = a.frames[a.frame];
    }
  }
}

export function destroyAnimals(): void {
  for (const a of animals) a.sprite.destroy();
  animals = [];
}
