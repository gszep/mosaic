import type { TMJMap, TMJObject } from "./tmj";
import { createEmptyMap } from "./tmj";
import {
  loadTilesetImage,
  renderMap,
  renderPalette,
  type TilesetImage,
  type RenderOptions,
  type CatalogData,
} from "./renderer";
import { db, ref, get } from "../src/shared/firebase";
import type { Submission, SpriteData } from "../src/shared/types";

const BASE = import.meta.env.BASE_URL;
const TILE_SIZE = 16;
const MAX_SCALE = 16;
let mapScale = 4;
let paletteScale = 2;
const DEFAULT_LAYERS = ["ground", "buildings", "decoration", "collision"];
const TILESET_DEFS = [
  { name: "TilesetFloor", image: "TilesetFloor.png", imagewidth: 352, imageheight: 417 },
  { name: "TilesetFloorB", image: "TilesetFloorB.png", imagewidth: 176, imageheight: 112 },
  { name: "TilesetFloorDetail", image: "TilesetFloorDetail.png", imagewidth: 256, imageheight: 80 },
  { name: "TilesetNature", image: "TilesetNature.png", imagewidth: 384, imageheight: 336 },
  { name: "TilesetHouse", image: "TilesetHouse.png", imagewidth: 528, imageheight: 368 },
  { name: "TilesetElement", image: "TilesetElement.png", imagewidth: 256, imageheight: 240 },
  { name: "TilesetWater", image: "TilesetWater.png", imagewidth: 448, imageheight: 272 },
  { name: "TilesetRelief", image: "TilesetRelief.png", imagewidth: 320, imageheight: 192 },
  { name: "TilesetReliefDetail", image: "TilesetReliefDetail.png", imagewidth: 192, imageheight: 192 },
  { name: "TilesetTowers", image: "TilesetTowers.png", imagewidth: 384, imageheight: 96 },
  { name: "TilesetField", image: "TilesetField.png", imagewidth: 80, imageheight: 240 },
  { name: "TilesetDesert", image: "TilesetDesert.png", imagewidth: 320, imageheight: 192 },
  { name: "TilesetDungeon", image: "TilesetDungeon.png", imagewidth: 192, imageheight: 64 },
  { name: "TilesetHole", image: "TilesetHole.png", imagewidth: 176, imageheight: 80 },
  { name: "TilesetLogic", image: "TilesetLogic.png", imagewidth: 128, imageheight: 160 },
  { name: "TilesetVillageAbandoned", image: "TilesetVillageAbandoned.png", imagewidth: 320, imageheight: 192 },
  { name: "TilesetInterior", image: "TilesetInterior.png", imagewidth: 256, imageheight: 320 },
  { name: "TilesetInteriorFloor", image: "TilesetInteriorFloor.png", imagewidth: 352, imageheight: 272 },
  { name: "TilesetWallSimple", image: "TilesetWallSimple.png", imagewidth: 160, imageheight: 176 },
  { name: "Elements", image: "Elements.png", imagewidth: 144, imageheight: 48 },
];

let map: TMJMap;
let tilesetImages: TilesetImage[] = [];
let activeLayer = DEFAULT_LAYERS[0];
let selectedGid: number | null = null;
let activeTilesetIndex = 0;
let tool: "paint" | "erase" | "inspect" = "paint";
let painting = false;
let draggingSpawn: TMJObject | null = null;
let showSpawns = true;
const spriteCanvases = new Map<string, HTMLCanvasElement>();
let submissions: Record<string, Submission> = {};
let currentMapName = "village";
let catalog: CatalogData | null = null;
let catalogTreeEl: HTMLDivElement | null = null;
let catalogTreeScale = 0;
const CATALOG_INDEX = -1;

const opts: RenderOptions = {
  showGrid: true,
  showCollision: true,
  visibleLayers: new Set(DEFAULT_LAYERS),
  activeLayer: null,
  scale: mapScale,
};

const mapCanvas = document.getElementById("map-canvas") as HTMLCanvasElement;
const mapCtx = mapCanvas.getContext("2d")!;
const paletteCanvas = document.getElementById("palette-canvas") as HTMLCanvasElement;
const paletteCtx = paletteCanvas.getContext("2d")!;
const layerList = document.getElementById("layer-list")!;
const tilesetSelect = document.getElementById("tileset-select") as HTMLSelectElement;
const tileInfo = document.getElementById("selected-tile-info")!;
const tooltip = document.getElementById("inspector-tooltip")!;
const canvasWrap = document.getElementById("canvas-wrap")!;
const paletteScroll = document.getElementById("palette-scroll")!;
const mapListEl = document.getElementById("map-list")!;
const MAP_NAMES = ["village", "home", "bedroom"];

