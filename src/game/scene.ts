import { Assets, Container, Graphics, Sprite, Texture } from "pixi.js";
import { loadTilemap } from "./tilemap";
import { loadNpcSprites, getNpcPositions, initEmote, updateEmote } from "./npcs";
import { createPlayer, createCamera, updatePlayer, updateCamera, applyCamera, type PlayerState, type NpcCollider, type HalfCollision } from "./camera";
import { playMusic } from "./music";
import { initAtmosphere, updateAtmosphere, destroyAtmosphere } from "./atmosphere";
import { loadAnimals, loadHeartEmote, updateAnimals, destroyAnimals, getAnimalColliders, interactWithAnimal } from "./animals";
import { initFoley, updateFoley, initWaterAmbient, updateWaterAmbient, destroyWaterAmbient } from "./foley";
import { initPots, tryBreakPot, destroyPots } from "./pots";
import { db, ref, get } from "../shared/firebase";
import type { Submission } from "../shared/types";
import { spriteDataToTexture } from "./sprites";
import type { TMJMap } from "../shared/tmj";

const BASE = import.meta.env.BASE_URL;
const TILE = 16;

const MUSIC: Record<string, string> = {
  bedroom: "music-bedroom.ogg",
  home: "music-bedroom.ogg",
  village: "music-village.ogg",
};

let cachedPlayerTexture: Texture | null = null;

async function getPlayerTexture(): Promise<Texture> {
  if (cachedPlayerTexture) return cachedPlayerTexture;
  try {
    const snapshot = await get(ref(db, "submissions/player"));
    if (snapshot.exists()) {
      const sub = snapshot.val() as Submission;
      if (sub.spriteData) {
        cachedPlayerTexture = spriteDataToTexture(sub.spriteData);
        return cachedPlayerTexture;
      }
    }
  } catch {}
  cachedPlayerTexture = await Assets.load<Texture>(`${BASE}sprites/player-default.png`);
  return cachedPlayerTexture;
}

export interface Scene {
  name: string;
  world: Container;
  uiLayer: Container;
  player: PlayerState;
  playerSprite: Sprite;
  playerMask: Graphics;
  mapWidth: number;
  mapHeight: number;
  collision: Set<number>;
  halfCollision: HalfCollision;
  depthTiles: Set<number>;
  fieldTiles: Set<number>;
  waterTiles: Set<number>;
  camera: { x: number; y: number };
  map: TMJMap;
  hasNpcs: boolean;
  hasAtmosphere: boolean;
}

export async function loadScene(
  name: string,
  stage: Container,
  startX?: number,
  startY?: number,
  arrivalSpawn?: string,
): Promise<Scene> {
  const world = new Container();
  world.visible = false;
  const uiLayer = new Container();

  const { base, decorBelow, decorAbove, collision, halfCollision, depthTiles, fieldTiles, waterTiles, tileTextures, mapWidth, mapHeight, map } = await loadTilemap(
    `${BASE}maps/${name}.tmj`,
    `${BASE}tilesets`
  );
  world.addChild(base);
  world.addChild(decorBelow);

  // Priority: arrivalSpawn > startX/startY > player_start spawn > map center
  let defaultX = (mapWidth - TILE) / 2;
  let defaultY = (mapHeight - TILE) / 2;
  const spawnsLayer = map.layers.find((l) => l.type === "objectgroup" && l.name === "spawns");
  if (spawnsLayer?.objects) {
    const playerSpawn = spawnsLayer.objects.find((o) =>
      o.properties?.some((p) => p.name === "npcId" && p.value === "player")
    );
    if (playerSpawn) { defaultX = playerSpawn.x; defaultY = playerSpawn.y; }
  }

  if (arrivalSpawn) {
    const arrival = findArrivalPosition(map, arrivalSpawn);
    if (arrival) { defaultX = arrival.x; defaultY = arrival.y; }
  }

  const playerTexture = await getPlayerTexture();
  const playerSprite = new Sprite(playerTexture);
  const playerMask = new Graphics();
  playerSprite.mask = playerMask;

  const px = startX ?? defaultX;
  const py = startY ?? defaultY;
  const player = createPlayer(
    Math.max(0, Math.min(px, mapWidth - TILE)),
    Math.max(0, Math.min(py, mapHeight - TILE))
  );
  playerSprite.x = player.x;
  playerSprite.y = player.y;
  playerMask.rect(player.x, player.y, TILE, TILE).fill(0xffffff);

  // Load NPCs for any map — Firebase is the source of truth for which NPCs appear where
  const hasNpcs = name === "village" || name === "home";
  const hasAtmosphere = name === "village";
  if (hasNpcs) {
    const { bottom, top } = await loadNpcSprites(name, map, collision);
    world.addChild(bottom);
    world.addChild(playerSprite);
    world.addChild(playerMask);
    world.addChild(top);
    world.addChild(decorAbove);
    await initEmote(world);
  } else {
    world.addChild(playerSprite);
    world.addChild(playerMask);
    world.addChild(decorAbove);
  }
  initPots(map, tileTextures, collision, depthTiles, decorBelow, decorAbove);
  if (hasAtmosphere) await initAtmosphere(world);
  await loadAnimals(map, decorBelow, decorAbove);
  await loadHeartEmote(world);
  if (fieldTiles.size > 0) initFoley();
  if (waterTiles.size > 0) initWaterAmbient();

  const camera = createCamera();
  updateCamera(camera, player, mapWidth, mapHeight);
  applyCamera(world, camera);

  stage.addChild(world);
  stage.addChild(uiLayer);
  world.visible = true;

  return { name, world, uiLayer, player, playerSprite, playerMask, mapWidth, mapHeight, collision, halfCollision, depthTiles, fieldTiles, waterTiles, camera, map, hasNpcs, hasAtmosphere };
}

