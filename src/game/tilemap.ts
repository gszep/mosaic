import { Container, Texture, Rectangle, Assets } from "pixi.js";
import { CompositeTilemap } from "@pixi/tilemap";
import type { TMJMap } from "../shared/tmj";

const RENDER_LAYERS = ["ground", "buildings", "decoration"];

/**
 * Load and render a Tiled TMJ map using @pixi/tilemap for batch rendering.
 * Returns a Container with all visible tile layers and a Set of solid tile
 * indices from the collision layer.
 */
export async function loadTilemap(
  mapUrl: string,
  tilesetBasePath: string
): Promise<{ container: Container; collision: Set<number>; mapWidth: number; mapHeight: number }> {
  const map: TMJMap = await (await fetch(mapUrl)).json();
  const container = new Container();
  const collision = new Set<number>();

  // Load tileset textures and pre-slice every tile.
  const tileTextures = new Map<number, Texture>();

  for (const ts of map.tilesets) {
    const texturePath = `${tilesetBasePath}/${ts.image.split("/").pop()}`;
    const baseTexture = await Assets.load(texturePath);
    const cols = ts.columns;
    const totalTiles = (ts.imagewidth / ts.tilewidth) * (ts.imageheight / ts.tileheight);

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

  // Render each layer.
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
