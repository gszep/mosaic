import { Container, Sprite } from "pixi.js";
import { loadTilemap } from "./tilemap";
import { loadNpcSprites, initEmote } from "./npcs";
import { loadPlayerSprite } from "./player";
import { createPlayer, createCamera, updateCamera, applyCamera, type PlayerState } from "./camera";
import { playMusic } from "./music";
import type { TMJMap } from "../shared/tmj";

const BASE = import.meta.env.BASE_URL;

export interface Scene {
  name: string;
  world: Container;
  uiLayer: Container;
  player: PlayerState;
  playerSprite: Sprite;
  mapWidth: number;
  mapHeight: number;
  collision: Set<number>;
  camera: { x: number; y: number };
  map: TMJMap;
}

const MUSIC: Record<string, string> = {
  bedroom: "music-bedroom.ogg",
  home: "music-bedroom.ogg",
  village: "music-village.ogg",
};

export async function loadScene(
  name: string,
  stage: Container,
  startX?: number,
  startY?: number,
): Promise<Scene> {
  const world = new Container();
  world.visible = false;
  const uiLayer = new Container();

  const { container: mapContainer, collision, mapWidth, mapHeight, map } = await loadTilemap(
    `${BASE}maps/${name}.tmj`,
    `${BASE}tilesets`
  );
  world.addChild(mapContainer);

  const playerSprite = await loadPlayerSprite();
  const px = startX ?? (mapWidth - 16) / 2;
  const py = startY ?? (mapHeight - 16) / 2;
  const player = createPlayer(Math.max(0, Math.min(px, mapWidth - 16)), Math.max(0, Math.min(py, mapHeight - 16)));
  playerSprite.x = player.x;
  playerSprite.y = player.y;

  if (name === "village") {
    const { bottom, top } = await loadNpcSprites(map);
    world.addChild(bottom);
    world.addChild(playerSprite);
    world.addChild(top);
    await initEmote(world);
  } else {
    world.addChild(playerSprite);
  }

  const camera = createCamera();
  updateCamera(camera, player, mapWidth, mapHeight);
  applyCamera(world, camera);

  // Add to stage and reveal only after everything is ready
  stage.addChild(world);
  stage.addChild(uiLayer);
  world.visible = true;

  return { name, world, uiLayer, player, playerSprite, mapWidth, mapHeight, collision, camera, map };
}

export function startSceneMusic(name: string): void {
  const track = MUSIC[name];
  if (track) playMusic(track);
}

export function unloadScene(scene: Scene, stage: Container): void {
  stage.removeChild(scene.world);
  stage.removeChild(scene.uiLayer);
  scene.world.destroy({ children: true });
  scene.uiLayer.destroy({ children: true });
}
