import type { TMJMap, TMJTileset } from "./tmj";

export interface TilesetImage {
  tileset: TMJTileset;
  img: HTMLImageElement;
}

export function loadTilesetImage(
  tileset: TMJTileset,
  basePath: string
): Promise<TilesetImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const filename = tileset.image.split("/").pop()!;
    img.src = `${basePath}/${filename}`;
    img.onload = () => resolve({ tileset, img });
    img.onerror = () => reject(new Error(`Failed to load ${filename}`));
  });
}

export interface RenderOptions {
  showGrid: boolean;
  showCollision: boolean;
  visibleLayers: Set<string>;
  activeLayer: string | null;
  scale: number;
}

export function renderMap(
  ctx: CanvasRenderingContext2D,
  map: TMJMap,
  tilesetImages: TilesetImage[],
  opts: RenderOptions
) {
  const tw = map.tilewidth;
  const th = map.tileheight;
  const s = opts.scale;
  const pw = map.width * tw * s;
  const ph = map.height * th * s;

  ctx.canvas.width = pw;
  ctx.canvas.height = ph;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, pw, ph);

  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? "#252525" : "#333333";
      ctx.fillRect(x * tw * s, y * th * s, tw * s, th * s);
    }
  }

  for (const layer of map.layers) {
    if (layer.type !== "tilelayer" || !layer.data) continue;
    if (!opts.visibleLayers.has(layer.name)) continue;
    if (layer.name === "collision" && !opts.showCollision) continue;

    const dimmed = opts.activeLayer !== null && layer.name !== opts.activeLayer;

    if (dimmed) ctx.globalAlpha = 0.35;

    if (layer.name === "collision") {
      // Render collision as a purple overlay.
      for (let i = 0; i < layer.data.length; i++) {
        if (layer.data[i] === 0) continue;
        const x = (i % map.width) * tw * s;
        const y = Math.floor(i / map.width) * th * s;
        ctx.fillStyle = "rgba(187, 154, 247, 0.4)";
        ctx.fillRect(x, y, tw * s, th * s);
      }
    } else {
      for (let i = 0; i < layer.data.length; i++) {
        const gid = layer.data[i];
        if (gid === 0) continue;
        drawTile(ctx, gid, i, map, tilesetImages, s);
      }
    }

    if (dimmed) ctx.globalAlpha = 1;
  }

  // Grid overlay.
  if (opts.showGrid) {
    ctx.strokeStyle = "rgba(238,238,236,0.15)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= map.width; x++) {
      const px = x * tw * s;
      ctx.beginPath();
      ctx.moveTo(px + 0.5, 0);
      ctx.lineTo(px + 0.5, ph);
      ctx.stroke();
    }
    for (let y = 0; y <= map.height; y++) {
      const py = y * th * s;
      ctx.beginPath();
      ctx.moveTo(0, py + 0.5);
      ctx.lineTo(pw, py + 0.5);
      ctx.stroke();
    }
  }
}

function drawTile(
  ctx: CanvasRenderingContext2D,
  gid: number,
  index: number,
  map: TMJMap,
  tilesetImages: TilesetImage[],
  scale: number
) {
  let matched: TilesetImage | null = null;
  for (let t = tilesetImages.length - 1; t >= 0; t--) {
    if (gid >= tilesetImages[t].tileset.firstgid) {
      matched = tilesetImages[t];
      break;
    }
  }
  if (!matched) return;

  const ts = matched.tileset;
  const localId = gid - ts.firstgid;
  const srcX = (localId % ts.columns) * ts.tilewidth;
  const srcY = Math.floor(localId / ts.columns) * ts.tileheight;
  const destX = (index % map.width) * map.tilewidth * scale;
  const destY = Math.floor(index / map.width) * map.tileheight * scale;

  ctx.drawImage(
    matched.img,
    srcX,
    srcY,
    ts.tilewidth,
    ts.tileheight,
    destX,
    destY,
    map.tilewidth * scale,
    map.tileheight * scale
  );
}

export function renderPalette(
  ctx: CanvasRenderingContext2D,
  tsi: TilesetImage,
  selectedGid: number | null,
  scale: number
) {
  const ts = tsi.tileset;
  const cols = ts.columns;
  const rows = Math.ceil(ts.tilecount / cols);
  const w = cols * ts.tilewidth * scale;
  const h = rows * ts.tileheight * scale;

  ctx.canvas.width = w;
  ctx.canvas.height = h;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, w, h);

  ctx.drawImage(tsi.img, 0, 0, ts.imagewidth, ts.imageheight, 0, 0, w, h);

  // Grid.
  ctx.strokeStyle = "rgba(238,238,236,0.12)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= cols; x++) {
    const px = x * ts.tilewidth * scale;
    ctx.beginPath();
    ctx.moveTo(px + 0.5, 0);
    ctx.lineTo(px + 0.5, h);
    ctx.stroke();
  }
  for (let y = 0; y <= rows; y++) {
    const py = y * ts.tileheight * scale;
    ctx.beginPath();
    ctx.moveTo(0, py + 0.5);
    ctx.lineTo(w, py + 0.5);
    ctx.stroke();
  }

  // Highlight selected tile.
  if (selectedGid !== null) {
    const localId = selectedGid - ts.firstgid;
    if (localId >= 0 && localId < ts.tilecount) {
      const sx = (localId % cols) * ts.tilewidth * scale;
      const sy = Math.floor(localId / cols) * ts.tileheight * scale;
      ctx.strokeStyle = "#E95420";
      ctx.lineWidth = 2;
      ctx.strokeRect(sx + 1, sy + 1, ts.tilewidth * scale - 2, ts.tileheight * scale - 2);
    }
  }
}
