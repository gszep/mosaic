import { useState, useCallback, useRef } from "react";
import { PixelEditor, type PixelEditorHandle } from "./PixelEditor";
import { PalettePicker } from "./PalettePicker";
import { SpriteSelector } from "./SpriteSelector";
import { EmoteSelector } from "./EmoteSelector";
import { VoiceSelector } from "./VoiceSelector";
import { PresentSelector } from "./PresentSelector";
import { DialogueEditor } from "./DialogueEditor";
import { useSubmission } from "../hooks/useSubmission";
import { PALETTE, TRANSPARENT } from "../../shared/palette";

const BASE = import.meta.env.BASE_URL;
const TILE = 16;

export function SubmissionForm() {
  const { token, loading, saving, error, name, spriteData, dialogueTree, emote, voice, voiceData, voiceStart, voiceEnd, giftObject, giftSprite, setName, setSpriteData, setDialogueTree, setEmote, setVoice, setGiftObject, setGiftSprite, save } =
    useSubmission();
  const [color, setColor] = useState(PALETTE[0]);
  const editorRef = useRef<PixelEditorHandle>(null);

  if (!token) return <p className="nes-text is-error">Invalid invite link -- no token found.</p>;
  if (loading) return <p className="nes-text is-primary">Loading...</p>;

  return (
    <div className="portal-root">
      <h1>Create Your Character</h1>

      <section className="nes-container is-dark is-rounded" style={{ marginBottom: "1rem" }}>
        <div className="nes-field">
          <label htmlFor="name">Your name:</label>
          <input
            type="text"
            id="name"
            className="nes-input is-dark"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Display name"
          />
        </div>
      </section>

      <h2>Draw your sprite</h2>
      <section className="nes-container is-dark is-rounded" style={{ marginBottom: "1rem" }}>
        <SpriteSelector onSelect={setSpriteData} />
        <div className="sprite-editor-row">
          <div className="pixel-editor">
            <PixelEditor ref={editorRef} initial={spriteData} onChange={setSpriteData} color={color} onPickColor={setColor} />
          </div>
          <div className="palette-column">
            <p style={{ color: "#888", fontSize: "9px", margin: "0 0 4px" }}>Colour:</p>
            <PalettePicker selected={color} onSelect={setColor} />
          </div>
        </div>
        <div className="sprite-editor-buttons">
          <button onClick={() => editorRef.current?.undo()} className="nes-btn is-dark">Undo</button>
          <button onClick={() => editorRef.current?.redo()} className="nes-btn is-dark">Redo</button>
          <button onClick={() => editorRef.current?.clear()} className="nes-btn is-dark">Clear</button>
          <button onClick={() => setColor(TRANSPARENT)} className={`nes-btn ${color === TRANSPARENT ? "is-warning" : "is-dark"}`}>Eraser</button>
        </div>
      </section>

      <h2>Choose your emote</h2>
      <section className="nes-container is-dark is-rounded" style={{ marginBottom: "1rem" }}>
        <EmoteSelector selected={emote} onSelect={setEmote} />
      </section>

      <h2>Choose your voice</h2>
      <section className="nes-container is-dark is-rounded" style={{ marginBottom: "1rem" }}>
        <VoiceSelector voice={voice} voiceData={voiceData} voiceStart={voiceStart} voiceEnd={voiceEnd} onVoice={setVoice} />
      </section>

      <h2>Choose your present</h2>
      <section className="nes-container is-dark is-rounded" style={{ marginBottom: "1rem" }}>
        <PresentSelector giftObject={giftObject} giftSprite={giftSprite} onGiftObject={setGiftObject} onGiftSprite={setGiftSprite} />
      </section>

      <h2>Write your dialogue</h2>
      <section className="nes-container is-dark is-rounded" style={{ marginBottom: "1rem" }}>
        <p style={{ color: "#888", fontSize: "10px" }}>
          What do you say when Fraser talks to you?
          Add Fraser's response choices to create branching conversations.
        </p>
        <DialogueEditor tree={dialogueTree} onChange={setDialogueTree} />
      </section>

      <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
        <button
          onClick={save}
          disabled={saving}
          className={`nes-btn ${saving ? "is-disabled" : "is-success"} save-btn`}
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          onClick={async () => {
            await save();
            // Find spawn position from map
            try {
              const resp = await fetch(`${BASE}maps/village.tmj`);
              const map = await resp.json();
              const spawns = map.layers?.find((l: { name: string }) => l.name === "spawns");
              const obj = spawns?.objects?.find((o: { properties?: { name: string; value: string }[] }) =>
                o.properties?.some((p: { name: string; value: string }) => p.name === "npcId" && p.value === token)
              );
              const x = obj ? Math.floor(obj.x / TILE) : Math.floor(map.width / 2);
              const y = obj ? Math.floor(obj.y / TILE) + 1 : Math.floor(map.height / 2);
              window.open(`${BASE}?x=${x}&y=${y}`, "_blank");
            } catch {
              window.open(BASE, "_blank");
            }
          }}
          disabled={saving}
          className={`nes-btn ${saving ? "is-disabled" : "is-primary"} save-btn`}
        >
          Test
        </button>
      </div>

      {error && <p className="nes-text is-error" style={{ marginTop: "0.5rem" }}>{error}</p>}
    </div>
  );
}
