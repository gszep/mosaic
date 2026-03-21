import { useState, useEffect, useCallback } from "react";
import { db, ref, get, update } from "../../shared/firebase";
import type { Submission, SpriteData, DialogueNode } from "../../shared/types";
import { pngToSpriteData } from "../../shared/pngToSpriteData";

const BASE = import.meta.env.BASE_URL;

function getToken(): string | null {
  return new URLSearchParams(window.location.search).get("token");
}

interface SubmissionState {
  token: string | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  name: string;
  spriteData: SpriteData | null;
  dialogueTree: DialogueNode | null;
  emote: string | null;
  voice: string | null;
  voiceData: string | null;
  voiceStart: number | null;
  voiceEnd: number | null;
}

export function useSubmission() {
  const [state, setState] = useState<SubmissionState>({
    token: getToken(),
    loading: true,
    saving: false,
    error: null,
    name: "",
    spriteData: null,
    dialogueTree: null,
    emote: null,
    voice: null,
    voiceData: null,
    voiceStart: null,
    voiceEnd: null,
  });

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setState((s) => ({ ...s, loading: false, error: "No token in URL." }));
      return;
    }

    get(ref(db, `submissions/${token}`))
      .then(async (snapshot) => {
        let name = "";
        let spriteData: SpriteData | null = null;
        let dialogueTree: DialogueNode | null = null;
        let emote: string | null = null;
        let voice: string | null = null;
        let voiceData: string | null = null;
        let voiceStart: number | null = null;
        let voiceEnd: number | null = null;

        if (snapshot.exists()) {
          const data = snapshot.val() as Submission;
          name = data.name ?? "";
          spriteData = data.spriteData ?? null;
          dialogueTree = data.dialogueTree ?? null;
          emote = data.emote ?? null;
          voice = data.voice ?? null;
          voiceData = data.voiceData ?? null;
          voiceStart = data.voiceStart ?? null;
          voiceEnd = data.voiceEnd ?? null;
        }

        if (!spriteData) {
          try {
            const defaultSprite = token === "player" ? "player-default.png" : "npc-default.png";
            spriteData = await pngToSpriteData(`${BASE}sprites/${defaultSprite}`);
          } catch {}
        }

        setState((s) => ({ ...s, loading: false, name, spriteData, dialogueTree, emote, voice, voiceData, voiceStart, voiceEnd }));
      })
      .catch((err) => {
        setState((s) => ({ ...s, loading: false, error: (err as Error).message }));
      });
  }, []);

  const setName = useCallback((name: string) => setState((s) => ({ ...s, name })), []);
  const setSpriteData = useCallback((spriteData: SpriteData) => setState((s) => ({ ...s, spriteData })), []);
  const setDialogueTree = useCallback((dialogueTree: DialogueNode) => setState((s) => ({ ...s, dialogueTree })), []);
  const setEmote = useCallback((emote: string) => setState((s) => ({ ...s, emote })), []);

  const setVoice = useCallback((voice: string, voiceData?: string | null, voiceStart?: number | null, voiceEnd?: number | null) => {
    setState((s) => ({
      ...s,
      voice,
      voiceData: voiceData !== undefined ? voiceData : s.voiceData,
      voiceStart: voiceStart !== undefined ? voiceStart : s.voiceStart,
      voiceEnd: voiceEnd !== undefined ? voiceEnd : s.voiceEnd,
    }));
  }, []);

  const save = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    setState((s) => ({ ...s, saving: true, error: null }));

    try {
      await update(ref(db, `submissions/${token}`), {
        token,
        name: state.name || null,
        spriteData: state.spriteData,
        dialogueTree: state.dialogueTree || null,
        dialogueMode: state.dialogueTree ? "hardcoded" : null,
        emote: state.emote || null,
        voice: state.voice || null,
        voiceData: state.voice === "custom" ? (state.voiceData || null) : null,
        voiceStart: state.voiceStart,
        voiceEnd: state.voiceEnd,
        locationDescription: "In the village square.",
      });
      setState((s) => ({ ...s, saving: false }));
    } catch (err) {
      setState((s) => ({ ...s, saving: false, error: (err as Error).message }));
    }
  }, [state.name, state.spriteData, state.dialogueTree, state.emote, state.voice, state.voiceData, state.voiceStart, state.voiceEnd]);

  return { ...state, setName, setSpriteData, setDialogueTree, setEmote, setVoice, save };
}
