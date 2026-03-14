import { Container, Sprite, Texture, Rectangle, Assets } from "pixi.js";

interface TMJLayer {
  name: string;
  type: "tilelayer" | "objectgroup";
  data?: number[];
  width?: number;
  height?: number;
  visible: boolean;
}

interface TMJTileset {
  firstgid: number;
  image: string;
  tilewidth: number;
  tileheight: number;
  imagewidth: number;
  imageheight: number;
  columns: number;
}

interface TMJMap {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: TMJLayer[];
  tilesets: TMJTileset[];
}

const RENDER_LAYERS = ["ground", "buildings", "decoration"];

/**
 * Load and render a Tiled TMJ map. Returns a Container with all visible
 * tile layers and a Set of solid tile indices from the collision layer.
 */
export async function loadTilemap(
  mapUrl: string,
  tilesetBasePath: string
): Promise<{ container: Container; collision: Set<number>; mapWidth: number; mapHeight: number }> {
  const map: TMJMap = await (await fetch(mapUrl)).json();
  const container = new Container();
  const collision = new Set<number>();

  // Load tileset textures.
  const tileTextures = new Map<number, Texture>();

  for (const ts of map.tilesets) {
    const texturePath = `${tilesetBasePath}/${ts.image.split("/").pop()}`;
    const baseTexture = await Assets.load(texturePath);
    const cols = ts.columns;

    // Pre-slice every tile in this tileset.
    for (let localId = 0; localId < (ts.imagewidth / ts.tilewidth) * (ts.imageheight / ts.tileheight); localId++) {
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
      // Build collision set (tile indices where gid > 0).
      for (let i = 0; i < layer.data.length; i++) {
        if (layer.data[i] > 0) collision.add(i);
      }
      continue; // Don't render collision layer.
    }

    if (!RENDER_LAYERS.includes(layer.name)) continue;

    const layerContainer = new Container();
    for (let i = 0; i < layer.data.length; i++) {
      const gid = layer.data[i];
      if (gid === 0) continue;
      const tex = tileTextures.get(gid);
      if (!tex) continue;
      const sprite = new Sprite(tex);
      sprite.x = (i % map.width) * map.tilewidth;
      sprite.y = Math.floor(i / map.width) * map.tileheight;
      layerContainer.addChild(sprite);
    }
    container.addChild(layerContainer);
  }

  return {
    container,
    collision,
    mapWidth: map.width * map.tilewidth,
    mapHeight: map.height * map.tileheight,
  };
}
