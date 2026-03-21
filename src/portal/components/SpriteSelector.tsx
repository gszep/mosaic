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
      <p style={{ color: "#888", fontSize: "10px", margin: "0 0 0.5rem" }}>
        Pick a starting character, then customise below:
      </p>
      <div className="sprite-grid">
        {characters.map((name) => (
          <button
            key={name}
            onClick={() => handleSelect(name)}
            title={name}
            className={`sprite-btn${selected === name ? " is-selected" : ""}`}
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
