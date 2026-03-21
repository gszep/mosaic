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

const blank = (): string[] => Array(W * H).fill(TRANSPARENT);
const toData = (pixels: string[]): SpriteData => ({ width: W as 16, height: H as 16, pixels });

export const PixelEditor = forwardRef<PixelEditorHandle, PixelEditorProps>(
  function PixelEditor({ initial, onChange, color, onPickColor }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [pixels, setPixels] = useState<string[]>(() => initial?.pixels.slice() ?? blank());
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const undoStack = useRef<string[][]>([]);
    const redoStack = useRef<string[][]>([]);
    const isPainting = useRef(false);
    const preStroke = useRef<string[] | null>(null);

    useEffect(() => {
      if (initial?.pixels) setPixels(initial.pixels.slice());
    }, [initial]);

    useEffect(() => {
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;

      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const px = pixels[y * W + x];
          ctx.fillStyle = px === TRANSPARENT
            ? ((x + y) % 2 === 0 ? "#ECECEC" : "#DCDCDC")
            : px;
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

    const cellFromPointer = useCallback((e: ReactPointerEvent<HTMLCanvasElement>): number | null => {
      const rect = canvasRef.current!.getBoundingClientRect();
      const x = Math.floor(((e.clientX - rect.left) / rect.width) * W);
      const y = Math.floor(((e.clientY - rect.top) / rect.height) * H);
      if (x < 0 || x >= W || y < 0 || y >= H) return null;
      return y * W + x;
    }, []);

    const paint = useCallback((index: number) => {
      setPixels((prev) => {
        if (prev[index] === color) return prev;
        const next = prev.slice();
        next[index] = color;
        queueMicrotask(() => onChangeRef.current(toData(next)));
        return next;
      });
    }, [color]);

    const notify = (pixels: string[]) => queueMicrotask(() => onChangeRef.current(toData(pixels)));

    const undo = useCallback(() => {
      if (undoStack.current.length === 0) return;
      const snapshot = undoStack.current.pop()!;
      setPixels((current) => { redoStack.current.push(current); return snapshot; });
      notify(snapshot);
    }, []);

    const redo = useCallback(() => {
      if (redoStack.current.length === 0) return;
      const snapshot = redoStack.current.pop()!;
      setPixels((current) => { undoStack.current.push(current); return snapshot; });
      notify(snapshot);
    }, []);

    const clear = useCallback(() => {
      const b = blank();
      setPixels((current) => { undoStack.current.push(current); redoStack.current.length = 0; return b; });
      notify(b);
    }, []);

    useEffect(() => {
      const handler = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
          e.preventDefault();
          e.shiftKey ? redo() : undo();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === "y") {
          e.preventDefault();
          redo();
        }
      };
      window.addEventListener("keydown", handler);
      return () => window.removeEventListener("keydown", handler);
    }, [undo, redo]);

    const handlersRef = useRef({ undo, redo, clear });
    handlersRef.current = { undo, redo, clear };
    useImperativeHandle(ref, () => ({
      undo: () => handlersRef.current.undo(),
      redo: () => handlersRef.current.redo(),
      clear: () => handlersRef.current.clear(),
    }), []);

    const handlePointerDown = useCallback((e: ReactPointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      if (e.button === 2 || e.altKey) {
        const i = cellFromPointer(e);
        if (i !== null) onPickColor(pixels[i] || TRANSPARENT);
        return;
      }
      isPainting.current = true;
      preStroke.current = pixels.slice();
      const i = cellFromPointer(e);
      if (i !== null) paint(i);
    }, [cellFromPointer, paint, pixels, onPickColor]);

    const handlePointerMove = useCallback((e: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!isPainting.current) return;
      const i = cellFromPointer(e);
      if (i !== null) paint(i);
    }, [cellFromPointer, paint]);

    const handlePointerUp = useCallback(() => {
      if (isPainting.current && preStroke.current) {
        undoStack.current.push(preStroke.current);
        redoStack.current.length = 0;
      }
      isPainting.current = false;
      preStroke.current = null;
    }, []);

    return (
      <canvas
        ref={canvasRef}
        width={W * SCALE}
        height={H * SCALE}
        style={{ imageRendering: "pixelated", touchAction: "none", cursor: "crosshair", maxWidth: "100%", height: "auto" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onContextMenu={(e) => e.preventDefault()}
      />
    );
  }
);
