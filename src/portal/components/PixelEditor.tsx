import {
  useRef,
  useEffect,
  useState,
  useCallback,
  useImperativeHandle,
  forwardRef,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { TRANSPARENT } from "../../shared/palette";
import type { SpriteData } from "../../shared/types";

const W = 16;
const H = 16;
const CELL_COUNT = W * H;

const SCALE = 16;

interface PixelEditorProps {
  initial: SpriteData | null;
  onChange: (data: SpriteData) => void;
  color: string;
  onPickColor: (color: string) => void;
}

export interface PixelEditorHandle {
  undo: () => void;
  redo: () => void;
  clear: () => void;
}

function createBlank(): string[] {
  return Array(CELL_COUNT).fill(TRANSPARENT);
}

export const PixelEditor = forwardRef<PixelEditorHandle, PixelEditorProps>(function PixelEditor({ initial, onChange, color, onPickColor }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pixels, setPixels] = useState<string[]>(
    () => initial?.pixels.slice() ?? createBlank()
  );
  // Sync pixels when initial data loads from Firebase
  useEffect(() => {
    if (initial?.pixels) {
      setPixels(initial.pixels.slice());
    }
  }, [initial]);

  const undoRef = useRef<string[][]>([]);
  const redoRef = useRef<string[][]>([]);
  const isPainting = useRef(false);
  const preStrokeSnapshot = useRef<string[] | null>(null);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const px = pixels[i];
        if (px === TRANSPARENT) {
          ctx.fillStyle = (x + y) % 2 === 0 ? "#ECECEC" : "#DCDCDC";
        } else {
          ctx.fillStyle = px;
        }
        ctx.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
      }
    }

    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= W; x++) {
      ctx.moveTo(x * SCALE + 0.5, 0);
      ctx.lineTo(x * SCALE + 0.5, H * SCALE);
    }
    for (let y = 0; y <= H; y++) {
      ctx.moveTo(0, y * SCALE + 0.5);
      ctx.lineTo(W * SCALE, y * SCALE + 0.5);
    }
    ctx.stroke();
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

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const paint = useCallback(
    (index: number) => {
      setPixels((prev) => {
        if (prev[index] === color) return prev;
        const next = prev.slice();
        next[index] = color;
        queueMicrotask(() => onChangeRef.current({ width: W as 16, height: H as 16, pixels: next }));
        return next;
      });
    },
    [color]
  );

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      // Right-click or alt+click = pick color
      if (e.button === 2 || e.altKey) {
        const i = cellFromPointer(e);
        if (i !== null) onPickColor(pixels[i] || TRANSPARENT);
        return;
      }
      isPainting.current = true;
      preStrokeSnapshot.current = pixels.slice();
      const i = cellFromPointer(e);
      if (i !== null) paint(i);
    },
    [cellFromPointer, paint, pixels, onPickColor]
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
      undoRef.current = [...undoRef.current, preStrokeSnapshot.current];
      redoRef.current = [];
    }
    isPainting.current = false;
    preStrokeSnapshot.current = null;
  }, []);

  const undo = useCallback(() => {
    if (undoRef.current.length === 0) return;
    const snapshot = undoRef.current[undoRef.current.length - 1];
    undoRef.current = undoRef.current.slice(0, -1);
    setPixels((current) => {
      redoRef.current = [...redoRef.current, current];
      return snapshot;
    });
    onChange({ width: W as 16, height: H as 16, pixels: snapshot });
  }, [onChange]);

  const redo = useCallback(() => {
    if (redoRef.current.length === 0) return;
    const snapshot = redoRef.current[redoRef.current.length - 1];
    redoRef.current = redoRef.current.slice(0, -1);
    setPixels((current) => {
      undoRef.current = [...undoRef.current, current];
      return snapshot;
    });
    onChange({ width: W as 16, height: H as 16, pixels: snapshot });
  }, [onChange]);

  // Ctrl+Z / Ctrl+Shift+Z keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo]);

  const clear = useCallback(() => {
    setPixels((current) => {
      undoRef.current = [...undoRef.current, current];
      redoRef.current = [];
      return createBlank();
    });
    const blank = createBlank();
    onChange({ width: W as 16, height: H as 16, pixels: blank });
  }, [onChange]);

  const handlersRef = useRef({ undo, redo, clear });
  handlersRef.current = { undo, redo, clear };
  useImperativeHandle(ref, () => ({
    undo: () => handlersRef.current.undo(),
    redo: () => handlersRef.current.redo(),
    clear: () => handlersRef.current.clear(),
  }), []);

  return (
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
        onContextMenu={(e) => e.preventDefault()}
    />
  );
});
