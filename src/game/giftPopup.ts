import { Assets, Container, NineSliceSprite, Sprite, Texture } from "pixi.js";
import { INTERNAL_WIDTH, INTERNAL_HEIGHT } from "./viewport";
import { createBitmapText } from "./bitmapfont";

const BASE = import.meta.env.BASE_URL;
const BORDER = 3;

let boxTexture: Texture | null = null;
let popup: Container | null = null;

async function ensureTexture() {
  if (!boxTexture) {
    boxTexture = await Assets.load<Texture>(`${BASE}ui/dialogue-box-simple.png`);
    boxTexture.source.scaleMode = "nearest";
  }
}

export async function showGiftPopup(
  giftObject: string,
  giftSprite: string | null,
  parent: Container,
): Promise<void> {
  await ensureTexture();
  dismissGiftPopup();

  popup = new Container();
  parent.addChild(popup);

  // Load gift sprite if available
  let itemSprite: Sprite | null = null;
  if (giftSprite) {
    try {
      const tex = await Assets.load<Texture>(`${BASE}sprites/items/${giftSprite}.png`);
      tex.source.scaleMode = "nearest";
      itemSprite = new Sprite(tex);
    } catch {}
  }

  const label = createBitmapText(`Received ${giftObject}!`, 100, 0x3a2a1a);

  // Layout
  const spriteW = itemSprite ? Math.max(itemSprite.width, 16) : 0;
  const spriteH = itemSprite ? Math.max(itemSprite.height, 16) : 0;
  const gap = itemSprite ? 6 : 0;
  const contentW = spriteW + gap + label.width;
  const contentH = Math.max(spriteH, label.height);
  const padX = 10;
  const padY = 8;
  const boxW = contentW + padX * 2;
  const boxH = contentH + padY * 2;
  const boxX = Math.round((INTERNAL_WIDTH - boxW) / 2);
  const boxY = Math.round((INTERNAL_HEIGHT - boxH) / 2);

  // Background
  const bg = new NineSliceSprite({
    texture: boxTexture!,
    leftWidth: BORDER,
    rightWidth: BORDER,
    topHeight: BORDER,
    bottomHeight: BORDER,
  });
  bg.x = boxX;
  bg.y = boxY;
  bg.width = boxW;
  bg.height = boxH;
  popup.addChild(bg);

  // Sprite
  let contentX = boxX + padX;
  if (itemSprite) {
    itemSprite.x = contentX + (spriteW - itemSprite.width) / 2;
    itemSprite.y = boxY + padY + (contentH - itemSprite.height) / 2;
    popup.addChild(itemSprite);
    contentX += spriteW + gap;
  }

  // Text
  label.x = contentX;
  label.y = boxY + padY + (contentH - label.height) / 2;
  popup.addChild(label);
}

export function dismissGiftPopup(): void {
  if (popup) {
    popup.destroy({ children: true });
    popup = null;
  }
}

export function isGiftPopupActive(): boolean {
  return popup !== null;
}