// --- Resize handle for bottom panel ---
{
  const handle = document.getElementById("resize-handle")!;
  const bottomPanel = document.getElementById("bottom-panel")!;
  let startY = 0;
  let startH = 0;

  handle.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    startY = e.clientY;
    startH = bottomPanel.offsetHeight;
    handle.classList.add("dragging");
    handle.setPointerCapture(e.pointerId);
  });

  handle.addEventListener("pointermove", (e) => {
    if (!handle.hasPointerCapture(e.pointerId)) return;
    const newH = Math.max(80, startH - (e.clientY - startY));
    bottomPanel.style.height = newH + "px";
  });

  handle.addEventListener("pointerup", (e) => {
    handle.classList.remove("dragging");
    handle.releasePointerCapture(e.pointerId);
  });
}

function buildTilesetDefs() {
  let gid = 1;
  return TILESET_DEFS.map((def) => {
    const cols = Math.floor(def.imagewidth / TILE_SIZE);
    const rows = Math.floor(def.imageheight / TILE_SIZE);
    const tilecount = cols * rows;
    const ts = {
      firstgid: gid,
      image: def.image,
      name: def.name,
      tilewidth: TILE_SIZE,
      tileheight: TILE_SIZE,
      imagewidth: def.imagewidth,
      imageheight: def.imageheight,
      columns: cols,
      tilecount,
    };
    gid += tilecount;
    return ts;
  });
}

