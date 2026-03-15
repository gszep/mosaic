export interface SpriteData {
  width: 16;
  height: 16;
  pixels: string[];
}

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
