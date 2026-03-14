/** Raw pixel data from the freeform editor. 512 cells (16 wide x 32 tall). */
export interface SpriteData {
  width: 16;
  height: 32;
  /** Hex color strings ("#RRGGBB") or empty string for transparent. Row-major order. */
  pixels: string[];
}

/** A loved-one's submission as stored in Firebase. */
export interface Submission {
  token: string;
  name: string | null;
  spriteData: SpriteData | null;
  dialogueMode: "hardcoded" | "ai" | null;
  dialogueTree: unknown | null;
  personalityTraits: string[] | null;
  personalityPrompt: string | null;
  giftObject: string | null;
  audioBlips: unknown | null;
  locationDescription: string;
}
