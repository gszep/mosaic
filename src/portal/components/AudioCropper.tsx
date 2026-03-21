import { useState, useEffect, useRef, useCallback } from "react";
import { getWaveform, cropDataUrl, playAudio, MAX_BLIP_MS } from "../hooks/useAudioRecorder";

interface AudioCropperProps {
  rawAudio: string;
  onCrop: (croppedDataUrl: string) => void;
  onCancel: () => void;
}

export function AudioCropper({ rawAudio, onCrop, onCancel }: AudioCropperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [waveform, setWaveform] = useState<Float32Array | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [startMs, setStartMs] = useState(0);
  const [endMs, setEndMs] = useState(0);
  const dragging = useRef(false);

  useEffect(() => {
    getWaveform(rawAudio).then((data) => {
      setWaveform(data);
      const dur = (data.length / 8000) * 1000;
      setDurationMs(dur);
      setStartMs(0);
      setEndMs(Math.min(dur, MAX_BLIP_MS));
    });
  }, [rawAudio]);

  const pxToMs = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current!.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      return Math.max(0, Math.min(x * durationMs, durationMs));
    },
    [durationMs]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const ms = pxToMs(e);
      setStartMs(ms);
      setEndMs(ms);
      dragging.current = true;
    },
    [pxToMs]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!dragging.current) return;
      const ms = pxToMs(e);
      // Clamp to max blip length
      const clamped = Math.min(ms, startMs + MAX_BLIP_MS);
      setEndMs(Math.max(startMs, clamped));
    },
    [pxToMs, startMs]
  );

  const handleMouseUp = useCallback(() => {
    dragging.current = false;
  }, []);

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !waveform || durationMs === 0) return;
    const ctx = canvas.getContext("2d")!;
    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, w, h);

    const samplesPerPx = waveform.length / w;

    // Draw full waveform dimmed
    ctx.fillStyle = "#444";
    for (let x = 0; x < w; x++) {
      const idx = Math.floor(x * samplesPerPx);
      const val = Math.abs(waveform[idx]);
      const barH = Math.max(1, val * h);
      ctx.fillRect(x, (h - barH) / 2, 1, barH);
    }

    // Dim outside selection
    const selL = Math.floor((startMs / durationMs) * w);
    const selR = Math.ceil((endMs / durationMs) * w);

    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, selL, h);
    ctx.fillRect(selR, 0, w - selR, h);

    // Highlighted waveform inside selection
    if (selR > selL) {
      ctx.fillStyle = "#E95420";
      for (let x = selL; x < selR && x < w; x++) {
        const idx = Math.floor(x * samplesPerPx);
        const val = Math.abs(waveform[idx]);
        const barH = Math.max(1, val * h);
        ctx.fillRect(x, (h - barH) / 2, 1, barH);
      }

      // Selection border
      ctx.strokeStyle = "#E95420";
      ctx.lineWidth = 1;
      ctx.strokeRect(selL, 0, selR - selL, h);
    }
  }, [waveform, startMs, endMs, durationMs]);

  const selectionMs = Math.round(endMs - startMs);

  const handlePreview = useCallback(async () => {
    if (selectionMs < 5) return;
    const cropped = await cropDataUrl(rawAudio, startMs, selectionMs);
    playAudio(cropped);
  }, [rawAudio, startMs, selectionMs]);

  const handleConfirm = useCallback(async () => {
    if (selectionMs < 5) return;
    const cropped = await cropDataUrl(rawAudio, startMs, selectionMs);
    onCrop(cropped);
  }, [rawAudio, startMs, selectionMs, onCrop]);

  if (!waveform) return <span style={{ color: "#888", fontSize: "9px" }}>Loading...</span>;

  return (
    <div style={{ marginTop: "0.5rem" }}>
      <p style={{ color: "#888", fontSize: "9px", margin: "0 0 4px" }}>
        Click and drag to select a segment (max {MAX_BLIP_MS}ms):
      </p>
      <canvas
        ref={canvasRef}
        width={280}
        height={40}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: "crosshair", width: "100%", maxWidth: 280, height: 40, display: "block" }}
      />
      <p style={{ color: "#888", fontSize: "8px", margin: "2px 0" }}>
        Selected: {selectionMs}ms
      </p>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button onClick={handlePreview} disabled={selectionMs < 5} className="nes-btn is-dark" style={{ fontSize: "9px", padding: "4px 8px" }}>
          Preview
        </button>
        <button onClick={handleConfirm} disabled={selectionMs < 5} className="nes-btn is-success" style={{ fontSize: "9px", padding: "4px 8px" }}>
          Use this
        </button>
        <button onClick={onCancel} className="nes-btn is-error" style={{ fontSize: "9px", padding: "4px 8px" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
