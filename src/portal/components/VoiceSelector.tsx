import { useState, useEffect, useRef } from "react";
import { useAudioRecorder, getWaveform } from "../hooks/useAudioRecorder";
import { AudioCropper } from "./AudioCropper";

const BASE = import.meta.env.BASE_URL;
const VOICES = Array.from({ length: 10 }, (_, i) => `Voice${i + 1}`);
const DEFAULT_VOICE = "Voice9";

interface VoiceSelectorProps {
  selected: string | null;
  customVoice: string | null;
  onSelect: (voice: string) => void;
  onCustomVoice: (dataUrl: string | null) => void;
}

function WaveformPreview({ src }: { src: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    getWaveform(src).then((data) => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d")!;
      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#E95420";
      const samplesPerPx = data.length / w;
      for (let x = 0; x < w; x++) {
        const val = Math.abs(data[Math.floor(x * samplesPerPx)]);
        const barH = Math.max(1, val * h);
        ctx.fillRect(x, (h - barH) / 2, 1, barH);
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [src]);

  return <canvas ref={canvasRef} width={280} height={30} style={{ width: "100%", maxWidth: 280, height: 30, display: "block", marginTop: 4 }} />;
}

export function VoiceSelector({ selected, customVoice, onSelect, onCustomVoice }: VoiceSelectorProps) {
  const { recording, processing, start, stop } = useAudioRecorder();
  const [rawRecording, setRawRecording] = useState<string | null>(null);
  const activeVoice = selected || DEFAULT_VOICE;
  const isCustom = activeVoice === "custom";

  const handlePresetClick = (name: string) => {
    onSelect(name);
    const audio = new Audio(`${BASE}audio/voice/${name}.wav`);
    audio.play().catch(() => {});
  };

  const handleCustomClick = () => {
    onSelect("custom");
  };

  const handleRecord = async () => {
    if (recording) {
      const result = await stop();
      if (result) setRawRecording(result);
    } else {
      setRawRecording(null);
      await start();
    }
  };

  const handleCrop = (croppedDataUrl: string) => {
    onCustomVoice(croppedDataUrl);
    onSelect("custom");
    setRawRecording(null);
  };

  return (
    <div>
      <p style={{ color: "#888", fontSize: "10px", margin: "0 0 0.5rem" }}>
        Pick a voice for your character's dialogue blips:
      </p>
      <div style={{ display: "flex", flexWrap: "wrap" }}>
        {VOICES.map((name) => (
          <button
            key={name}
            onClick={() => handlePresetClick(name)}
            className={`nes-btn ${activeVoice === name ? "is-warning" : "is-dark"}`}
            style={{ fontSize: "8px", padding: "4px 6px", margin: "2px" }}
          >
            {name.replace("Voice", "")}
          </button>
        ))}
        <button
          onClick={handleCustomClick}
          className={`nes-btn ${isCustom ? "is-warning" : "is-dark"}`}
          style={{ fontSize: "8px", padding: "4px 6px", margin: "2px" }}
        >
          Rec
        </button>
      </div>

      {!isCustom && (
        <WaveformPreview src={`${BASE}audio/voice/${activeVoice}.wav`} />
      )}

      {isCustom && !rawRecording && (
        <div style={{ marginTop: "0.5rem" }}>
          {customVoice ? (
            <WaveformPreview src={customVoice} />
          ) : (
            <p style={{ color: "#888", fontSize: "9px" }}>
              Record a short sound (max 3s), then crop a segment:
            </p>
          )}
          <button
            onClick={handleRecord}
            disabled={processing}
            className={`nes-btn ${recording ? "is-error" : "is-dark"}`}
            style={{ fontSize: "9px", padding: "4px 8px", marginTop: "0.5rem" }}
          >
            {processing ? "Processing..." : recording ? "Stop" : customVoice ? "Re-record" : "Record"}
          </button>
        </div>
      )}

      {isCustom && rawRecording && (
        <AudioCropper rawAudio={rawRecording} onCrop={handleCrop} onCancel={() => setRawRecording(null)} />
      )}
    </div>
  );
}
