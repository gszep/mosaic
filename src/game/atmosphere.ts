import { Assets, Container, Sprite, Texture, Rectangle } from "pixi.js";
import { INTERNAL_WIDTH, INTERNAL_HEIGHT } from "./viewport";

const BASE = import.meta.env.BASE_URL;
const PETAL_COUNT = 12;
const PETAL_FRAME_W = 8;
const PETAL_FRAME_H = 7;
const PETAL_FRAMES = 9;
const PETAL_ANIM_SPEED = 0.08;

interface Petal {
  sprite: Sprite;
  x: number;
  y: number;
  vx: number;
  vy: number;
  frame: number;
  frameTimer: number;
  textures: Texture[];
}

let petals: Petal[] = [];
let petalContainer: Container | null = null;
let raylightSprite: Sprite | null = null;
let raylightTimer = 0;

export async function initAtmosphere(world: Container): Promise<void> {
  // Cherry blossom petals
  const leafTex = await Assets.load<Texture>(`${BASE}ui/leaf-pink.png`);
  leafTex.source.scaleMode = "nearest";

  const frames: Texture[] = [];
  for (let i = 0; i < PETAL_FRAMES; i++) {
    frames.push(new Texture({
      source: leafTex.source,
      frame: new Rectangle(i * PETAL_FRAME_W, 0, PETAL_FRAME_W, PETAL_FRAME_H),
    }));
  }

  petalContainer = new Container();
  world.addChild(petalContainer);

  for (let i = 0; i < PETAL_COUNT; i++) {
    const sprite = new Sprite(frames[0]);
    sprite.alpha = 0.7 + Math.random() * 0.3;
    petalContainer.addChild(sprite);

    petals.push({
      sprite,
      x: Math.random() * INTERNAL_WIDTH * 4,
      y: Math.random() * INTERNAL_HEIGHT * 4 - INTERNAL_HEIGHT,
      vx: -0.2 - Math.random() * 0.3,
      vy: 0.15 + Math.random() * 0.25,
      frame: Math.random() * PETAL_FRAMES | 0,
      frameTimer: Math.random(),
      textures: frames,
    });
  }

  // Raylight overlay
  const rayTex = await Assets.load<Texture>(`${BASE}ui/raylight.png`);
  rayTex.source.scaleMode = "nearest";
  raylightSprite = new Sprite(rayTex);
  raylightSprite.alpha = 0;
  raylightSprite.x = 0;
  raylightSprite.y = 0;
  world.addChild(raylightSprite);
}

export function updateAtmosphere(cameraX: number, cameraY: number): void {
  // Update petals
  for (const p of petals) {
    p.x += p.vx;
    p.y += p.vy;

    // Wrap around viewport
    const screenX = p.x - cameraX;
    const screenY = p.y - cameraY;
    if (screenX < -PETAL_FRAME_W) p.x += INTERNAL_WIDTH + PETAL_FRAME_W * 2;
    if (screenX > INTERNAL_WIDTH + PETAL_FRAME_W) p.x -= INTERNAL_WIDTH + PETAL_FRAME_W * 2;
    if (screenY > INTERNAL_HEIGHT + PETAL_FRAME_H) {
      p.y = cameraY - PETAL_FRAME_H - Math.random() * 20;
      p.x = cameraX + Math.random() * INTERNAL_WIDTH;
    }

    p.sprite.x = p.x;
    p.sprite.y = p.y;

    // Animate frame
    p.frameTimer += PETAL_ANIM_SPEED;
    if (p.frameTimer >= 1) {
      p.frameTimer -= 1;
      p.frame = (p.frame + 1) % PETAL_FRAMES;
      p.sprite.texture = p.textures[p.frame];
    }
  }

  // Raylight: subtle pulsing glow, fixed to camera
  if (raylightSprite) {
    raylightTimer += 0.008;
    raylightSprite.alpha = 0.06 + Math.sin(raylightTimer) * 0.03;
    raylightSprite.x = cameraX;
    raylightSprite.y = cameraY;
  }
}

export function destroyAtmosphere(): void {
  if (petalContainer) {
    petalContainer.destroy({ children: true });
    petalContainer = null;
  }
  if (raylightSprite) {
    raylightSprite.destroy();
    raylightSprite = null;
  }
  petals = [];
}