function getMinMapScale(): number {
  return canvasWrap.clientWidth / (map.width * map.tilewidth);
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const json = JSON.stringify(map, null, 2);
    fetch(`/api/save-map/${currentMapName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: json,
    }).catch(() => {});
  }, 300);
}

async function loadMapFromServer(name: string): Promise<TMJMap | null> {
  try {
    const resp = await fetch(`${BASE}maps/${name}.tmj`);
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

async function init() {
  tilesetImages = await Promise.all(
    tilesetDefs.map((ts) => loadTilesetImage(ts, `${BASE}tilesets`))
  );

  map = createEmptyMap(40, 30, TILE_SIZE, tilesetDefs, DEFAULT_LAYERS);

  const loaded = await loadMapFromServer(currentMapName);
  if (loaded) {
    map = loaded;
  }

  mapScale = getMinMapScale();
  opts.scale = mapScale;

  try {
    const resp = await fetch(`${BASE}tilesets/catalog.json`);
    if (resp.ok) catalog = await resp.json();
  } catch {}

  if (catalog) {
    const opt = document.createElement("option");
    opt.value = String(CATALOG_INDEX);
    opt.textContent = "-- Catalog --";
    tilesetSelect.appendChild(opt);
    activeTilesetIndex = CATALOG_INDEX;
  }

  tilesetImages.forEach((tsi, i) => {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = `${tsi.tileset.name} (GID ${tsi.tileset.firstgid})`;
    tilesetSelect.appendChild(opt);
  });

  buildMapList();
  buildLayerList();
  redrawMap();
  redrawPalette();
  bindEvents();
  loadSubmissions();

  if (import.meta.hot) {
    import.meta.hot.on("map-update", async (data: { name: string }) => {
      if (data.name === currentMapName) {
        const loaded = await loadMapFromServer(data.name);
        if (loaded) {
          map = loaded;
          redrawMap();
        }
      }
    });

    import.meta.hot.on("catalog-update", async () => {
      try {
        const resp = await fetch(`${BASE}tilesets/catalog.json?t=${Date.now()}`);
        if (resp.ok) {
          catalog = await resp.json();
          catalogTreeEl?.remove();
          catalogTreeEl = null;
          redrawPalette();
        }
      } catch {}
    });
  }
}

function buildMapList() {
  mapListEl.innerHTML = "";
  for (const name of MAP_NAMES) {
    const li = document.createElement("li");
    li.className = name === currentMapName ? "active" : "";
    li.textContent = name;
    li.addEventListener("click", () => switchMap(name));
    mapListEl.appendChild(li);
  }
}

const tilesetDefs = buildTilesetDefs();

async function switchMap(name: string) {
  currentMapName = name;
  const loaded = await loadMapFromServer(name);
  map = loaded ?? createEmptyMap(40, 30, TILE_SIZE, tilesetDefs, DEFAULT_LAYERS);
  activeLayer = map.layers.find((l) => l.type === "tilelayer")?.name ?? "";
  opts.activeLayer = activeLayer;
  opts.visibleLayers = new Set(
    map.layers.filter((l) => l.type === "tilelayer").map((l) => l.name)
  );
  mapScale = getMinMapScale();
  opts.scale = mapScale;
  buildMapList();
  buildLayerList();
  redrawMap();
}

function buildLayerList() {
  layerList.innerHTML = "";

  // Spawns toggle (always at top)
  {
    const li = document.createElement("li");
    const cb = document.createElement("span");
    cb.className = "check";
    cb.textContent = showSpawns ? "[x]" : "[ ]";
    cb.addEventListener("click", (e) => {
      e.stopPropagation();
      showSpawns = !showSpawns;
      cb.textContent = showSpawns ? "[x]" : "[ ]";
      redrawMap();
    });
    const span = document.createElement("span");
    span.textContent = "spawns";
    span.style.color = "#E95420";
    li.appendChild(cb);
    li.appendChild(span);
    layerList.appendChild(li);
  }

  for (const layer of map.layers) {
    if (layer.type !== "tilelayer") continue;
    const li = document.createElement("li");
    li.className = layer.name === activeLayer ? "active" : "";

    let visible = opts.visibleLayers.has(layer.name);
    const cb = document.createElement("span");
    cb.className = "check";
    cb.textContent = visible ? "[x]" : "[ ]";
    cb.addEventListener("click", (e) => {
      e.stopPropagation();
      visible = !visible;
      if (visible) opts.visibleLayers.add(layer.name);
      else opts.visibleLayers.delete(layer.name);
      cb.textContent = visible ? "[x]" : "[ ]";
      redrawMap();
    });

    const span = document.createElement("span");
    span.textContent = layer.name;

    li.addEventListener("click", () => {
      activeLayer = layer.name;
      opts.activeLayer = activeLayer;
      buildLayerList();
      redrawMap();
    });

    li.appendChild(cb);
    li.appendChild(span);
    layerList.appendChild(li);
  }
}

function spriteDataToCanvas(data: SpriteData): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = data.width;
  c.height = data.height;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(data.width, data.height);
  for (let i = 0; i < data.pixels.length; i++) {
    const hex = data.pixels[i];
    const off = i * 4;
    if (!hex) { img.data[off + 3] = 0; continue; }
    img.data[off] = parseInt(hex.slice(1, 3), 16);
    img.data[off + 1] = parseInt(hex.slice(3, 5), 16);
    img.data[off + 2] = parseInt(hex.slice(5, 7), 16);
    img.data[off + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

async function loadSubmissions() {
  try {
    const snapshot = await get(ref(db, "submissions"));
    if (!snapshot.exists()) return;
    submissions = snapshot.val() as Record<string, Submission>;

    // Build sprite canvases
    for (const [token, sub] of Object.entries(submissions)) {
      if (sub.spriteData) {
        spriteCanvases.set(token, spriteDataToCanvas(sub.spriteData));
      }
    }

    // Create spawn objects for submissions that don't have one
    const spawns = ensureSpawnsLayer();
    const existingIds = new Set(
      spawns.flatMap((o) => o.properties?.filter((p) => p.name === "npcId").map((p) => p.value) ?? [])
    );

    const cols = Math.ceil(Math.sqrt(Object.keys(submissions).length));
    let i = 0;
    for (const [token, sub] of Object.entries(submissions)) {
      if (token === "player") continue;
      if (existingIds.has(token)) { i++; continue; }
      const col = i % cols;
      const row = Math.floor(i / cols);
      const nextId = spawns.reduce((max, o) => Math.max(max, o.id), 0) + 1;
      spawns.push({
        id: nextId,
        name: sub.name || token,
        type: "spawn",
        x: Math.floor(map.width / 2 - cols) * TILE_SIZE + col * TILE_SIZE * 3,
        y: Math.floor(map.height / 2 - 2) * TILE_SIZE + row * TILE_SIZE * 3,
        width: TILE_SIZE,
        height: TILE_SIZE,
        properties: [{ name: "npcId", type: "string", value: token }],
      });
      i++;
    }

    redrawMap();
  } catch (err) {
    console.warn("Could not load submissions:", (err as Error).message);
  }
}

function ensureSpawnsLayer(): TMJObject[] {
  let layer = map.layers.find((l) => l.type === "objectgroup" && l.name === "spawns");
  if (!layer) {
    layer = {
      id: map.layers.length + 1,
      name: "spawns",
      type: "objectgroup",
      objects: [],
      width: map.width,
      height: map.height,
      visible: true,
      x: 0,
      y: 0,
      opacity: 1,
    };
    map.layers.push(layer);
  }
  if (!layer.objects) layer.objects = [];
  return layer.objects;
}

function renderSpawns(ctx: CanvasRenderingContext2D) {
  if (!showSpawns) return;
  const spawns = ensureSpawnsLayer();
  const s = opts.scale;
  ctx.imageSmoothingEnabled = false;
  for (const obj of spawns) {
    const px = obj.x * s;
    const py = obj.y * s;
    const npcId = obj.properties?.find((p) => p.name === "npcId")?.value;

    // Draw sprite if available
    const spriteCanvas = npcId ? spriteCanvases.get(npcId) : null;
    if (spriteCanvas) {
      const sw = spriteCanvas.width * s;
      const sh = spriteCanvas.height * s;
      ctx.drawImage(spriteCanvas, 0, 0, spriteCanvas.width, spriteCanvas.height, px, py, sw, sh);
      // Selection outline
      ctx.strokeStyle = "#E95420";
      ctx.lineWidth = 1;
      ctx.strokeRect(px, py, sw, sh);
    } else {
      // Fallback marker
      const w = (obj.width || TILE_SIZE) * s;
      const h = (obj.height || TILE_SIZE) * s;
      ctx.fillStyle = "rgba(233, 84, 32, 0.35)";
      ctx.fillRect(px, py, w, h);
      ctx.strokeStyle = "#E95420";
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 1, py + 1, w - 2, h - 2);
    }

    // Label
    const label = obj.name || npcId || `#${obj.id}`;
    ctx.fillStyle = "#fff";
    ctx.font = `${Math.max(10, 3 * s)}px Ubuntu Mono, monospace`;
    ctx.textBaseline = "bottom";
    ctx.shadowColor = "#000";
    ctx.shadowBlur = 3;
    ctx.fillText(label, px + 2, py - 2);
    ctx.shadowBlur = 0;
  }
}

