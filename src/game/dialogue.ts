import { Assets, Container, NineSliceSprite, Texture } from "pixi.js";
import type { DialogueNode } from "../shared/types";
import { INTERNAL_WIDTH, INTERNAL_HEIGHT } from "./viewport";
import { loadBitmapFont, createBitmapText, measureText } from "./bitmapfont";

const BASE = import.meta.env.BASE_URL;
const BOX_MARGIN = 1;
const BOX_PAD_X = 5;
const BOX_PAD_Y = 4;
const LINE_GAP = 2;
const BORDER = 3;
const TYPEWRITER_SPEED = 1;
const TEXT_WIDTH = INTERNAL_WIDTH - BOX_MARGIN * 2 - BOX_PAD_X * 2;

interface DialogueState {
  tree: DialogueNode;
  currentNode: DialogueNode;
  speaker: string;
  displayedChars: number;
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
  await loadBitmapFont(BASE);
  boxTexture = await Assets.load<Texture>(`${BASE}ui/dialogue-box.png`);
  boxTexture.source.scaleMode = "nearest";
  assetsReady = true;
}

export async function startDialogue(tree: DialogueNode, speaker: string, parent: Container) {
  await ensureAssets();

  state = {
    tree,
    currentNode: tree,
    speaker,
    displayedChars: 0,
    selectedOption: 0,
    phase: "typing",
  };

  container = new Container();
  parent.addChild(container);

  panelSprite = new NineSliceSprite({
    texture: boxTexture!,
    leftWidth: BORDER,
    rightWidth: BORDER,
    topHeight: BORDER,
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

  speakerContainer = createBitmapText(state.speaker, TEXT_WIDTH, 0xe95420);
  container.addChild(speakerContainer);

  bodyContainer = new Container();
  container.addChild(bodyContainer);

  state.displayedChars = 0;
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

  const contentX = BOX_MARGIN + BOX_PAD_X;
  speakerContainer.x = contentX;
  bodyContainer.x = contentX;

  const speakerH = speakerContainer.height;
  const bodyH = bodyContainer.height;

  let optionsH = 0;
  for (const c of optionContainers) {
    optionsH += c.height + LINE_GAP;
  }

  const contentH = speakerH + LINE_GAP + bodyH + (optionsH > 0 ? LINE_GAP + optionsH : 0);
  const boxH = Math.max(20, contentH + BOX_PAD_Y * 2);
  const boxW = INTERNAL_WIDTH - BOX_MARGIN * 2;
  const boxY = INTERNAL_HEIGHT - boxH - BOX_MARGIN;

  panelSprite.x = BOX_MARGIN;
  panelSprite.y = boxY;
  panelSprite.width = boxW;
  panelSprite.height = boxH;

  speakerContainer.y = boxY + BOX_PAD_Y;
  bodyContainer.y = speakerContainer.y + speakerH + LINE_GAP;

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
