const BASE = import.meta.env.BASE_URL;
const EMOTE_COUNT = 30;
const DEFAULT_EMOTE = "emote20";
const EMOTES = Array.from({ length: EMOTE_COUNT }, (_, i) => `emote${i + 1}`);

interface EmoteSelectorProps {
  selected: string | null;
  onSelect: (emote: string) => void;
}

export function EmoteSelector({ selected, onSelect }: EmoteSelectorProps) {
  return (
    <div style={{ marginBottom: "0.75rem" }}>
      <p style={{ margin: "0 0 0.5rem", color: "#666", fontSize: "0.9rem" }}>
        Pick an emote that floats above your character:
      </p>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "2px",
          background: "#f0f0f0",
          padding: 4,
          borderRadius: 4,
        }}
      >
        {EMOTES.map((name) => (
          <button
            key={name}
            onClick={() => onSelect(name)}
            title={name}
            style={{
              width: 32,
              height: 32,
              padding: 2,
              border:
                (selected === name || (!selected && name === DEFAULT_EMOTE))
                  ? "2px solid #E95420"
                  : "2px solid transparent",
              borderRadius: 2,
              background: (selected === name || (!selected && name === DEFAULT_EMOTE)) ? "#ffe0cc" : "transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img
              src={`${BASE}ui/emotes/${name}.png`}
              alt={name}
              style={{ imageRendering: "pixelated", maxWidth: 28, maxHeight: 26 }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