function getSpawnAtPixel(e: MouseEvent): TMJObject | null {
  const spawns = ensureSpawnsLayer();
  const rect = mapCanvas.getBoundingClientRect();
  const scaleX = mapCanvas.width / rect.width;
  const scaleY = mapCanvas.height / rect.height;
  const mx = (e.clientX - rect.left) * scaleX / opts.scale;
  const my = (e.clientY - rect.top) * scaleY / opts.scale;

  for (let i = spawns.length - 1; i >= 0; i--) {
    const obj = spawns[i];
    const w = obj.width || TILE_SIZE;
    const h = obj.height || TILE_SIZE * 2;
    if (mx >= obj.x && mx < obj.x + w && my >= obj.y && my < obj.y + h) {
      return obj;
    }
  }
  return null;
}

function redrawMap() {
  renderMap(mapCtx, map, tilesetImages, opts);
  renderSpawns(mapCtx);
}

function redrawPalette() {
  if (activeTilesetIndex === CATALOG_INDEX && catalog) {
    paletteCanvas.style.display = "none";
    if (!catalogTreeEl || catalogTreeScale !== paletteScale) {
      buildCatalogTree();
    }
    catalogTreeEl!.style.display = "";
    return;
  }
  if (catalogTreeEl) catalogTreeEl.style.display = "none";
  paletteCanvas.style.display = "";
  const tsi = tilesetImages[activeTilesetIndex];
  if (!tsi) return;
  renderPalette(paletteCtx, tsi, selectedGid, paletteScale);
}

