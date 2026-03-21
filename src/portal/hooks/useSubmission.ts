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

        if (snapshot.exists()) {
          const data = snapshot.val() as Submission;
          name = data.name ?? "";
          spriteData = data.spriteData ?? null;
          dialogueTree = data.dialogueTree ?? null;
          emote = data.emote ?? null;
        }

        // Load default sprite if no custom one exists
        if (!spriteData) {
          try {
            const defaultSprite = token === "player"
              ? "player-default.png"
              : "npc-default.png";
            spriteData = await pngToSpriteData(`${BASE}sprites/${defaultSprite}`);
          } catch {
            // Fall through with null spriteData
          }
        }

        setState((s) => ({ ...s, loading: false, name, spriteData, dialogueTree, emote }));
      })
      .catch((err) => {
        setState((s) => ({ ...s, loading: false, error: (err as Error).message }));
      });
  }, []);

  const setName = useCallback((name: string) => {
    setState((s) => ({ ...s, name }));
  }, []);

  const setSpriteData = useCallback((spriteData: SpriteData) => {
    setState((s) => ({ ...s, spriteData }));
  }, []);

  const setDialogueTree = useCallback((dialogueTree: DialogueNode) => {
    setState((s) => ({ ...s, dialogueTree }));
  }, []);

  const setEmote = useCallback((emote: string) => {
    setState((s) => ({ ...s, emote }));
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
        locationDescription: "In the village square.",
      });
      setState((s) => ({ ...s, saving: false }));
    } catch (err) {
      setState((s) => ({ ...s, saving: false, error: (err as Error).message }));
    }
  }, [state.name, state.spriteData, state.dialogueTree, state.emote]);

  return { ...state, setName, setSpriteData, setDialogueTree, setEmote, save };
}
