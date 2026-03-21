import { Container, Texture, Rectangle, Assets } from "pixi.js";
import { CompositeTilemap } from "@pixi/tilemap";
import type { TMJMap } from "../shared/tmj";

const RENDER_LAYERS = ["ground", "buildings"];

export async function loadTilemap(
  mapUrl: string,
  tilesetBasePath: string
): Promise<{ base: Container; decorBelow: Container; decorAbove: Container; collision: Set<number>; depthTiles: Set<number>; mapWidth: number; mapHeight: number; map: TMJMap }> {
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

  // Collect depth flags
  const depthLayer = map.layers.find((l) => l.type === "tilelayer" && l.name === "depth");
  const depthSet = new Set<number>();
  if (depthLayer?.data) {
    for (let i = 0; i < depthLayer.data.length; i++) {
      if (depthLayer.data[i] > 0) depthSet.add(i);
    }
  }

  for (const layer of map.layers) {
    if (layer.type !== "tilelayer" || !layer.data) continue;

    if (layer.name === "collision" || layer.name === "depth") {
      if (layer.name === "collision") {
        for (let i = 0; i < layer.data.length; i++) {
          if (layer.data[i] > 0) collision.add(i);
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
        if (gid === 0) continue;
        const tex = tileTextures.get(gid);
        if (!tex) continue;
        const px = (i % map.width) * tw;
        const py = Math.floor(i / map.width) * th;

        if (depthSet.has(i)) {
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
    for (let i = 0; i < layer.data.length; i++) {
      const gid = layer.data[i];
      if (gid === 0) continue;
      const tex = tileTextures.get(gid);
      if (!tex) continue;
      tilemap.tile(
        tex,
        (i % map.width) * map.tilewidth,
        Math.floor(i / map.width) * map.tileheight
      );
    }
    base.addChild(tilemap);
  }

  return {
    base,
    decorBelow,
    decorAbove,
    collision,
    depthTiles: depthSet,
    mapWidth: map.width * map.tilewidth,
    mapHeight: map.height * map.tileheight,
    map,
  };
}
