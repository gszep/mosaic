import { Assets, Container, NineSliceSprite, Texture } from "pixi.js";
import type { DialogueNode } from "../shared/types";
import { INTERNAL_WIDTH, INTERNAL_HEIGHT } from "./viewport";
import { loadBitmapFont, createBitmapText } from "./bitmapfont";

const BASE = import.meta.env.BASE_URL;
const BOX_MARGIN = 1;
const BOX_PAD_X = 5;
const BOX_PAD_Y = 4;
const LINE_GAP = 2;
const TAB_W = 35;  // speaker tab width (nine-slice left)
const TAB_H = 7;   // speaker tab height (nine-slice top)
const BORDER = 3;   // border thickness on right/bottom
const TYPEWRITER_SPEED = 1;
const BLIP_INTERVAL = 3; // play blip every N chars
const DEFAULT_VOICE = "Voice9";
const TEXT_WIDTH = INTERNAL_WIDTH - BOX_MARGIN * 2 - BOX_PAD_X * 2;

interface DialogueState {
  tree: DialogueNode;
  currentNode: DialogueNode;
  speaker: string;
  voiceUrl: string;
  displayedChars: number;
  lastBlipChar: number;
  selectedOption: number;
  phase: "typing" | "waiting" | "options";
}

let state: DialogueState | null = null;
let container: Container | null = null;
let panelSprite: NineSliceSprite | null = null;
let speakerContainer: Container | null = null;
let bodyContainer: Container | null = null;
let optionContainers: Container[] = [];
let boxTexture: Texture | null = null;
let assetsReady = false;

function findNode(root: DialogueNode, id: string): DialogueNode | null {
  if (root.id === id) return root;
  if (root.responses) {
    for (const r of root.responses) {
      if (r.next) {
        const found = findNode(r.next, id);
        if (found) return found;
      }
    }
  }
  return null;
}

async function ensureAssets() {
  if (assetsReady) return;
  await loadBitmapFont();

  boxTexture = await Assets.load<Texture>(`${BASE}ui/dialogue-box.png`);
  boxTexture.source.scaleMode = "nearest";
  assetsReady = true;
}

export async function startDialogue(
  tree: DialogueNode,
  speaker: string,
  parent: Container,
  voice?: string | null,
  voiceData?: string | null,
  voiceStart?: number | null,
  voiceEnd?: number | null,
) {
  await ensureAssets();

  // For presets, use the full wav. For custom, use the stored data.
  // The game plays the full voiceUrl — cropping is baked into voiceData at save time
  // or we just use the preset directly (which is already short enough).
  let voiceUrl: string;
  if (voice === "custom" && voiceData) {
    // Crop the stored recording at runtime
    const resp = await fetch(voiceData);
    const buf = await resp.arrayBuffer();
    const ctx = new OfflineAudioContext(1, 1, 8000);
    const decoded = await ctx.decodeAudioData(buf);
    const data = decoded.getChannelData(0);
    const s = Math.floor(((voiceStart ?? 0) / 1000) * 8000);
    const e = Math.floor(((voiceEnd ?? (data.length / 8000 * 1000)) / 1000) * 8000);
    const cropped = data.slice(s, e);
    if (cropped.length > 0) {
      const trimBuf = new AudioBuffer({ length: cropped.length, sampleRate: 8000, numberOfChannels: 1 });
      trimBuf.copyToChannel(new Float32Array(cropped), 0);
      // Encode to WAV data URL
      const bps = 16;
      const dataSize = cropped.length * 2;
      const ab = new ArrayBuffer(44 + dataSize);
      const v = new DataView(ab);
      const w = (o: number, str: string) => { for (let i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i)); };
      w(0, "RIFF"); v.setUint32(4, 36 + dataSize, true); w(8, "WAVE"); w(12, "fmt ");
      v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
      v.setUint32(24, 8000, true); v.setUint32(28, 16000, true);
      v.setUint16(32, 2, true); v.setUint16(34, bps, true); w(36, "data"); v.setUint32(40, dataSize, true);
      for (let i = 0; i < cropped.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, cropped[i])) * 0x7fff, true);
      const bytes = new Uint8Array(ab);
      let bin = ""; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      voiceUrl = "data:audio/wav;base64," + btoa(bin);
    } else {
      voiceUrl = `${BASE}audio/voice/${DEFAULT_VOICE}.wav`;
    }
  } else {
    voiceUrl = `${BASE}audio/voice/${voice || DEFAULT_VOICE}.wav`;
  }

  state = {
    tree,
    currentNode: tree,
    speaker,
    voiceUrl,
    displayedChars: 0,
    lastBlipChar: 0,
    selectedOption: 0,
    phase: "typing",
  };

  container = new Container();
  parent.addChild(container);

  panelSprite = new NineSliceSprite({
    texture: boxTexture!,
    leftWidth: TAB_W,
    rightWidth: BORDER,
    topHeight: TAB_H,
    bottomHeight: BORDER,
  });
  container.addChild(panelSprite);

  renderNode();
}

function clearText() {
  if (speakerContainer) { speakerContainer.destroy({ children: true }); speakerContainer = null; }
  if (bodyContainer) { bodyContainer.destroy({ children: true }); bodyContainer = null; }
  for (const c of optionContainers) c.destroy({ children: true });
  optionContainers = [];
}