export function updateScene(scene: Scene, frozen: boolean): void {
  if (!frozen) {
    const npcs: NpcCollider[] | undefined = scene.hasNpcs ? getNpcPositions() : undefined;
    const animalCols = getAnimalColliders();
    const allNpcs = [...(npcs ?? []), ...animalCols];
    updatePlayer(scene.player, scene.mapWidth, scene.mapHeight, scene.collision, allNpcs, scene.depthTiles, scene.halfCollision);
    scene.playerSprite.x = scene.player.x;
    scene.playerSprite.y = scene.player.y;

    // Mask bottom half of player when on field tiles
    const cx = Math.floor((scene.player.x + 8) / TILE);
    const cy = Math.floor((scene.player.y + 8) / TILE);
    const onField = scene.fieldTiles.has(cy * (scene.mapWidth / TILE) + cx);
    scene.playerMask.clear();
    if (onField) {
      scene.playerMask.rect(scene.player.x, scene.player.y, TILE, TILE / 2).fill(0xffffff);
    } else {
      scene.playerMask.rect(scene.player.x, scene.player.y, TILE, TILE).fill(0xffffff);
    }
  }
  updateCamera(scene.camera, scene.player, scene.mapWidth, scene.mapHeight);
  applyCamera(scene.world, scene.camera);
  if (scene.hasNpcs) updateEmote(scene.player.x, scene.player.y, frozen, scene.name === "home" || scene.name === "bedroom");
  if (scene.hasAtmosphere) updateAtmosphere(scene.camera.x, scene.camera.y);
  if (!frozen && scene.fieldTiles.size > 0) updateFoley(scene.player.x, scene.player.y, scene.mapWidth, scene.fieldTiles);
  if (scene.waterTiles.size > 0) updateWaterAmbient(scene.player.x, scene.player.y, scene.mapWidth, scene.waterTiles);
  updateAnimals();
}

export function findWarp(scene: Scene): { target: string; targetSpawn?: string; x: number; y: number } | null {
  const spawns = scene.map.layers.find((l) => l.type === "objectgroup" && l.name === "spawns");
  if (!spawns?.objects) return null;
  const cx = scene.player.x + 8;
  const cy = scene.player.y + 8;
  for (const obj of spawns.objects) {
    if (obj.type !== "warp") continue;
    if (cx >= obj.x && cx < obj.x + obj.width && cy >= obj.y && cy < obj.y + obj.height) {
      const target = obj.properties?.find((p) => p.name === "target")?.value;
      if (target) {
        const targetSpawn = obj.properties?.find((p) => p.name === "targetSpawn")?.value;
        return {
          target,
          targetSpawn,
          x: Number(obj.properties?.find((p) => p.name === "targetX")?.value ?? 0),
          y: Number(obj.properties?.find((p) => p.name === "targetY")?.value ?? 0),
        };
      }
    }
  }
  return null;
}

function findArrivalPosition(map: TMJMap, spawnName: string): { x: number; y: number } | null {
  const spawns = map.layers.find((l) => l.type === "objectgroup" && l.name === "spawns");
  if (!spawns?.objects) return null;
  const obj = spawns.objects.find((o) => o.name === spawnName && o.type === "arrival");
  return obj ? { x: obj.x, y: obj.y } : null;
}

export function startSceneMusic(name: string): void {
  const track = MUSIC[name];
  if (track) playMusic(track);
}

export { interactWithAnimal } from "./animals";

export function unloadScene(scene: Scene, stage: Container): void {
  if (scene.hasAtmosphere) destroyAtmosphere();
  destroyAnimals();
  destroyPots();
  destroyWaterAmbient();
  stage.removeChild(scene.world);
  stage.removeChild(scene.uiLayer);
  scene.world.destroy({ children: true });
  scene.uiLayer.destroy({ children: true });
}
