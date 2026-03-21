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

  if (!token) return <p>Invalid invite link -- no token found.</p>;
  if (loading) return <p>Loading...</p>;

  return (
    <div style={{ padding: "1rem", maxWidth: 600 }}>
      <h1>Create Your Character</h1>

      <label style={{ display: "block", marginBottom: "1rem" }}>
        Your name:
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter your display name"
          style={{ display: "block", marginTop: "0.25rem", fontSize: "1rem" }}
        />
      </label>

      <h2>Draw your sprite</h2>
      <SpriteSelector onSelect={setSpriteData} />
      <PalettePicker selected={color} onSelect={setColor} />
      <button
        onClick={() => setColor(TRANSPARENT)}
        style={{
          marginBottom: "0.5rem",
          padding: "0.25rem 0.75rem",
          fontWeight: color === TRANSPARENT ? "bold" : "normal",
          border: color === TRANSPARENT ? "2px solid #000" : "1px solid #999",
        }}
      >
        Eraser
      </button>
      <PixelEditor initial={spriteData} onChange={setSpriteData} color={color} onPickColor={setColor} />

      <h2>Choose your emote</h2>
      <EmoteSelector selected={emote} onSelect={setEmote} />

      <h2>Write your dialogue</h2>
      <p style={{ color: "#666", fontSize: "0.9rem" }}>
        What do you say when Fraser talks to you?
        Add Fraser's response choices to create branching conversations.
      </p>
      <DialogueEditor tree={dialogueTree} onChange={setDialogueTree} />

      <button
        onClick={save}
        disabled={saving}
        style={{ marginTop: "1rem", fontSize: "1rem", padding: "0.5rem 1.5rem" }}
      >
        {saving ? "Saving..." : "Save"}
      </button>

      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}
