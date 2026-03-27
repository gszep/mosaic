import { Assets, Container, Graphics, Sprite, Texture } from "pixi.js";
import { INTERNAL_WIDTH, INTERNAL_HEIGHT } from "./viewport";
import { createBitmapText } from "./bitmapfont";
import { fadeOutMusic } from "./music";
import { destroyWaterAmbient } from "./foley";

const BASE = import.meta.env.BASE_URL;
const FADE_DURATION = 3000; // ms for fade to black
const FADE_STEPS = 60;

export async function showEnding(parent: Container): Promise<void> {
  fadeOutMusic(FADE_DURATION);
  destroyWaterAmbient();

  const overlay = new Graphics();
  overlay.rect(0, 0, INTERNAL_WIDTH, INTERNAL_HEIGHT).fill(0x000000);
  overlay.alpha = 0;
  parent.addChild(overlay);

  // Fade to black
  await new Promise<void>((resolve) => {
    let step = 0;
    const interval = setInterval(() => {
      step++;
      overlay.alpha = Math.min(1, step / FADE_STEPS);
      if (step >= FADE_STEPS) { clearInterval(interval); resolve(); }
    }, FADE_DURATION / FADE_STEPS);
  });

  // Wait a beat
  await new Promise((r) => setTimeout(r, 500));

  // Show heart icon
  const heartTex = await Assets.load<Texture>(`${BASE}ui/heart.png`);
  heartTex.source.scaleMode = "nearest";
  const heart = new Sprite(heartTex);
  heart.x = Math.floor((INTERNAL_WIDTH - heart.width) / 2);
  heart.y = Math.floor(INTERNAL_HEIGHT / 2 - heart.height);
  heart.alpha = 0;
  parent.addChild(heart);

  // Show title
  const title = createBitmapText("Happy Birthday!", INTERNAL_WIDTH, 0xffffff);
  title.x = Math.floor((INTERNAL_WIDTH - title.width) / 2);
  title.y = Math.floor(INTERNAL_HEIGHT / 2 + 4);
  title.alpha = 0;
  parent.addChild(title);

  // Fade in heart and title
  await new Promise<void>((resolve) => {
    let step = 0;
    const steps = 40;
    const interval = setInterval(() => {
      step++;
      const a = Math.min(1, step / steps);
      heart.alpha = a;
      title.alpha = a;
      if (step >= steps) { clearInterval(interval); resolve(); }
    }, 30);
  });
}
