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

  useEffect(() => {
    getWaveform(rawAudio).then((data) => {
      setWaveform(data);
      setDurationMs((data.length / 8000) * 1000);
    });
  }, [rawAudio]);

  // Draw waveform with selection window
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !waveform) return;
    const ctx = canvas.getContext("2d")!;
    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, w, h);

    // Draw full waveform
    const samplesPerPx = waveform.length / w;
    ctx.fillStyle = "#555";
    for (let x = 0; x < w; x++) {
      const idx = Math.floor(x * samplesPerPx);
      const val = Math.abs(waveform[idx]);
      const barH = val * h;
      ctx.fillRect(x, (h - barH) / 2, 1, barH);
    }

    // Draw selection window
    const selStartPx = (startMs / durationMs) * w;
    const selWidthPx = Math.min((MAX_BLIP_MS / durationMs) * w, w - selStartPx);

    // Dim outside selection
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, selStartPx, h);
    ctx.fillRect(selStartPx + selWidthPx, 0, w - selStartPx - selWidthPx, h);

    // Selection border
    ctx.strokeStyle = "#E95420";
    ctx.lineWidth = 2;
    ctx.strokeRect(selStartPx, 0, selWidthPx, h);

    // Re-draw waveform inside selection in highlight color
    ctx.fillStyle = "#E95420";
    for (let x = Math.floor(selStartPx); x < Math.ceil(selStartPx + selWidthPx) && x < w; x++) {
      const idx = Math.floor(x * samplesPerPx);
      const val = Math.abs(waveform[idx]);
      const barH = val * h;
      ctx.fillRect(x, (h - barH) / 2, 1, barH);
    }
  }, [waveform, startMs, durationMs]);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const clickMs = x * durationMs;
      setStartMs(Math.max(0, Math.min(clickMs - MAX_BLIP_MS / 2, durationMs - MAX_BLIP_MS)));
    },
    [durationMs]
  );

  const handlePreview = useCallback(async () => {
    const cropped = await cropDataUrl(rawAudio, startMs);
    playAudio(cropped);
  }, [rawAudio, startMs]);

  const handleConfirm = useCallback(async () => {
    const cropped = await cropDataUrl(rawAudio, startMs);
    onCrop(cropped);
  }, [rawAudio, startMs, onCrop]);

  if (!waveform) return <span style={{ color: "#888", fontSize: "9px" }}>Loading...</span>;

  return (
    <div style={{ marginTop: "0.5rem" }}>
      <p style={{ color: "#888", fontSize: "9px", margin: "0 0 4px" }}>
        Click the waveform to select a {MAX_BLIP_MS}ms segment:
      </p>
      <canvas
        ref={canvasRef}
        width={280}
        height={40}
        onClick={handleCanvasClick}
        style={{ cursor: "crosshair", width: "100%", maxWidth: 280, height: 40, display: "block" }}
      />
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
        <button onClick={handlePreview} className="nes-btn is-dark" style={{ fontSize: "9px", padding: "4px 8px" }}>
          Preview
        </button>
        <button onClick={handleConfirm} className="nes-btn is-success" style={{ fontSize: "9px", padding: "4px 8px" }}>
          Use this
        </button>
        <button onClick={onCancel} className="nes-btn is-error" style={{ fontSize: "9px", padding: "4px 8px" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
