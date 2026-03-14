import { useState } from "react";
import { PixelEditor } from "./PixelEditor";
import { PalettePicker } from "./PalettePicker";
import { useSubmission } from "../hooks/useSubmission";
import { PALETTE } from "../../shared/palette";

export function SubmissionForm() {
  const { token, loading, saving, error, name, spriteData, setName, setSpriteData, save } =
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
      <PalettePicker selected={color} onSelect={setColor} />
      <PixelEditor initial={spriteData} onChange={setSpriteData} color={color} />

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
