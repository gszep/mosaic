import { Application, TextureSource } from "pixi.js";
TextureSource.defaultOptions.scaleMode = "nearest";

import { applyViewport } from "./viewport";
import { findNearestNpc, type NpcData } from "./npcs";
import { db, ref, get } from "../shared/firebase";
import { initInput } from "./camera";
import { startDialogue, updateDialogue, handleDialogueInput, isDialogueActive, dialogueEndedWithGift } from "./dialogue";
import { showGiftPopup, dismissGiftPopup, isGiftPopupActive } from "./giftPopup";
import { loadScene, updateScene, findWarp, unloadScene, startSceneMusic, interactWithAnimal, type Scene } from "./scene";
import { unlockAudio } from "./music";
import { loadBitmapFont } from "./bitmapfont";
import { tryBreakPot, allPotsBroken } from "./pots";
import type { DialogueNode } from "../shared/types";
import { setEmoteOverride } from "./npcs";

const TILE = 16;

async function boot() {
  const app = new Application();
  await app.init({ width: 480, height: 270, backgroundColor: 0x000000, antialias: false, roundPixels: true });
  document.body.appendChild(app.canvas);
  applyViewport(app);
  await loadBitmapFont();

  const params = new URLSearchParams(window.location.search);
  const skipIntro = params.has("x") || params.has("y") || params.has("map");
  const startMap = params.get("map") || (skipIntro ? "village" : "bedroom");

  let scene: Scene = await loadScene(
    startMap,
    app.stage,
    params.has("x") ? Number(params.get("x")) * TILE : undefined,
    params.has("y") ? Number(params.get("y")) * TILE : undefined,
  );

  window.addEventListener("resize", () => applyViewport(app));
  initInput();

  // Wake-up screen
  if (skipIntro) {
    document.getElementById("loading-screen")?.remove();
    startSceneMusic(scene.name);
  } else {
    const loadingText = document.getElementById("loading-text");
    const loadingScreen = document.getElementById("loading-screen");
    if (loadingText) { loadingText.textContent = "Wake up"; loadingText.style.color = "#fff"; }
    await new Promise<void>((resolve) => {
      const dismiss = (e: KeyboardEvent | TouchEvent) => {
        if (e instanceof KeyboardEvent && !["Enter", " ", "e"].includes(e.key)) return;
        window.removeEventListener("keydown", dismiss);
        window.removeEventListener("touchstart", dismiss);
        loadingScreen?.classList.add("fade-out");
        unlockAudio();
        startSceneMusic(scene.name);
        setTimeout(() => { loadingScreen?.remove(); resolve(); }, 800);
      };
      window.addEventListener("keydown", dismiss);
      window.addEventListener("touchstart", dismiss);
    });
  }

  let talkingTo: NpcData | null = null;
  const inventory = new Set<string>();

  // Gift tracker: list of NPC names not yet gifted (excluding player)
  const remaining: { token: string; name: string }[] = [];
  let TOTAL_NPCS = 0;
  // Fetch async to avoid blocking the game loop
  get(ref(db, "submissions")).then((snapshot) => {
    if (snapshot.exists()) {
      const all = snapshot.val() as Record<string, { name?: string }>;
      for (const [token, sub] of Object.entries(all)) {
        if (token === "player") continue;
        remaining.push({ token, name: sub.name || token });
      }
      TOTAL_NPCS = remaining.length;
    }
  }).catch(() => {});

  // Patch Grisha's dialogue tree nodes that report game state
  function patchGrishaTree(tree: DialogueNode): void {
    const gifted = TOTAL_NPCS - remaining.length;
    const countText = `${gifted}/${TOTAL_NPCS}!`;
    const missedText = remaining.length > 0
      ? `Try talking to ${remaining[0].name}.`
      : "You got them all!";
    function walk(node: DialogueNode) {
      if (node.id === "n615z7j") { node.text = countText; return; }
      if (node.id === "nrl1j20") { node.text = missedText; return; }
      if (node.responses) {
        for (const r of node.responses) { if (r.next) walk(r.next); }
      }
    }
    walk(tree);
  }
  let transitioning = false;

  async function transition(target: string, tx: number, ty: number, targetSpawn?: string) {
    unloadScene(scene, app.stage);
    scene = await loadScene(target, app.stage, targetSpawn ? undefined : tx * TILE, targetSpawn ? undefined : ty * TILE, targetSpawn);
    startSceneMusic(target);
    transitioning = false;
  }

  window.addEventListener("keydown", (e) => {
    if (transitioning) return;

    if (e.key === " " || e.key === "Enter" || e.key === "e") {
      e.preventDefault();
      if (isGiftPopupActive()) { dismissGiftPopup(); return; }

      if (isDialogueActive()) {
        handleDialogueInput(e.key);
        if (!isDialogueActive() && talkingTo) {
          if (dialogueEndedWithGift() && talkingTo.giftObject && !inventory.has(talkingTo.token)) {
            inventory.add(talkingTo.token);
            talkingTo.interacted = true;
            const idx = remaining.findIndex((r) => r.token === talkingTo!.token);
            if (idx >= 0) remaining.splice(idx, 1);
            void showGiftPopup(talkingTo.giftObject, talkingTo.giftSprite, scene.uiLayer);
          }
          talkingTo = null;
        }
        return;
      }

      if (scene.hasNpcs) {
        const npc = findNearestNpc(scene.player.x, scene.player.y);
        if (npc) {
          talkingTo = npc;
          const tree = npc.dialogueTree && npc.dialogueTree.text ? npc.dialogueTree : { id: "default", text: "Happy birthday!", responses: npc.dialogueTree?.responses ?? null };
          if (npc.token === "grisha") patchGrishaTree(tree);
          void startDialogue(tree, npc.name, scene.uiLayer, npc.voice, npc.voiceData, npc.voiceStart, npc.voiceEnd);
          return;
        }
      }

      if (interactWithAnimal(scene.player.x, scene.player.y, inventory)) return;
      if (tryBreakPot(scene.player.x, scene.player.y) && scene.name === "home" && allPotsBroken()) {
        setEmoteOverride("wally", "emote12", true);
        setEmoteOverride("penny", "emote10", true);
      }
    }

    if (isDialogueActive() && (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "w" || e.key === "s")) {
      e.preventDefault();
      handleDialogueInput(e.key);
    }
  });

  app.ticker.add(() => {
    if (transitioning) return;

    if (!isDialogueActive() && !isGiftPopupActive()) {
      updateScene(scene, false);
      const warp = findWarp(scene);
      if (warp) {
        transitioning = true;
        void transition(warp.target, warp.x, warp.y, warp.targetSpawn);
        return;
      }
    } else {
      updateScene(scene, true);
    }

    updateDialogue();
  });
}

boot();
