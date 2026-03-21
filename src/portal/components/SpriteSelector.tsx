import { useState, useEffect } from "react";
import type { SpriteData } from "../../shared/types";
import { pngToSpriteData } from "../../shared/pngToSpriteData";

const BASE = import.meta.env.BASE_URL;

interface SpriteSelectorProps {
  onSelect: (data: SpriteData) => void;
}

export function SpriteSelector({ onSelect }: SpriteSelectorProps) {
  const [characters, setCharacters] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${BASE}sprites/characters/manifest.json`)
      .then((r) => r.json())
      .then((names: string[]) => setCharacters(names))
      .catch(() => {});
  }, []);

  const handleSelect = async (name: string) => {
    setSelected(name);
    const data = await pngToSpriteData(
      `${BASE}sprites/characters/${name}.png`
    );
    onSelect(data);
  };

  if (characters.length === 0) return null;

  return (
    <div style={{ marginBottom: "0.75rem" }}>
      <p style={{ margin: "0 0 0.5rem", color: "#666", fontSize: "0.9rem" }}>
        Pick a character as your starting point, then customise in the editor
        below:
      </p>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "2px",
          maxHeight: 200,
          overflowY: "auto",
          background: "#f0f0f0",
          padding: 4,
          borderRadius: 4,
        }}
      >
        {characters.map((name) => (
          <button
            key={name}
            onClick={() => handleSelect(name)}
            title={name}
            style={{
              width: 34,
              height: 34,
              padding: 1,
              border:
                selected === name
                  ? "2px solid #E95420"
                  : "2px solid transparent",
              borderRadius: 2,
              background: selected === name ? "#ffe0cc" : "transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img
              src={`${BASE}sprites/characters/${name}.png`}
              alt={name}
              width={32}
              height={32}
              style={{ imageRendering: "pixelated" }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
