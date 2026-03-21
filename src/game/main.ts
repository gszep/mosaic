import { Application, Container } from "pixi.js";
import { applyViewport } from "./viewport";
import { loadTilemap } from "./tilemap";
import { loadNpcSprites } from "./npcs";
import { loadPlayerSprite, updatePlayerSprite } from "./player";
import { initInput, createPlayer, createCamera, updatePlayer, updateCamera, applyCamera } from "./camera";

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

  const world = new Container();
  app.stage.addChild(world);

  const { container: mapContainer, mapWidth, mapHeight, map } = await loadTilemap(
    `${BASE}maps/village.tmj`,
    `${BASE}tilesets`
  );
  world.addChild(mapContainer);

  const npcContainer = await loadNpcSprites(map);
  world.addChild(npcContainer);

  const cleanupInput = initInput();
  const player = createPlayer(
    Math.max(0, (mapWidth - 16) / 2),
    Math.max(0, (mapHeight - 16) / 2)
  );

  const playerSprite = await loadPlayerSprite();
  playerSprite.x = player.x;
  playerSprite.y = player.y;
  world.addChild(playerSprite);
  const camera = createCamera();

  const onResize = () => applyViewport(app);
  window.addEventListener("resize", onResize);

  app.ticker.add(() => {
    updatePlayer(player, mapWidth, mapHeight);
    updatePlayerSprite(playerSprite, player);
    updateCamera(camera, player, mapWidth, mapHeight);
    applyCamera(world, camera);
  });

  return () => {
    cleanupInput();
    window.removeEventListener("resize", onResize);
  };
}

boot();
