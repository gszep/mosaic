import {
  useRef,
  useEffect,
  useState,
  useCallback,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { TRANSPARENT } from "../../shared/palette";
import type { SpriteData } from "../../shared/types";

const W = 16;
const H = 32;
const CELL_COUNT = W * H;

/** Scale factor: each pixel cell renders as SCALE x SCALE screen pixels. */
const SCALE = 16;

interface PixelEditorProps {
  /** Initial pixel data. If null, starts blank. */
  initial: SpriteData | null;
  /** Called on every paint stroke with the full current grid. */
  onChange: (data: SpriteData) => void;
  /** The color to paint with. */
  color: string;
}

function createBlank(): string[] {
  return Array(CELL_COUNT).fill(TRANSPARENT);
}

export function PixelEditor({ initial, onChange, color }: PixelEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pixels, setPixels] = useState<string[]>(
    () => initial?.pixels.slice() ?? createBlank()
  );
  const [undoStack, setUndoStack] = useState<string[][]>([]);
  const [redoStack, setRedoStack] = useState<string[][]>([]);
  const isPainting = useRef(false);
  const preStrokeSnapshot = useRef<string[] | null>(null);

  // Redraw canvas whenever pixels change.
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    // Checkerboard background for transparent cells.
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const px = pixels[i];
        if (px === TRANSPARENT) {
          ctx.fillStyle = (x + y) % 2 === 0 ? "#C8C8C8" : "#A0A0A0";
        } else {
          ctx.fillStyle = px;
        }
        ctx.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
      }
    }

    // Grid lines.
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x++) {
      ctx.beginPath();
      ctx.moveTo(x * SCALE + 0.5, 0);
      ctx.lineTo(x * SCALE + 0.5, H * SCALE);
      ctx.stroke();
    }
    for (let y = 0; y <= H; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * SCALE + 0.5);
      ctx.lineTo(W * SCALE, y * SCALE + 0.5);
      ctx.stroke();
    }
  }, [pixels]);

  const cellFromPointer = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>): number | null => {
      const rect = canvasRef.current!.getBoundingClientRect();
      const x = Math.floor(((e.clientX - rect.left) / rect.width) * W);
      const y = Math.floor(((e.clientY - rect.top) / rect.height) * H);
      if (x < 0 || x >= W || y < 0 || y >= H) return null;
      return y * W + x;
    },
    []
  );

  const paint = useCallback(
    (index: number) => {
      setPixels((prev) => {
        if (prev[index] === color) return prev;
        const next = prev.slice();
        next[index] = color;
        onChange({ width: W as 16, height: H as 32, pixels: next });
        return next;
      });
    },
    [color, onChange]
  );

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      isPainting.current = true;
      preStrokeSnapshot.current = pixels.slice();
      const i = cellFromPointer(e);
      if (i !== null) paint(i);
    },
    [cellFromPointer, paint, pixels]
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!isPainting.current) return;
      const i = cellFromPointer(e);
      if (i !== null) paint(i);
    },
    [cellFromPointer, paint]
  );

  const handlePointerUp = useCallback(() => {
    if (isPainting.current && preStrokeSnapshot.current) {
      setUndoStack((prev) => [...prev, preStrokeSnapshot.current!]);
      setRedoStack([]);
    }
    isPainting.current = false;
    preStrokeSnapshot.current = null;
  }, []);

  const undo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const snapshot = prev[prev.length - 1];
      setRedoStack((r) => [...r, pixels]);
      setPixels(snapshot);
      onChange({ width: W as 16, height: H as 32, pixels: snapshot });
      return prev.slice(0, -1);
    });
  }, [pixels, onChange]);

  const redo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const snapshot = prev[prev.length - 1];
      setUndoStack((u) => [...u, pixels]);
      setPixels(snapshot);
      onChange({ width: W as 16, height: H as 32, pixels: snapshot });
      return prev.slice(0, -1);
    });
  }, [pixels, onChange]);

  const clear = useCallback(() => {
    setUndoStack((prev) => [...prev, pixels]);
    setRedoStack([]);
    const blank = createBlank();
    setPixels(blank);
    onChange({ width: W as 16, height: H as 32, pixels: blank });
  }, [pixels, onChange]);

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={W * SCALE}
        height={H * SCALE}
        style={{
          imageRendering: "pixelated",
          touchAction: "none",
          cursor: "crosshair",
          maxWidth: "100%",
          height: "auto",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
        <button onClick={undo} disabled={undoStack.length === 0}>
          Undo
        </button>
        <button onClick={redo} disabled={redoStack.length === 0}>
          Redo
        </button>
        <button onClick={clear}>Clear</button>
      </div>
    </div>
  );
}
