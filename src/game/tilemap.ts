import { Container, Texture, Rectangle, Assets } from "pixi.js";
import { CompositeTilemap } from "@pixi/tilemap";
import type { TMJMap } from "../shared/tmj";

const RENDER_LAYERS = ["ground", "buildings"];

import type { HalfCollision } from "./camera";

// GIDs managed by individual sprites (e.g. breakable pots) — skip in CompositeTilemap
const SPRITE_MANAGED_GIDS = new Set([2153]);

// GIDs that always render above the player
const ALWAYS_ABOVE_GIDS = new Set([1916, 1917, 1918, 1919, 1920, 1921, 1922, 3416, 3417]);

export async function loadTilemap(
  mapUrl: string,
  tilesetBasePath: string
): Promise<{ base: Container; decorBelow: Container; decorAbove: Container; collision: Set<number>; halfCollision: HalfCollision; depthTiles: Set<number>; fieldTiles: Set<number>; waterTiles: Set<number>; tileTextures: Map<number, Texture>; mapWidth: number; mapHeight: number; map: TMJMap }> {
  const map: TMJMap = await (await fetch(mapUrl)).json();
  const base = new Container();
  const decorBelow = new Container();
  const decorAbove = new Container();
  const collision = new Set<number>();

  const tileTextures = new Map<number, Texture>();

  const textureEntries = await Promise.all(
    map.tilesets.map(async (ts) => {
      const texturePath = `${tilesetBasePath}/${ts.image.split("/").pop()}`;
      const baseTexture = await Assets.load(texturePath);
      return { ts, baseTexture };
    })
  );

  for (const { ts, baseTexture } of textureEntries) {
    const cols = ts.columns;
    const totalTiles = ts.tilecount;

    for (let localId = 0; localId < totalTiles; localId++) {
      const gid = ts.firstgid + localId;
      const col = localId % cols;
      const row = Math.floor(localId / cols);
      tileTextures.set(
        gid,
        new Texture({
          source: baseTexture.source,
          frame: new Rectangle(
            col * ts.tilewidth,
            row * ts.tileheight,
            ts.tilewidth,
            ts.tileheight
          ),
        })
      );
    }
  }

  // Determine TilesetField GID range
  const fieldTs = map.tilesets.find((ts) => ts.name === "TilesetField");
  const fieldGidMin = fieldTs ? fieldTs.firstgid : -1;
  const fieldGidMax = fieldTs ? fieldTs.firstgid + fieldTs.tilecount : -1;

  // Collect field tile indices (any rendered layer tile from TilesetField)
  const fieldTiles = new Set<number>();
  if (fieldTs) {
    for (const layer of map.layers) {
      if (layer.type !== "tilelayer" || !layer.data) continue;
      if (!RENDER_LAYERS.includes(layer.name) && layer.name !== "decoration") continue;
      for (let i = 0; i < layer.data.length; i++) {
        const gid = layer.data[i];
        if (gid >= fieldGidMin && gid < fieldGidMax) fieldTiles.add(i);
      }
    }
  }

  // Determine TilesetWater GID range
  const waterTs = map.tilesets.find((ts) => ts.name === "TilesetWater");
  const waterGidMin = waterTs ? waterTs.firstgid : -1;
  const waterGidMax = waterTs ? waterTs.firstgid + waterTs.tilecount : -1;

  const waterTiles = new Set<number>();
  if (waterTs) {
    for (const layer of map.layers) {
      if (layer.type !== "tilelayer" || !layer.data) continue;
      if (!RENDER_LAYERS.includes(layer.name) && layer.name !== "decoration") continue;
      for (let i = 0; i < layer.data.length; i++) {
        const gid = layer.data[i];
        if (gid >= waterGidMin && gid < waterGidMax) waterTiles.add(i);
      }
    }
  }

  // Collect depth flags
  const depthLayer = map.layers.find((l) => l.type === "tilelayer" && l.name === "depth");
  const depthSet = new Set<number>();
  if (depthLayer?.data) {
    for (let i = 0; i < depthLayer.data.length; i++) {
      if (depthLayer.data[i] > 0) depthSet.add(i);
    }
  }

  const halfCollision: HalfCollision = { left: new Set(), right: new Set() };

  for (const layer of map.layers) {
    if (layer.type !== "tilelayer" || !layer.data) continue;

    if (layer.name === "collision" || layer.name === "collision_left" || layer.name === "collision_right" || layer.name === "depth") {
      if (layer.name === "collision") {
        for (let i = 0; i < layer.data.length; i++) {
          if (layer.data[i] > 0) collision.add(i);
        }
      } else if (layer.name === "collision_left") {
        for (let i = 0; i < layer.data.length; i++) {
          if (layer.data[i] > 0) halfCollision.left.add(i);
        }
      } else if (layer.name === "collision_right") {
        for (let i = 0; i < layer.data.length; i++) {
          if (layer.data[i] > 0) halfCollision.right.add(i);
        }
      }
      continue;
    }

    if (layer.name === "decoration") {
      const below = new CompositeTilemap();
      const above = new CompositeTilemap();
      const normal = new CompositeTilemap();
      const tw = map.tilewidth;
      const th = map.tileheight;
      const halfH = Math.floor(th / 2);

      for (let i = 0; i < layer.data.length; i++) {
        const gid = layer.data[i];
        if (gid === 0 || SPRITE_MANAGED_GIDS.has(gid)) continue;
        const tex = tileTextures.get(gid);
        if (!tex) continue;
        const px = (i % map.width) * tw;
        const py = Math.floor(i / map.width) * th;

        if (ALWAYS_ABOVE_GIDS.has(gid)) {
          above.tile(tex, px, py);
        } else if (depthSet.has(i)) {
          // Split: bottom half below player, top half above
          const frame = tex.frame;
          const bottomTex = new Texture({ source: tex.source, frame: new Rectangle(frame.x, frame.y + halfH, frame.width, frame.height - halfH) });
          const topTex = new Texture({ source: tex.source, frame: new Rectangle(frame.x, frame.y, frame.width, halfH) });
          below.tile(bottomTex, px, py + halfH);
          above.tile(topTex, px, py);
        } else {
          normal.tile(tex, px, py);
        }
      }

      decorBelow.addChild(below);
      decorBelow.addChild(normal);
      decorAbove.addChild(above);
      continue;
    }

    if (!RENDER_LAYERS.includes(layer.name)) continue;

    const tilemap = new CompositeTilemap();
    const belowTilemap = new CompositeTilemap();
    const aboveTilemap = new CompositeTilemap();
    let hasDepthSplit = false;
    const tw = map.tilewidth;
    const th = map.tileheight;
    const halfH = Math.floor(th / 2);

    for (let i = 0; i < layer.data.length; i++) {
      const gid = layer.data[i];
      if (gid === 0) continue;
      const tex = tileTextures.get(gid);
      if (!tex) continue;
      const px = (i % map.width) * tw;
      const py = Math.floor(i / map.width) * th;

      if (ALWAYS_ABOVE_GIDS.has(gid)) {
        hasDepthSplit = true;
        aboveTilemap.tile(tex, px, py);
      } else if (layer.name !== "ground" && depthSet.has(i)) {
        hasDepthSplit = true;
        const frame = tex.frame;
        const bottomTex = new Texture({ source: tex.source, frame: new Rectangle(frame.x, frame.y + halfH, frame.width, frame.height - halfH) });
        const topTex = new Texture({ source: tex.source, frame: new Rectangle(frame.x, frame.y, frame.width, halfH) });
        belowTilemap.tile(bottomTex, px, py + halfH);
        aboveTilemap.tile(topTex, px, py);
      } else {
        tilemap.tile(tex, px, py);
      }
    }
    base.addChild(tilemap);
    if (hasDepthSplit) {
      decorBelow.addChild(belowTilemap);
      decorAbove.addChild(aboveTilemap);
    }
  }

  return {
    base,
    decorBelow,
    decorAbove,
    collision,
    halfCollision,
    depthTiles: depthSet,
    fieldTiles,
    waterTiles,
    tileTextures,
    mapWidth: map.width * map.tilewidth,
    mapHeight: map.height * map.tileheight,
    map,
  };
}
