import { Container, Rectangle, Sprite, Texture } from "pixi.js";
import type { TMJMap } from "../shared/tmj";

const TILE = 16;
const HALF = TILE / 2;
const POT_GID = 2153;
const BROKEN_GID = 2154;
const INTERACT_RANGE = 24;

interface Pot {
  idx: number;
  x: number;
  y: number;
  bottomSprite: Sprite;
  topSprite: Sprite;
  broken: boolean;
}

let pots: Pot[] = [];
let totalBroken = 0;
const TOTAL_POTS = 4;
let brokenTexture: Texture | null = null;
let belowContainer: Container | null = null;
let aboveContainer: Container | null = null;
let collisionSet: Set<number> | null = null;
let depthSet: Set<number> | null = null;

export function initPots(
  map: TMJMap,
  tileTextures: Map<number, Texture>,
  collision: Set<number>,
  depthTiles: Set<number>,
  decorBelow: Container,
  decorAbove: Container,
): void {
  pots = [];
  collisionSet = collision;
  depthSet = depthTiles;
  brokenTexture = tileTextures.get(BROKEN_GID) ?? null;
  const intactTexture = tileTextures.get(POT_GID) ?? null;
  if (!intactTexture) return;

  belowContainer = new Container();
  aboveContainer = new Container();
  decorBelow.addChild(belowContainer);
  decorAbove.addChild(aboveContainer);

  // Split intact pot texture into top and bottom halves
  const frame = intactTexture.frame;
  const bottomTex = new Texture({ source: intactTexture.source, frame: new Rectangle(frame.x, frame.y + HALF, frame.width, HALF) });
  const topTex = new Texture({ source: intactTexture.source, frame: new Rectangle(frame.x, frame.y, frame.width, HALF) });

  for (const layer of map.layers) {
    if (layer.type !== "tilelayer" || !layer.data) continue;
    for (let i = 0; i < layer.data.length; i++) {
      if (layer.data[i] === POT_GID) {
        const x = (i % map.width) * TILE;
        const y = Math.floor(i / map.width) * TILE;

        const bottomSprite = new Sprite(bottomTex);
        bottomSprite.x = x;
        bottomSprite.y = y + HALF;
        belowContainer.addChild(bottomSprite);

        const topSprite = new Sprite(topTex);
        topSprite.x = x;
        topSprite.y = y;
        aboveContainer.addChild(topSprite);

        pots.push({ idx: i, x, y, bottomSprite, topSprite, broken: false });
      }
    }
  }
}

export function tryBreakPot(px: number, py: number): boolean {
  if (!brokenTexture || !belowContainer) return false;

  const pcx = px + 8;
  const pcy = py + 8;

  for (const pot of pots) {
    if (pot.broken) continue;
    const dx = (pot.x + 8) - pcx;
    const dy = (pot.y + 8) - pcy;
    if (Math.abs(dx) < INTERACT_RANGE && Math.abs(dy) < INTERACT_RANGE) {
      pot.broken = true;
      totalBroken++;
      // Replace with full broken sprite below player
      pot.bottomSprite.texture = brokenTexture;
      pot.bottomSprite.y = pot.y;
      // Hide top half
      pot.topSprite.visible = false;
      collisionSet?.delete(pot.idx);
      depthSet?.delete(pot.idx);
      return true;
    }
  }
  return false;
}

export function allPotsBroken(): boolean {
  return totalBroken >= TOTAL_POTS;
}

export function destroyPots(): void {
  if (belowContainer) { belowContainer.destroy({ children: true }); belowContainer = null; }
  if (aboveContainer) { aboveContainer.destroy({ children: true }); aboveContainer = null; }
  pots = [];
  collisionSet = null;
  depthSet = null;
  brokenTexture = null;
}
