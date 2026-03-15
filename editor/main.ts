import type { TMJMap } from "./tmj";
import { createEmptyMap } from "./tmj";
import {
  loadTilesetImage,
  renderMap,
  renderPalette,
  type TilesetImage,
  type RenderOptions,
} from "./renderer";

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

// --- State ---

let map: TMJMap;
let tilesetImages: TilesetImage[] = [];
let activeLayer = DEFAULT_LAYERS[0];
let selectedGid: number | null = null;
let activeTilesetIndex = 0;
let tool: "paint" | "erase" | "inspect" = "paint";
let painting = false;
let currentMapName = "village";

const opts: RenderOptions = {
  showGrid: true,
  showCollision: true,
  visibleLayers: new Set(DEFAULT_LAYERS),
  activeLayer: null,
  scale: mapScale,
};

// --- DOM refs ---

const mapCanvas = document.getElementById("map-canvas") as HTMLCanvasElement;
const mapCtx = mapCanvas.getContext("2d")!;
const paletteCanvas = document.getElementById("palette-canvas") as HTMLCanvasElement;
const paletteCtx = paletteCanvas.getContext("2d")!;
const layerList = document.getElementById("layer-list")!;
const tilesetSelect = document.getElementById("tileset-select") as HTMLSelectElement;
const tileInfo = document.getElementById("selected-tile-info")!;
const tooltip = document.getElementById("inspector-tooltip")!;
const canvasWrap = document.getElementById("canvas-wrap")!;
const mapListEl = document.getElementById("map-list")!;
const MAP_NAMES = ["village", "home", "bedroom"];

// --- Build tileset definitions with firstgid ---

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

// --- Auto-save (debounced) ---

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

// --- Init ---

async function init() {
  const tilesets = buildTilesetDefs();

  // Load tileset images.
  tilesetImages = await Promise.all(
    tilesets.map((ts) => loadTilesetImage(ts, `${BASE}tilesets`))
  );

  // Create default empty map.
  map = createEmptyMap(40, 30, TILE_SIZE, tilesets, DEFAULT_LAYERS);

  // Try to load existing map from server.
  const loaded = await loadMapFromServer(currentMapName);
  if (loaded) {
    map = loaded;
  }

  mapScale = getMinMapScale();
  opts.scale = mapScale;

  // Populate tileset dropdown.
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

  // Hot-reload maps when files change on disk.
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
  }
}

// --- Map list ---

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

async function switchMap(name: string) {
  currentMapName = name;
  const tilesets = buildTilesetDefs();
  const loaded = await loadMapFromServer(name);
  map = loaded ?? createEmptyMap(40, 30, TILE_SIZE, tilesets, DEFAULT_LAYERS);
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

// --- Layer list ---

function buildLayerList() {
  layerList.innerHTML = "";
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

// --- Drawing ---

function redrawMap() {
  renderMap(mapCtx, map, tilesetImages, opts);
}

function redrawPalette() {
  const tsi = tilesetImages[activeTilesetIndex];
  if (!tsi) return;
  renderPalette(paletteCtx, tsi, selectedGid, paletteScale);
}

// --- GID selection (shared by palette click + keyboard) ---

function selectGid(gid: number) {
  // Find which tileset contains this GID.
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

  // Switch tileset dropdown if needed.
  if (activeTilesetIndex !== tsiIndex) {
    activeTilesetIndex = tsiIndex;
    tilesetSelect.value = String(tsiIndex);
  }

  tileInfo.textContent = `GID ${gid} | ${tsi.tileset.name} [${(gid - tsi.tileset.firstgid) % tsi.tileset.columns}, ${Math.floor((gid - tsi.tileset.firstgid) / tsi.tileset.columns)}]`;
  redrawPalette();

  // Scroll palette to show the selected tile.
  const localId = gid - tsi.tileset.firstgid;
  const row = Math.floor(localId / tsi.tileset.columns);
  const tileY = row * tsi.tileset.tileheight * paletteScale;
  const paletteScroll = document.getElementById("palette-scroll")!;
  const scrollTop = tileY - paletteScroll.clientHeight / 2;
  paletteScroll.scrollTop = Math.max(0, scrollTop);
}

// --- Keyboard GID input ---

let gidBuffer = "";
let gidTimer: ReturnType<typeof setTimeout> | null = null;
const GID_TIMEOUT = 600; // ms to wait for more digits

// --- Events ---

function bindEvents() {
  // Tool list items.
  document.querySelectorAll<HTMLLIElement>("#tool-list .tool").forEach((li) => {
    li.addEventListener("click", () => {
      document.querySelectorAll("#tool-list .tool").forEach((el) => el.classList.remove("active"));
      li.classList.add("active");
      tool = li.dataset.tool as typeof tool;
      mapCanvas.style.cursor =
        tool === "inspect" ? "help" : tool === "erase" ? "not-allowed" : "crosshair";
    });
  });

  // Tileset select.
  tilesetSelect.addEventListener("change", () => {
    activeTilesetIndex = Number(tilesetSelect.value);
    selectedGid = null;
    redrawPalette();
    tileInfo.textContent = "";
  });

  // Palette click.
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

  // Keyboard GID input: type digits rapidly to jump to a tile by GID.
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

  // Map canvas — painting / erasing / inspecting.
  mapCanvas.addEventListener("mousedown", (e) => {
    if (tool === "inspect") return;
    painting = true;
    applyTool(e);
  });
  mapCanvas.addEventListener("mousemove", (e) => {
    if (tool === "inspect") {
      showInspector(e);
    } else if (painting) {
      applyTool(e);
    }
  });
  mapCanvas.addEventListener("mouseup", () => { painting = false; });
  mapCanvas.addEventListener("mouseleave", () => {
    painting = false;
    tooltip.style.display = "none";
  });

  // Zoom: ctrl+scroll on map canvas.
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

  // Zoom: ctrl+scroll on palette.
  const paletteScroll = document.getElementById("palette-scroll")!;
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

  // Recalculate min zoom on resize.
  window.addEventListener("resize", () => {
    const min = getMinMapScale();
    if (mapScale < min) {
      mapScale = Math.min(MAX_SCALE, min);
      opts.scale = mapScale;
      redrawMap();
    }
  });
}

// --- Tool application ---

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

// --- Boot ---

init();
