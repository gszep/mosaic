import { useState, useEffect } from "react";

const BASE = import.meta.env.BASE_URL;

interface ItemInfo {
  key: string;
  category: string;
  name: string;
}

interface PresentSelectorProps {
  giftObject: string | null;
  giftSprite: string | null;
  onGiftObject: (name: string) => void;
  onGiftSprite: (key: string) => void;
}

export function PresentSelector({ giftObject, giftSprite, onGiftObject, onGiftSprite }: PresentSelectorProps) {
  const [items, setItems] = useState<ItemInfo[]>([]);

  useEffect(() => {
    fetch(`${BASE}sprites/items/manifest.json`)
      .then((r) => r.json())
      .then((data: ItemInfo[]) => setItems(data))
      .catch(() => {});
  }, []);

  return (
    <div>
      <div className="nes-field" style={{ marginBottom: "0.75rem" }}>
        <label htmlFor="gift-name" style={{ fontSize: "10px", color: "#888" }}>What are you giving Fraser?</label>
        <input
          type="text"
          id="gift-name"
          className="nes-input is-dark"
          value={giftObject ?? ""}
          onChange={(e) => onGiftObject(e.target.value)}
          placeholder='e.g. "a tiny telescope"'
        />
      </div>
      <p style={{ color: "#888", fontSize: "9px", margin: "0 0 4px" }}>Choose an icon for your present:</p>
      <div className="sprite-grid" style={{ maxHeight: 180 }}>
        {items.map((item) => (
          <button
            key={item.key}
            onClick={() => onGiftSprite(item.key)}
            title={item.name}
            className={`sprite-btn${giftSprite === item.key ? " is-selected" : ""}`}
          >
            <img
              src={`${BASE}sprites/items/${item.key}.png`}
              alt={item.name}
              style={{ imageRendering: "pixelated", maxWidth: 30, maxHeight: 30, objectFit: "contain" }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
