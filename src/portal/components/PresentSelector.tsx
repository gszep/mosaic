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
      <label htmlFor="gift-name" style={{ fontSize: "10px", color: "#888", display: "block", marginBottom: 4 }}>What are you giving Fraser?</label>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.75rem" }}>
        <div className="nes-input is-dark" style={{
          width: 40, height: 40, flexShrink: 0, padding: 2,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {giftSprite && (
            <img
              src={`${BASE}sprites/items/${giftSprite}.png`}
              alt=""
              style={{ imageRendering: "pixelated", maxWidth: 36, maxHeight: 36, objectFit: "contain" }}
            />
          )}
        </div>
        <input
          type="text"
          id="gift-name"
          className="nes-input is-dark"
          value={giftObject ?? ""}
          onChange={(e) => onGiftObject(e.target.value)}
          placeholder='e.g. "a tiny telescope"'
          style={{ flex: 1 }}
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
              style={{ imageRendering: "pixelated", width: 40, height: 40, objectFit: "contain" }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