function buildCatalogTree() {
  if (catalogTreeEl) catalogTreeEl.remove();
  catalogTreeEl = document.createElement("div");
  catalogTreeEl.id = "catalog-tree";
  catalogTreeScale = paletteScale;
  const ts = TILE_SIZE * paletteScale;

  const tile = (gid: number, pattern = "") =>
    `<span class="catalog-tile-wrap" data-gid="${gid}" data-pattern="${pattern}"><canvas class="catalog-tile" width="${ts}" height="${ts}"></canvas></span>`;

  const row = (label: string, tiles: string) =>
    `<div class="catalog-row"><span class="catalog-label">${label}</span><span class="catalog-tiles">${tiles}</span></div>`;

  const saved = JSON.parse(sessionStorage.getItem("catalog-open") || "{}") as Record<string, boolean>;
  const det = (id: string, label: string) => {
    const open = saved[id] !== undefined ? saved[id] : true;
    return `<details data-cat-id="${id}"${open ? " open" : ""}><summary>${label}</summary>`;
  };

  let html = det("fill", "fill");
  const groups = new Map<string, [string, number[]][]>();
  for (const [name, terrain] of Object.entries(catalog!.terrains)) {
    const parts = name.split("_");
    if (parts.length >= 2) {
      const prefix = parts[0];
      const rest = parts.slice(1).join("_");
      if (!groups.has(prefix)) groups.set(prefix, []);
      groups.get(prefix)!.push([rest, terrain.fill]);
    } else {
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name)!.push(["", terrain.fill]);
    }
  }
  for (const [group, entries] of groups) {
    if (entries.length === 1 && entries[0][0] === "") {
      html += row(group, entries[0][1].map(g => tile(g)).join(""));
    } else if (entries.length === 1) {
      html += row(`${group}_${entries[0][0]}`, entries[0][1].map(g => tile(g)).join(""));
    } else {
      html += det(`f-${group}`, group);
      for (const [sub, fills] of entries) {
        html += row(sub, fills.map(g => tile(g)).join(""));
      }
      html += "</details>";
    }
  }
  html += "</details>";

  html += det("transition", "transition");
  for (const [name, trans] of Object.entries(catalog!.transitions)) {
    const keys = Object.keys(trans.key);
    const secondary = keys[1];
    const keyLabel = Object.entries(trans.key).map(([k, v]) => `${k}=${v}`).join(" ");

    const byCount = new Map<number, { pattern: string; gids: number[] }[]>();
    for (const [pattern, gids] of Object.entries(trans.patterns)) {
      const count = [...pattern].filter(c => c === secondary).length;
      if (!byCount.has(count)) byCount.set(count, []);
      byCount.get(count)!.push({ pattern, gids });
    }

    html += det(`t-${name}`, `${name} (${keyLabel})`);
    for (const count of [...byCount.keys()].sort((a, b) => b - a)) {
      const tiles = byCount.get(count)!
        .flatMap(({ pattern, gids }) => gids.map(g => tile(g, pattern)))
        .join("");
      html += row(`${count}/8 ${secondary}`, tiles);
    }
    html += "</details>";
  }
  html += "</details>";

  if (catalog!.details) {
    html += det("detail", "detail");
    const byCategory = new Map<string, { name: string; tiles: number[] }[]>();
    for (const [name, detail] of Object.entries(catalog!.details)) {
      if (!byCategory.has(detail.category)) byCategory.set(detail.category, []);
      byCategory.get(detail.category)!.push({ name, tiles: detail.tiles });
    }
    for (const [category, entries] of byCategory) {
      html += det(`d-${category}`, category);
      for (const { name, tiles } of entries) {
        html += row(name, tiles.map(g => tile(g)).join(""));
      }
      html += "</details>";
    }
    html += "</details>";
  }

  html += det("stamp", "stamp");
  for (const [name, stamp] of Object.entries(catalog!.stamps)) {
    html += `<div class="catalog-row catalog-row-stamp"><span class="catalog-label">${name}</span>`;
    html += `<div class="catalog-stamp-grid" style="grid-template-columns:repeat(${stamp.size[0]},${ts}px)">`;
    for (const gridRow of stamp.tiles) {
      for (const gid of gridRow) html += tile(gid);
    }
    html += "</div></div>";
  }
  html += "</details>";

  catalogTreeEl.innerHTML = html;

  // Draw tiles on canvases (inherently imperative — separated from structure)
  for (const wrap of catalogTreeEl.querySelectorAll<HTMLElement>(".catalog-tile-wrap")) {
    const gid = parseInt(wrap.dataset.gid!, 10);
    const c = wrap.querySelector("canvas")!;
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    for (let t = tilesetImages.length - 1; t >= 0; t--) {
      if (gid >= tilesetImages[t].tileset.firstgid) {
        const tileset = tilesetImages[t].tileset;
        const localId = gid - tileset.firstgid;
        const sx = (localId % tileset.columns) * TILE_SIZE;
        const sy = Math.floor(localId / tileset.columns) * TILE_SIZE;
        ctx.drawImage(tilesetImages[t].img, sx, sy, TILE_SIZE, TILE_SIZE, 0, 0, ts, ts);
        break;
      }
    }
    if (gid === selectedGid) c.classList.add("selected");
  }

  // Event delegation
  catalogTreeEl.addEventListener("click", (e) => {
    const wrap = (e.target as HTMLElement).closest(".catalog-tile-wrap") as HTMLElement | null;
    if (!wrap?.dataset.gid) return;
    selectedGid = parseInt(wrap.dataset.gid, 10);
    tileInfo.textContent = `GID ${selectedGid} (catalog)`;
    catalogTreeEl!.querySelectorAll(".catalog-tile.selected").forEach(el => el.classList.remove("selected"));
    wrap.querySelector(".catalog-tile")!.classList.add("selected");
  });

  catalogTreeEl.addEventListener("mouseover", (e) => {
    const wrap = (e.target as HTMLElement).closest(".catalog-tile-wrap") as HTMLElement | null;
    if (!wrap?.dataset.gid) return;
    const p = wrap.dataset.pattern;
    tileInfo.textContent = p ? `GID ${wrap.dataset.gid} ${p}` : `GID ${wrap.dataset.gid}`;
  });

  catalogTreeEl.addEventListener("mouseout", (e) => {
    const wrap = (e.target as HTMLElement).closest(".catalog-tile-wrap") as HTMLElement | null;
    if (wrap) tileInfo.textContent = selectedGid !== null ? `GID ${selectedGid} (catalog)` : "";
  });

  catalogTreeEl.addEventListener("toggle", (e) => {
    const det = e.target as HTMLDetailsElement;
    const id = det.dataset.catId;
    if (!id) return;
    const state = JSON.parse(sessionStorage.getItem("catalog-open") || "{}");
    state[id] = det.open;
    sessionStorage.setItem("catalog-open", JSON.stringify(state));
  }, true);

  paletteScroll.appendChild(catalogTreeEl);
}

