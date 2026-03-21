import { Application, Container, TextureSource } from "pixi.js";

TextureSource.defaultOptions.scaleMode = "nearest";
import { applyViewport } from "./viewport";
import { loadTilemap } from "./tilemap";
import { loadNpcSprites, findNearestNpc, initEmote, updateEmote, type NpcData } from "./npcs";
import { loadPlayerSprite, updatePlayerSprite } from "./player";
import { initInput, createPlayer, createCamera, updatePlayer, updateCamera, applyCamera } from "./camera";
import { startDialogue, updateDialogue, handleDialogueInput, isDialogueActive, dialogueEndedWithGift } from "./dialogue";
import { showGiftPopup, dismissGiftPopup, isGiftPopupActive } from "./giftPopup";

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

  // UI layer (fixed to screen, not scrolled with world)
  const uiLayer = new Container();
  app.stage.addChild(uiLayer);

  const { container: mapContainer, mapWidth, mapHeight, map } = await loadTilemap(
    `${BASE}maps/village.tmj`,
    `${BASE}tilesets`
  );
  world.addChild(mapContainer);

  const npcContainer = await loadNpcSprites(map);
  world.addChild(npcContainer);

  const cleanupInput = initInput();
  const params = new URLSearchParams(window.location.search);
  const startX = params.has("x") ? Number(params.get("x")) * 16 : (mapWidth - 16) / 2;
  const startY = params.has("y") ? Number(params.get("y")) * 16 : (mapHeight - 16) / 2;
  const player = createPlayer(
    Math.max(0, Math.min(startX, mapWidth - 16)),
    Math.max(0, Math.min(startY, mapHeight - 16))
  );

  const playerSprite = await loadPlayerSprite();
  playerSprite.x = player.x;
  playerSprite.y = player.y;
  world.addChild(playerSprite);

  // Emote layer on top of everything in the world
  await initEmote(world);
  const camera = createCamera();

  const onResize = () => applyViewport(app);
  window.addEventListener("resize", onResize);

  const params2 = new URLSearchParams(window.location.search);
  const skipIntro = params2.has("x") || params2.has("y");

  if (skipIntro) {
    document.getElementById("loading-screen")?.remove();
  } else {
    // Show "Wake up" and wait for input
    const loadingText = document.getElementById("loading-text");
    const loadingScreen = document.getElementById("loading-screen");
    if (loadingText) {
      loadingText.textContent = "Wake up";
      loadingText.style.color = "#fff";
    }
    await new Promise<void>((resolve) => {
      const dismiss = (e: KeyboardEvent | TouchEvent) => {
        if (e instanceof KeyboardEvent && !["Enter", " ", "e"].includes(e.key)) return;
        window.removeEventListener("keydown", dismiss);
        window.removeEventListener("touchstart", dismiss);
        loadingScreen?.classList.add("fade-out");
        setTimeout(() => { loadingScreen?.remove(); resolve(); }, 800);
      };
      window.addEventListener("keydown", dismiss);
      window.addEventListener("touchstart", dismiss);
    });
  }

  let talkingTo: NpcData | null = null;
  const inventory = new Set<string>();

  const onInteract = (e: KeyboardEvent) => {
    if (e.key === " " || e.key === "Enter" || e.key === "e") {
      e.preventDefault();

      if (isGiftPopupActive()) {
        dismissGiftPopup();
        return;
      }

      if (isDialogueActive()) {
        handleDialogueInput(e.key);
        if (!isDialogueActive() && talkingTo) {
          const shouldGift = dialogueEndedWithGift()
            && talkingTo.giftObject
            && !inventory.has(talkingTo.token);
          if (shouldGift) {
            inventory.add(talkingTo.token);
            talkingTo.interacted = true;
            void showGiftPopup(talkingTo.giftObject!, talkingTo.giftSprite, uiLayer);
          }
          talkingTo = null;
        }
        return;
      }

      const npc = findNearestNpc(player.x, player.y);
      if (npc) {
        talkingTo = npc;
        const tree = npc.dialogueTree ?? {
          id: "default",
          text: "Happy birthday!",
          responses: null,
        };
        void startDialogue(tree, npc.name, uiLayer, npc.voice, npc.voiceData, npc.voiceStart, npc.voiceEnd);
      }
    }
    if (isDialogueActive() && (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "w" || e.key === "s")) {
      e.preventDefault();
      handleDialogueInput(e.key);
    }
  };
  window.addEventListener("keydown", onInteract);

  app.ticker.add(() => {
    if (!isDialogueActive() && !isGiftPopupActive()) {
      updatePlayer(player, mapWidth, mapHeight);
    }
    updatePlayerSprite(playerSprite, player);
    updateCamera(camera, player, mapWidth, mapHeight);
    applyCamera(world, camera);
    updateEmote(player.x, player.y, isDialogueActive());
    updateDialogue();
  });

  return () => {
    cleanupInput();
    window.removeEventListener("resize", onResize);
    window.removeEventListener("keydown", onInteract);
  };
}

boot();
