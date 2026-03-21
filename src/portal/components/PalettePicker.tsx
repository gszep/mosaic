import { PALETTE } from "../../shared/palette";

interface PalettePickerProps {
  selected: string;
  onSelect: (color: string) => void;
}

export function PalettePicker({ selected, onSelect }: PalettePickerProps) {
  return (
    <div className="palette-grid">
      {PALETTE.map((color) => (
        <button
          key={color}
          onClick={() => onSelect(color)}
          aria-label={color}
          style={{
            width: 20,
            height: 20,
            backgroundColor: color,
            border: color === selected ? "2px solid white" : "2px solid transparent",
            outline: color === selected ? "1px solid #000" : "none",
            cursor: "pointer",
            padding: 0,
            borderRadius: 0,
          }}
        />
      ))}
    </div>
  );
}