function selectGid(gid: number) {
  let tsiIndex = -1;
  for (let i = tilesetImages.length - 1; i >= 0; i--) {
    const ts = tilesetImages[i].tileset;
    if (gid >= ts.firstgid && gid < ts.firstgid + ts.tilecount) {
      tsiIndex = i;
      break;
    }
  }
  if (tsiIndex < 0) return;

  const tsi = tilesetImages[tsiIndex];
  selectedGid = gid;

  if (activeTilesetIndex !== tsiIndex) {
    activeTilesetIndex = tsiIndex;
    tilesetSelect.value = String(tsiIndex);
  }

  tileInfo.textContent = `GID ${gid} | ${tsi.tileset.name} [${(gid - tsi.tileset.firstgid) % tsi.tileset.columns}, ${Math.floor((gid - tsi.tileset.firstgid) / tsi.tileset.columns)}]`;
  redrawPalette();

  const localId = gid - tsi.tileset.firstgid;
  const row = Math.floor(localId / tsi.tileset.columns);
  const tileY = row * tsi.tileset.tileheight * paletteScale;
  const scrollTop = tileY - paletteScroll.clientHeight / 2;
  paletteScroll.scrollTop = Math.max(0, scrollTop);
}

let gidBuffer = "";
let gidTimer: ReturnType<typeof setTimeout> | null = null;
const GID_TIMEOUT = 600; // ms to wait for more digits

