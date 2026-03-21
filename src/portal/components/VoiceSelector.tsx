import { useState, useRef, useCallback } from "react";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { AudioCropper } from "./AudioCropper";

const BASE = import.meta.env.BASE_URL;
const VOICES = Array.from({ length: 10 }, (_, i) => `Voice${i + 1}`);
const DEFAULT_VOICE = "Voice9";
const PREVIEW_TEXT = "Happy birthday!";
const TYPEWRITER_INTERVAL = 17; // ms per char (~1 char/frame at 60fps)
const BLIP_EVERY = 3;

interface VoiceSelectorProps {
  selected: string | null;
  customVoice: string | null;
  onSelect: (voice: string) => void;
  onCustomVoice: (dataUrl: string | null) => void;
}

function TypewriterPreview({ voiceUrl }: { voiceUrl: string }) {
  const [text, setText] = useState("");
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const play = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setText("");
    setPlaying(true);
    let i = 0;
    let blipCount = 0;
    const tick = () => {
      if (i >= PREVIEW_TEXT.length) {
        setPlaying(false);
        return;
      }
      i++;
      setText(PREVIEW_TEXT.slice(0, i));
      const ch = PREVIEW_TEXT[i - 1];
      if (ch !== " ") {
        blipCount++;
        if (blipCount === 1 || blipCount % BLIP_EVERY === 0) {
          const audio = new Audio(voiceUrl);
          audio.volume = 0.4;
          audio.play().catch(() => {});
        }
      }
      timerRef.current = setTimeout(tick, TYPEWRITER_INTERVAL);
    };
    tick();
  }, [voiceUrl]);

  return (
    <div style={{ marginTop: 6 }}>
      <div
        style={{
          background: "#1a1a2e",
          border: "2px solid #E95420",
          padding: "6px 8px",
          minHeight: 24,
          fontFamily: "monospace",
          fontSize: "11px",
          color: "#eee",
          letterSpacing: 1,
        }}
      >
        {text}<span style={{ opacity: playing ? 1 : 0 }}>_</span>
      </div>
      <button
        onClick={play}
        disabled={playing}
        className={`nes-btn ${playing ? "is-disabled" : "is-dark"}`}
        style={{ fontSize: "9px", padding: "4px 8px", marginTop: 6 }}
      >
        {playing ? "Playing..." : "Preview"}
      </button>
    </div>
  );
}

export function VoiceSelector({ selected, customVoice, onSelect, onCustomVoice }: VoiceSelectorProps) {
  const { recording, processing, start, stop } = useAudioRecorder();
  const [rawRecording, setRawRecording] = useState<string | null>(null);
  const activeVoice = selected || DEFAULT_VOICE;
  const isCustom = activeVoice === "custom";

  const voiceUrl = isCustom && customVoice
    ? customVoice
    : `${BASE}audio/voice/${isCustom ? DEFAULT_VOICE : activeVoice}.wav`;

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
            onClick={() => onSelect(name)}
            className={`nes-btn ${activeVoice === name ? "is-warning" : "is-dark"}`}
            style={{ fontSize: "8px", padding: "4px 6px", margin: "2px" }}
          >
            {name.replace("Voice", "")}
          </button>
        ))}
        <button
          onClick={() => onSelect("custom")}
          className={`nes-btn ${isCustom ? "is-warning" : "is-dark"}`}
          style={{ fontSize: "8px", padding: "4px 6px", margin: "2px" }}
        >
          Rec
        </button>
      </div>

      {/* Consistent layout: preview + record section always present */}
      <TypewriterPreview voiceUrl={voiceUrl} />

      {isCustom && (
        <div style={{ marginTop: 6 }}>
          {!rawRecording && (
            <button
              onClick={handleRecord}
              disabled={processing}
              className={`nes-btn ${recording ? "is-error" : "is-dark"}`}
              style={{ fontSize: "9px", padding: "4px 8px" }}
            >
              {processing ? "Processing..." : recording ? "Stop" : customVoice ? "Re-record" : "Record"}
            </button>
          )}
          {rawRecording && (
            <AudioCropper rawAudio={rawRecording} onCrop={handleCrop} onCancel={() => setRawRecording(null)} />
          )}
        </div>
      )}
    </div>
  );
}
