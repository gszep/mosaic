import { Container, Texture, Rectangle, Assets } from "pixi.js";
import { CompositeTilemap } from "@pixi/tilemap";
import type { TMJMap } from "../shared/tmj";

const RENDER_LAYERS = ["ground", "buildings", "decoration"];

export async function loadTilemap(
  mapUrl: string,
  tilesetBasePath: string
): Promise<{ container: Container; collision: Set<number>; mapWidth: number; mapHeight: number }> {
  const map: TMJMap = await (await fetch(mapUrl)).json();
  const container = new Container();
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

  for (const layer of map.layers) {
    if (layer.type !== "tilelayer" || !layer.data) continue;

    if (layer.name === "collision") {
      for (let i = 0; i < layer.data.length; i++) {
        if (layer.data[i] > 0) collision.add(i);
      }
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
    container.addChild(tilemap);
  }

  return {
    container,
    collision,
    mapWidth: map.width * map.tilewidth,
    mapHeight: map.height * map.tileheight,
  };
}