function bindEvents() {
  document.querySelectorAll<HTMLLIElement>("#tool-list .tool").forEach((li) => {
    li.addEventListener("click", () => {
      document.querySelectorAll("#tool-list .tool").forEach((el) => el.classList.remove("active"));
      li.classList.add("active");
      tool = li.dataset.tool as typeof tool;
      mapCanvas.style.cursor =
        tool === "inspect" ? "help" : tool === "erase" ? "not-allowed" : "crosshair";
    });
  });

  tilesetSelect.addEventListener("change", () => {
    activeTilesetIndex = Number(tilesetSelect.value);
    selectedGid = null;
    redrawPalette();
    tileInfo.textContent = "";
  });

  paletteCanvas.addEventListener("click", (e) => {
    const tsi = tilesetImages[activeTilesetIndex];
    if (!tsi) return;
    const rect = paletteCanvas.getBoundingClientRect();
    const scaleX = paletteCanvas.width / rect.width;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleX;
    const col = Math.floor(px / (tsi.tileset.tilewidth * paletteScale));
    const row = Math.floor(py / (tsi.tileset.tileheight * paletteScale));
    const localId = row * tsi.tileset.columns + col;
    if (localId >= tsi.tileset.tilecount) return;
    selectGid(tsi.tileset.firstgid + localId);
  });

  window.addEventListener("keydown", (e) => {
    if (e.key >= "0" && e.key <= "9") {
      e.preventDefault();
      gidBuffer += e.key;
      tileInfo.textContent = `GID ${gidBuffer}…`;
      if (gidTimer) clearTimeout(gidTimer);
      gidTimer = setTimeout(() => {
        const gid = parseInt(gidBuffer, 10);
        gidBuffer = "";
        if (gid > 0) selectGid(gid);
      }, GID_TIMEOUT);
    }
  });

  mapCanvas.addEventListener("mousedown", (e) => {
    // Check if clicking on a spawn point first
    const spawn = getSpawnAtPixel(e);
    if (spawn) {
      draggingSpawn = spawn;
      mapCanvas.style.cursor = "grabbing";
      return;
    }
    if (tool === "inspect") return;
    painting = true;
    applyTool(e);
  });
  mapCanvas.addEventListener("mousemove", (e) => {
    if (draggingSpawn) {
      const rect = mapCanvas.getBoundingClientRect();
      const scaleX = mapCanvas.width / rect.width;
      const scaleY = mapCanvas.height / rect.height;
      const mx = (e.clientX - rect.left) * scaleX / opts.scale;
      const my = (e.clientY - rect.top) * scaleY / opts.scale;
      // Snap to tile grid
      draggingSpawn.x = Math.round(mx / TILE_SIZE) * TILE_SIZE;
      draggingSpawn.y = Math.round(my / TILE_SIZE) * TILE_SIZE;
      redrawMap();
      tileInfo.textContent = `Moving ${draggingSpawn.name || "#" + draggingSpawn.id} to (${draggingSpawn.x}, ${draggingSpawn.y})`;
      return;
    }
    if (tool === "inspect") {
      showInspector(e);
    } else if (painting) {
      applyTool(e);
    } else if (showSpawns) {
      const hover = getSpawnAtPixel(e);
      mapCanvas.style.cursor = hover ? "grab" : tool === "erase" ? "not-allowed" : "crosshair";
    }
  });
  mapCanvas.addEventListener("mouseup", () => {
    if (draggingSpawn) {
      draggingSpawn = null;
      mapCanvas.style.cursor = "crosshair";
      scheduleSave();
      return;
    }
    painting = false;
  });
  mapCanvas.addEventListener("mouseleave", () => {
    if (draggingSpawn) {
      draggingSpawn = null;
      mapCanvas.style.cursor = "crosshair";
      scheduleSave();
    }
    painting = false;
    tooltip.style.display = "none";
  });

  // Double-click to add new spawn point
  mapCanvas.addEventListener("dblclick", (e) => {
    const rect = mapCanvas.getBoundingClientRect();
    const scaleX = mapCanvas.width / rect.width;
    const scaleY = mapCanvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX / opts.scale;
    const my = (e.clientY - rect.top) * scaleY / opts.scale;
    const tileX = Math.floor(mx / TILE_SIZE) * TILE_SIZE;
    const tileY = Math.floor(my / TILE_SIZE) * TILE_SIZE;

    // Don't add if there's already a spawn here
    if (getSpawnAtPixel(e)) return;

    const spawns = ensureSpawnsLayer();
    const nextId = spawns.reduce((max, o) => Math.max(max, o.id), 0) + 1;
    const name = prompt("NPC name (or cancel):");
    if (!name) return;

    spawns.push({
      id: nextId,
      name,
      type: "spawn",
      x: tileX,
      y: tileY,
      width: TILE_SIZE,
      height: TILE_SIZE * 2,
      properties: [{ name: "npcId", type: "string", value: name.toLowerCase().replace(/\s+/g, "-") }],
    });
    redrawMap();
    scheduleSave();
  });

  canvasWrap.addEventListener("wheel", (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const prev = mapScale;
    mapScale = Math.min(MAX_SCALE, Math.max(getMinMapScale(), mapScale + (e.deltaY < 0 ? 1 : -1)));
    if (mapScale === prev) return;
    opts.scale = mapScale;
    const rect = canvasWrap.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const rx = canvasWrap.scrollLeft + cx;
    const ry = canvasWrap.scrollTop + cy;
    const ratio = mapScale / prev;
    redrawMap();
    canvasWrap.scrollLeft = rx * ratio - cx;
    canvasWrap.scrollTop = ry * ratio - cy;
  }, { passive: false });

  paletteScroll.addEventListener("wheel", (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const prev = paletteScale;
    paletteScale = Math.min(MAX_SCALE, Math.max(1, paletteScale + (e.deltaY < 0 ? 1 : -1)));
    if (paletteScale === prev) return;
    const rect = paletteScroll.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const rx = paletteScroll.scrollLeft + cx;
    const ry = paletteScroll.scrollTop + cy;
    const ratio = paletteScale / prev;
    redrawPalette();
    paletteScroll.scrollLeft = rx * ratio - cx;
    paletteScroll.scrollTop = ry * ratio - cy;
  }, { passive: false });

  window.addEventListener("resize", () => {
    const min = getMinMapScale();
    if (mapScale < min) {
      mapScale = Math.min(MAX_SCALE, min);
      opts.scale = mapScale;
      redrawMap();
    }
  });
}

