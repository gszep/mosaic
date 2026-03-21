import { useState } from "react";
import { PixelEditor } from "./PixelEditor";
import { PalettePicker } from "./PalettePicker";
import { SpriteSelector } from "./SpriteSelector";
import { EmoteSelector } from "./EmoteSelector";
import { DialogueEditor } from "./DialogueEditor";
import { useSubmission } from "../hooks/useSubmission";
import { PALETTE, TRANSPARENT } from "../../shared/palette";

export function SubmissionForm() {
  const { token, loading, saving, error, name, spriteData, dialogueTree, emote, setName, setSpriteData, setDialogueTree, setEmote, save } =
    useSubmission();
  const [color, setColor] = useState(PALETTE[0]);

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
        <PalettePicker selected={color} onSelect={setColor} />
        <button
          onClick={() => setColor(TRANSPARENT)}
          className={`nes-btn ${color === TRANSPARENT ? "is-warning" : "is-dark"}`}
          style={{ marginBottom: "0.5rem" }}
        >
          Eraser
        </button>
        <div className="pixel-editor">
          <PixelEditor initial={spriteData} onChange={setSpriteData} color={color} onPickColor={setColor} />
        </div>
      </section>

      <h2>Choose your emote</h2>
      <section className="nes-container is-dark is-rounded" style={{ marginBottom: "1rem" }}>
        <EmoteSelector selected={emote} onSelect={setEmote} />
      </section>

      <h2>Write your dialogue</h2>
      <section className="nes-container is-dark is-rounded" style={{ marginBottom: "1rem" }}>
        <p style={{ color: "#888", fontSize: "10px" }}>
          What do you say when Fraser talks to you?
          Add Fraser's response choices to create branching conversations.
        </p>
        <DialogueEditor tree={dialogueTree} onChange={setDialogueTree} />
      </section>

      <button
        onClick={save}
        disabled={saving}
        className={`nes-btn ${saving ? "is-disabled" : "is-success"} save-btn`}
      >
        {saving ? "Saving..." : "Save"}
      </button>

      {error && <p className="nes-text is-error" style={{ marginTop: "0.5rem" }}>{error}</p>}
    </div>
  );
}
