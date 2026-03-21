import { useState } from "react";
import { useAudioRecorder, playAudio } from "../hooks/useAudioRecorder";
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

function PresetButton({ name, isSelected, onSelect }: { name: string; isSelected: boolean; onSelect: () => void }) {
  const play = () => {
    const audio = new Audio(`${BASE}audio/voice/${name}.wav`);
    audio.play().catch(() => {});
  };

  return (
    <button
      onClick={() => { onSelect(); play(); }}
      className={`nes-btn ${isSelected ? "is-warning" : "is-dark"}`}
      style={{ fontSize: "8px", padding: "4px 6px", margin: "2px" }}
    >
      {name.replace("Voice", "")}
    </button>
  );
}

export function VoiceSelector({ selected, customVoice, onSelect, onCustomVoice }: VoiceSelectorProps) {
  const { recording, processing, start, stop } = useAudioRecorder();
  const [rawRecording, setRawRecording] = useState<string | null>(null);
  const activeVoice = selected || DEFAULT_VOICE;

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
      <div style={{ display: "flex", flexWrap: "wrap", marginBottom: "0.5rem" }}>
        {VOICES.map((name) => (
          <PresetButton
            key={name}
            name={name}
            isSelected={activeVoice === name}
            onSelect={() => onSelect(name)}
          />
        ))}
      </div>

      <p style={{ color: "#666", fontSize: "9px", margin: "0.5rem 0 0.25rem" }}>
        Or record your own voice blip (max 3s, you'll crop a 400ms segment):
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
        <button
          onClick={handleRecord}
          disabled={processing || !!rawRecording}
          className={`nes-btn ${recording ? "is-error" : "is-dark"}`}
          style={{ fontSize: "9px", padding: "4px 8px" }}
        >
          {processing ? "Processing..." : recording ? "Stop" : "Record"}
        </button>
        {customVoice && !rawRecording && (
          <>
            <button
              onClick={() => playAudio(customVoice)}
              className="nes-btn is-success"
              style={{ fontSize: "9px", padding: "4px 8px" }}
            >
              Preview
            </button>
            <button
              onClick={() => onSelect("custom")}
              className={`nes-btn ${activeVoice === "custom" ? "is-warning" : "is-dark"}`}
              style={{ fontSize: "9px", padding: "4px 8px" }}
            >
              Use recording
            </button>
            <button
              onClick={() => { onSelect(activeVoice === "custom" ? DEFAULT_VOICE : activeVoice); onCustomVoice(null); }}
              className="nes-btn is-error"
              style={{ fontSize: "9px", padding: "4px 8px" }}
            >
              Remove
            </button>
          </>
        )}
      </div>
      {rawRecording && (
        <AudioCropper rawAudio={rawRecording} onCrop={handleCrop} onCancel={() => setRawRecording(null)} />
      )}
    </div>
  );
}
