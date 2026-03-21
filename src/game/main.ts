import { Application, Container, TextureSource } from "pixi.js";

TextureSource.defaultOptions.scaleMode = "nearest";
import { applyViewport } from "./viewport";
import { findNearestNpc, getNpcPositions, updateEmote, type NpcData } from "./npcs";
import { updatePlayerSprite } from "./player";
import { initInput, updatePlayer, updateCamera, applyCamera } from "./camera";
import { startDialogue, updateDialogue, handleDialogueInput, isDialogueActive, dialogueEndedWithGift } from "./dialogue";
import { showGiftPopup, dismissGiftPopup, isGiftPopupActive } from "./giftPopup";
import { loadScene, startSceneMusic, unloadScene, type Scene } from "./scene";
import { loadBitmapFont } from "./bitmapfont";

const BASE = import.meta.env.BASE_URL;

async function boot() {
  const app = new Application();
  await app.init({
    width: 480,
    height: 270,
    backgroundColor: 0x000000,
    antialias: false,
    roundPixels: true,
  });
  document.body.appendChild(app.canvas);
  applyViewport(app);

  await loadBitmapFont();

  const params = new URLSearchParams(window.location.search);
  const skipIntro = params.has("x") || params.has("y");
  const startMap = skipIntro ? "village" : "bedroom";
  const startX = params.has("x") ? Number(params.get("x")) * 16 : undefined;
  const startY = params.has("y") ? Number(params.get("y")) * 16 : undefined;

  let scene: Scene = await loadScene(startMap, app.stage, startX, startY);

  const onResize = () => applyViewport(app);
  window.addEventListener("resize", onResize);

  // Loading / wake-up screen
  if (skipIntro) {
    document.getElementById("loading-screen")?.remove();
    startSceneMusic(startMap);
  } else {
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
        startSceneMusic(scene.name);
        setTimeout(() => { loadingScreen?.remove(); resolve(); }, 800);
      };
      window.addEventListener("keydown", dismiss);
      window.addEventListener("touchstart", dismiss);
    });
  }

  const cleanupInput = initInput();
  let talkingTo: NpcData | null = null;
  const inventory = new Set<string>();
  let transitioning = false;

  async function transitionTo(targetMap: string, tx: number, ty: number) {
    unloadScene(scene, app.stage);
    scene = await loadScene(targetMap, app.stage, tx * 16, ty * 16);
    startSceneMusic(targetMap);
    transitioning = false;
  }

  // Check if player is on a warp tile
  function checkWarps() {
    if (transitioning) return;
    const spawns = scene.map.layers.find((l) => l.type === "objectgroup" && l.name === "spawns");
    if (!spawns?.objects) return;
    for (const obj of spawns.objects) {
      if (obj.type !== "warp") continue;
      const px = scene.player.x + 8;
      const py = scene.player.y + 8;
      if (px >= obj.x && px < obj.x + obj.width && py >= obj.y && py < obj.y + obj.height) {
        const target = obj.properties?.find((p) => p.name === "target")?.value;
        const targetX = obj.properties?.find((p) => p.name === "targetX")?.value;
        const targetY = obj.properties?.find((p) => p.name === "targetY")?.value;
        if (target) {
          transitioning = true;
          void transitionTo(target, Number(targetX ?? 0), Number(targetY ?? 0));
          return;
        }
      }
    }
  }

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
            void showGiftPopup(talkingTo.giftObject!, talkingTo.giftSprite, scene.uiLayer);
          }
          talkingTo = null;
        }
        return;
      }

      if (scene.name === "village") {
        const npc = findNearestNpc(scene.player.x, scene.player.y);
        if (npc) {
          talkingTo = npc;
          const tree = npc.dialogueTree ?? {
            id: "default",
            text: "Happy birthday!",
            responses: null,
          };
          void startDialogue(tree, npc.name, scene.uiLayer, npc.voice, npc.voiceData, npc.voiceStart, npc.voiceEnd);
        }
      }
    }
    if (isDialogueActive() && (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "w" || e.key === "s")) {
      e.preventDefault();
      handleDialogueInput(e.key);
    }
  };
  window.addEventListener("keydown", onInteract);

  app.ticker.add(() => {
    if (transitioning) return;
    if (!isDialogueActive() && !isGiftPopupActive()) {
      const npcs = scene.name === "village" ? getNpcPositions() : undefined;
      updatePlayer(scene.player, scene.mapWidth, scene.mapHeight, scene.collision, npcs);
      checkWarps();
      if (transitioning) return;
    }
    updatePlayerSprite(scene.playerSprite, scene.player);
    updateCamera(scene.camera, scene.player, scene.mapWidth, scene.mapHeight);
    applyCamera(scene.world, scene.camera);
    if (scene.name === "village") {
      updateEmote(scene.player.x, scene.player.y, isDialogueActive());
    }
    updateDialogue();
  });

  return () => {
    cleanupInput();
    window.removeEventListener("resize", onResize);
    window.removeEventListener("keydown", onInteract);
  };
}

boot();
