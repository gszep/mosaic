import { Assets, Container, Sprite, Texture, Rectangle } from "pixi.js";

const CHAR_W = 8;
const CHAR_H = 8;
const COLS = 15;

// Character map matching the font8x8.png layout (8 rows × 15 cols)
const CHARMAP =
  ' !"#$%&\'()*+,-.' +
  '/0123456789:;<=' +
  '>?@ABCDEFGHIJKL' +
  'MNOPQRSTUVWXYZ[' +
  '\\]^_`abcdefghij' +
  'klmnopqrstuvwxy' +
  'z{|}~ Çüéâäàåçê' +
  'ëèïîìÄÅÉæÆôöòûù';

const charIndex = new Map<string, number>();
for (let i = 0; i < CHARMAP.length; i++) {
  charIndex.set(CHARMAP[i], i);
}

let fontTexture: Texture | null = null;
const charTextures = new Map<string, Texture>();

export async function loadBitmapFont(basePath: string): Promise<void> {
  fontTexture = await Assets.load<Texture>(`${basePath}ui/font8x8.png`);
  fontTexture.source.scaleMode = "nearest";

  for (const [char, idx] of charIndex) {
    const col = idx % COLS;
    const row = Math.floor(idx / COLS);
    const frame = new Rectangle(col * CHAR_W, row * CHAR_H, CHAR_W, CHAR_H);
    charTextures.set(char, new Texture({ source: fontTexture.source, frame }));
  }
}

export function createBitmapText(
  text: string,
  maxWidth: number,
  color: number = 0x3a2a1a,
): Container {
  const container = new Container();
  let cx = 0;
  let cy = 0;
  const spacing = 1;
  const lineHeight = CHAR_H + spacing;

  // Simple word wrap
  const words = text.split(' ');
  for (let wi = 0; wi < words.length; wi++) {
    const word = words[wi];
    const wordWidth = word.length * (CHAR_W + spacing);

    // Wrap if word doesn't fit (unless it's the first word on the line)
    if (cx > 0 && cx + wordWidth > maxWidth) {
      cx = 0;
      cy += lineHeight;
    }

    for (const ch of word) {
      const tex = charTextures.get(ch) ?? charTextures.get(ch.toUpperCase());
      if (tex) {
        const sprite = new Sprite(tex);
        sprite.x = cx;
        sprite.y = cy;
        sprite.tint = color;
        container.addChild(sprite);
      }
      cx += CHAR_W + spacing;
    }

    // Add space after word
    if (wi < words.length - 1) {
      cx += CHAR_W + spacing;
    }
  }

  return container;
}

export function measureText(text: string, maxWidth: number): { width: number; height: number } {
  let cx = 0;
  let cy = 0;
  let maxX = 0;
  const spacing = 1;
  const lineHeight = CHAR_H + spacing;

  const words = text.split(' ');
  for (let wi = 0; wi < words.length; wi++) {
    const word = words[wi];
    const wordWidth = word.length * (CHAR_W + spacing);

    if (cx > 0 && cx + wordWidth > maxWidth) {
      cx = 0;
      cy += lineHeight;
    }

    cx += wordWidth;
    if (wi < words.length - 1) cx += CHAR_W + spacing;
    maxX = Math.max(maxX, cx);
  }

  return { width: maxX, height: cy + CHAR_H };
}