function renderNode() {
  if (!state || !container) return;
  clearText();

  speakerContainer = createBitmapText(state.speaker, TAB_W - 8, 0xffffff);
  container.addChild(speakerContainer);

  bodyContainer = new Container();
  container.addChild(bodyContainer);

  state.displayedChars = 0;
  state.lastBlipChar = 0;
  state.selectedOption = 0;
  state.phase = "typing";
  layoutBox();
}

function renderOptions() {
  if (!state || !container) return;
  const responses = state.currentNode.responses;
  if (!responses || responses.length === 0) return;

  for (const c of optionContainers) c.destroy({ children: true });
  optionContainers = [];

  for (let i = 0; i < responses.length; i++) {
    const selected = i === state.selectedOption;
    const prefix = selected ? "> " : "  ";
    const color = selected ? 0xe95420 : 0x5a4a3a;
    const c = createBitmapText(prefix + responses[i].option, TEXT_WIDTH - 4, color);
    container.addChild(c);
    optionContainers.push(c);
  }

  layoutBox();
}

function renderBody() {
  if (!state || !container || !bodyContainer) return;

  bodyContainer.destroy({ children: true });
  const visibleText = state.currentNode.text.slice(0, state.displayedChars);
  bodyContainer = createBitmapText(visibleText, TEXT_WIDTH, 0x3a2a1a);
  container.addChild(bodyContainer);
}

function layoutBox() {
  if (!panelSprite || !speakerContainer || !bodyContainer || !container) return;

  const boxW = INTERNAL_WIDTH - BOX_MARGIN * 2;
  const contentX = BOX_MARGIN + BOX_PAD_X;

  const bodyH = bodyContainer.height;

  let optionsH = 0;
  for (const c of optionContainers) {
    optionsH += c.height + LINE_GAP;
  }

  // Box body height (excludes the tab which sits above the main box)
  const bodyContentH = bodyH + (optionsH > 0 ? LINE_GAP + optionsH : 0);
  const boxH = Math.max(20, bodyContentH + BOX_PAD_Y * 2 + TAB_H);
  const boxY = INTERNAL_HEIGHT - boxH - BOX_MARGIN;

  panelSprite.x = BOX_MARGIN;
  panelSprite.y = boxY;
  panelSprite.width = boxW;
  panelSprite.height = boxH;

  // Speaker name inside the tab (top-left dark area)
  speakerContainer.x = BOX_MARGIN + 4;
  speakerContainer.y = boxY + 1;

  // Body text below the tab
  bodyContainer.x = contentX;
  bodyContainer.y = boxY + TAB_H + BOX_PAD_Y;

  let oy = bodyContainer.y + bodyH + LINE_GAP * 2;
  for (const c of optionContainers) {
    c.x = contentX + 2;
    c.y = oy;
    oy += c.height + LINE_GAP;
  }
}

export function updateDialogue(): void {
  if (!state) return;

  if (state.phase === "typing") {
    state.displayedChars = Math.min(
      state.displayedChars + TYPEWRITER_SPEED,
      state.currentNode.text.length
    );

    // Play voice blip at intervals (and always on first non-space char)
    const shouldBlip = state.lastBlipChar === 0 || state.displayedChars - state.lastBlipChar >= BLIP_INTERVAL;
    if (shouldBlip) {
      const ch = state.currentNode.text[state.displayedChars - 1];
      if (ch && ch !== " ") {
        const blip = new Audio(state.voiceUrl);
        blip.volume = 0.4;
        blip.play().catch(() => {});
        state.lastBlipChar = state.displayedChars;
      }
    }

    renderBody();
    layoutBox();

    if (state.displayedChars >= state.currentNode.text.length) {
      state.phase = state.currentNode.responses?.length ? "options" : "waiting";
      if (state.phase === "options") renderOptions();
    }
  }
}

export function handleDialogueInput(key: string): void {
  if (!state) return;

  if (state.phase === "typing") {
    state.displayedChars = state.currentNode.text.length;
    renderBody();
    state.phase = state.currentNode.responses?.length ? "options" : "waiting";
    if (state.phase === "options") renderOptions();
    layoutBox();
    return;
  }

  if (state.phase === "waiting") {
    endDialogue();
    return;
  }

  if (state.phase === "options") {
    const responses = state.currentNode.responses!;
    if (key === "ArrowUp" || key === "w") {
      state.selectedOption = (state.selectedOption - 1 + responses.length) % responses.length;
      renderOptions();
    } else if (key === "ArrowDown" || key === "s") {
      state.selectedOption = (state.selectedOption + 1) % responses.length;
      renderOptions();
    } else if (key === " " || key === "Enter" || key === "e") {
      const chosen = responses[state.selectedOption];
      if (chosen.goto) {
        const target = findNode(state.tree, chosen.goto);
        if (target) {
          state.currentNode = target;
          renderNode();
        }
      } else if (chosen.next) {
        state.currentNode = chosen.next;
        renderNode();
      } else {
        endDialogue();
      }
    }
  }
}

function endDialogue() {
  clearText();
  if (container) {
    container.destroy({ children: true });
    container = null;
  }
  panelSprite = null;
  state = null;
}

export function isDialogueActive(): boolean {
  return state !== null;
}