function getTileIndex(e: MouseEvent): number | null {
  const rect = mapCanvas.getBoundingClientRect();
  const scaleX = mapCanvas.width / rect.width;
  const scaleY = mapCanvas.height / rect.height;
  const px = (e.clientX - rect.left) * scaleX;
  const py = (e.clientY - rect.top) * scaleY;
  const col = Math.floor(px / (map.tilewidth * opts.scale));
  const row = Math.floor(py / (map.tileheight * opts.scale));
  if (col < 0 || col >= map.width || row < 0 || row >= map.height) return null;
  return row * map.width + col;
}

function applyTool(e: MouseEvent) {
  const idx = getTileIndex(e);
  if (idx === null) return;

  const layer = map.layers.find((l) => l.name === activeLayer);
  if (!layer?.data) return;

  if (tool === "paint" && selectedGid !== null) {
    layer.data[idx] = selectedGid;
  } else if (tool === "erase") {
    layer.data[idx] = 0;
  }

  redrawMap();
  scheduleSave();
}

function showInspector(e: MouseEvent) {
  const idx = getTileIndex(e);
  if (idx === null) {
    tooltip.style.display = "none";
    return;
  }

  const col = idx % map.width;
  const row = Math.floor(idx / map.width);

  const lines: string[] = [`tile [${col}, ${row}]  index ${idx}`];
  for (const layer of map.layers) {
    if (layer.type !== "tilelayer" || !layer.data) continue;
    const gid = layer.data[idx];
    if (gid > 0) {
      const tsName = findTilesetName(gid);
      lines.push(`  ${layer.name}: GID ${gid} (${tsName})`);
    }
  }

  const spawn = getSpawnAtPixel(e);
  if (spawn) {
    const npcId = spawn.properties?.find((p) => p.name === "npcId")?.value;
    lines.push(`  spawn: ${spawn.name} (${npcId ?? "no id"}) at (${spawn.x}, ${spawn.y})`);
  }

  tooltip.textContent = lines.join("\n");
  tooltip.style.display = "block";
  tooltip.style.left = `${e.clientX + 14}px`;
  tooltip.style.top = `${e.clientY + 14}px`;
}

function findTilesetName(gid: number): string {
  for (let i = tilesetImages.length - 1; i >= 0; i--) {
    if (gid >= tilesetImages[i].tileset.firstgid) {
      return tilesetImages[i].tileset.name;
    }
  }
  return "?";
}

init();
