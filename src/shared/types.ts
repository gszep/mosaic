export interface SpriteData {
  width: 16;
  height: 16;
  pixels: string[];
}

export interface DialogueResponse {
  option: string;
  next?: DialogueNode;
  goto?: string;
}

export interface DialogueNode {
  id: string;
  text: string;
  audio?: string | null;
  responses: DialogueResponse[] | null;
}

export interface Submission {
  token: string;
  name: string | null;
  spriteData: SpriteData | null;
  dialogueMode: "hardcoded" | "ai" | null;
  dialogueTree: DialogueNode | null;
  personalityTraits: string[] | null;
  personalityPrompt: string | null;
  giftObject: string | null;
  giftSprite: string | null;
  emote: string | null;
  voice: string | null;
  voiceData: string | null;
  voiceStart: number | null;
  voiceEnd: number | null;
  audioBlips: unknown | null;
  locationDescription: string;
}
