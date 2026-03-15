import { Application } from "pixi.js";
import { applyViewport } from "./viewport";
import { loadTilemap } from "./tilemap";
import { loadNpcSprites } from "./npcs";
import { initInput, createCamera, updateCamera, applyCamera } from "./camera";

const BASE = import.meta.env.BASE_URL;

async function boot() {
  const app = new Application();
  await app.init({
    width: 480,
    height: 270,
    backgroundColor: 0x1a1a2e,
    antialias: false,
    roundPixels: true,
  });
  document.body.appendChild(app.canvas);
  applyViewport(app);
  window.addEventListener("resize", () => applyViewport(app));

  const { container: mapContainer, mapWidth, mapHeight } = await loadTilemap(
    `${BASE}maps/village.tmj`,
    `${BASE}tilesets`
  );
  app.stage.addChild(mapContainer);

  const npcContainer = await loadNpcSprites(mapWidth, mapHeight);
  app.stage.addChild(npcContainer);

  initInput();
  const camera = createCamera();

  camera.x = Math.max(0, (mapWidth - 480) / 2);
  camera.y = Math.max(0, (mapHeight - 270) / 2);

  app.ticker.add(() => {
    updateCamera(camera, mapWidth, mapHeight);
    applyCamera(app.stage, camera);
  });
}

boot();
