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
      <p style={{ color: "#888", fontSize: "10px", margin: "0 0 0.5rem" }}>
        Pick an emote that floats above your character:
      </p>
      <div className="emote-grid">
        {EMOTES.map((name) => {
          const active = selected === name || (!selected && name === DEFAULT_EMOTE);
          return (
            <button
              key={name}
              onClick={() => onSelect(name)}
              title={name}
              className={`emote-btn${active ? " is-selected" : ""}`}
            >
              <img
                src={`${BASE}ui/emotes/${name}.png`}
                alt={name}
                style={{ imageRendering: "pixelated", maxWidth: 28, maxHeight: 26 }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
