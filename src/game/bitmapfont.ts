import { Assets, Container, Sprite, Texture, Rectangle } from "pixi.js";

const CHAR_W = 4;
const CHAR_H = 4;
const FIRST_CHAR = 32; // space
const NUM_CHARS = 96;   // space (32) through DEL (127)

let charTextures: Texture[] | null = null;

export async function loadBitmapFont(): Promise<void> {
  if (charTextures) return;
  const base = import.meta.env.BASE_URL as string;
  const tex = await Assets.load<Texture>(`${base}ui/font4x4.png`);
  tex.source.scaleMode = "nearest";

  charTextures = [];
  for (let i = 0; i < NUM_CHARS; i++) {
    const frame = new Rectangle(i * CHAR_W, 0, CHAR_W, CHAR_H);
    charTextures.push(new Texture({ source: tex.source, frame }));
  }
}

export function createBitmapText(
  text: string,
  maxWidth: number,
  color: number = 0x3a2a1a,
): Container {
  const container = new Container();
  if (!charTextures) return container;

  let cx = 0;
  let cy = 0;
  const advance = CHAR_W; // no extra spacing — 4th column is built-in padding
  const spaceW = CHAR_W;
  const lineH = CHAR_H + 1;

  const words = text.split(' ');
  for (let wi = 0; wi < words.length; wi++) {
    const word = words[wi];
    const wordW = word.length * advance;

    if (cx > 0 && cx + wordW > maxWidth) {
      cx = 0;
      cy += lineH;
    }

    for (const ch of word) {
      const code = ch.charCodeAt(0) - FIRST_CHAR;
      if (code >= 0 && code < NUM_CHARS) {
        const s = new Sprite(charTextures[code]);
        s.x = cx;
        s.y = cy;
        s.tint = color;
        container.addChild(s);
      }
      cx += advance;
    }

    if (wi < words.length - 1) cx += spaceW;
  }

  return container;
}
