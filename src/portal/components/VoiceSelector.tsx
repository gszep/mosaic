import { useState, useEffect, useRef } from "react";
import { useAudioRecorder, getWaveform, cropDataUrl, MAX_BLIP_MS } from "../hooks/useAudioRecorder";

const BASE = import.meta.env.BASE_URL;
const VOICES = Array.from({ length: 10 }, (_, i) => `Voice${i + 1}`);
const DEFAULT_VOICE = "Voice9";
const PREVIEW_TEXT = "Happy birthday!";
const TYPEWRITER_INTERVAL = 17;
const BLIP_EVERY = 3;
const CANVAS_W = 280;
const CANVAS_H = 30;

interface VoiceSelectorProps {
  selected: string | null;
  customVoice: string | null;
  onSelect: (voice: string) => void;
  onCustomVoice: (dataUrl: string | null) => void;
}

export function VoiceSelector({ selected, customVoice, onSelect, onCustomVoice }: VoiceSelectorProps) {
  const { recording, processing, start, stop } = useAudioRecorder();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [waveform, setWaveform] = useState<Float32Array | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [startMs, setStartMs] = useState(0);
  const [endMs, setEndMs] = useState(0);
  const [rawAudioUrl, setRawAudioUrl] = useState<string | null>(null);
  const dragging = useRef(false);
  const [trigger, setTrigger] = useState(0);
  const [typewriterText, setTypewriterText] = useState("");
  const [typewriterPlaying, setTypewriterPlaying] = useState(false);
  const typewriterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeVoice = selected || DEFAULT_VOICE;
  const isCustom = activeVoice === "custom";

  // Load waveform when voice changes
  useEffect(() => {
    let cancelled = false;
    let src: string;
    if (isCustom && customVoice) {
      src = customVoice;
    } else if (isCustom && rawAudioUrl) {
      src = rawAudioUrl;
    } else if (!isCustom) {
      src = `${BASE}audio/voice/${activeVoice}.wav`;
    } else {
      setWaveform(null);
      return;
    }

    getWaveform(src).then((data) => {
      if (cancelled) return;
      const dur = (data.length / 8000) * 1000;
      setWaveform(data);
      setDurationMs(dur);
      if (isCustom && !customVoice) {
        // Raw recording: default 350ms centered
        const center = dur / 2;
        const half = Math.min(MAX_BLIP_MS, dur) / 2;
        setStartMs(Math.max(0, center - half));
        setEndMs(Math.min(dur, center + half));
      } else {
        // Preset or saved custom: highlight full
        setStartMs(0);
        setEndMs(dur);
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [activeVoice, isCustom, customVoice, rawAudioUrl]);

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const w = CANVAS_W;
    const h = CANVAS_H;
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, w, h);

    if (!waveform || durationMs === 0) return;

    const samplesPerPx = waveform.length / w;

    // Dimmed full waveform
    ctx.fillStyle = "#444";
    for (let x = 0; x < w; x++) {
      const val = Math.abs(waveform[Math.floor(x * samplesPerPx)]);
      const barH = Math.max(1, val * h);
      ctx.fillRect(x, (h - barH) / 2, 1, barH);
    }

    // Dim outside selection
    const selL = Math.floor((startMs / durationMs) * w);
    const selR = Math.ceil((endMs / durationMs) * w);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, selL, h);
    ctx.fillRect(selR, 0, w - selR, h);

    // Highlighted selection
    if (selR > selL) {
      ctx.fillStyle = "#E95420";
      for (let x = selL; x < selR && x < w; x++) {
        const val = Math.abs(waveform[Math.floor(x * samplesPerPx)]);
        const barH = Math.max(1, val * h);
        ctx.fillRect(x, (h - barH) / 2, 1, barH);
      }
      ctx.strokeStyle = "#E95420";
      ctx.lineWidth = 1;
      ctx.strokeRect(selL, 0, selR - selL, h);
    }
  }, [waveform, startMs, endMs, durationMs]);

  // Typewriter preview
  useEffect(() => {
    if (trigger === 0) return;
    if (typewriterTimer.current) clearTimeout(typewriterTimer.current);

    const voiceUrl = isCustom && customVoice
      ? customVoice
      : `${BASE}audio/voice/${isCustom ? DEFAULT_VOICE : activeVoice}.wav`;

    setTypewriterText("");
    setTypewriterPlaying(true);
    let i = 0;
    let blipCount = 0;
    const tick = () => {
      if (i >= PREVIEW_TEXT.length) { setTypewriterPlaying(false); return; }
      i++;
      setTypewriterText(PREVIEW_TEXT.slice(0, i));
      const ch = PREVIEW_TEXT[i - 1];
      if (ch !== " ") {
        blipCount++;
        if (blipCount === 1 || blipCount % BLIP_EVERY === 0) {
          const audio = new Audio(voiceUrl);
          audio.volume = 0.4;
          audio.play().catch(() => {});
        }
      }
      typewriterTimer.current = setTimeout(tick, TYPEWRITER_INTERVAL);
    };
    tick();
    return () => { if (typewriterTimer.current) clearTimeout(typewriterTimer.current); };
  }, [trigger, activeVoice, isCustom, customVoice]);

  // Canvas drag handlers (only for custom raw recordings)
  const canDrag = isCustom && rawAudioUrl && !customVoice;

  const pxToMs = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return Math.max(0, Math.min(((e.clientX - rect.left) / rect.width) * durationMs, durationMs));
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canDrag) return;
    const ms = pxToMs(e);
    setStartMs(ms);
    setEndMs(ms);
    dragging.current = true;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragging.current) return;
    const ms = pxToMs(e);
    setEndMs(Math.max(startMs, Math.min(ms, startMs + MAX_BLIP_MS)));
  };

  const handleMouseUp = async () => {
    if (!dragging.current) return;
    dragging.current = false;
    // Auto-crop and preview on drag end
    if (rawAudioUrl) {
      const len = endMs - startMs;
      if (len >= 5) {
        const cropped = await cropDataUrl(rawAudioUrl, startMs, len);
        onCustomVoice(cropped);
        onSelect("custom");
        setTrigger((t) => t + 1);
      }
    }
  };

  // Record toggle
  const handleRecord = async () => {
    if (recording) {
      const result = await stop();
      if (result) {
        setRawAudioUrl(result);
        onCustomVoice(null); // clear old crop
      }
    } else {
      setRawAudioUrl(null);
      onCustomVoice(null);
      await start();
    }
  };

  const selectVoice = (name: string) => {
    onSelect(name);
    setRawAudioUrl(null);
    setTrigger((t) => t + 1);
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
            onClick={() => selectVoice(name)}
            className={`nes-btn ${activeVoice === name ? "is-warning" : "is-dark"}`}
            style={{ fontSize: "8px", padding: "4px 6px", margin: "2px" }}
          >
            {name.replace("Voice", "")}
          </button>
        ))}
        <button
          onClick={() => selectVoice("custom")}
          className={`nes-btn ${isCustom ? "is-warning" : "is-dark"}`}
          style={{ fontSize: "8px", padding: "4px 6px", margin: "2px" }}
        >
          Rec
        </button>
      </div>

      {/* Waveform + record button row */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            flex: 1,
            maxWidth: CANVAS_W,
            height: CANVAS_H,
            display: "block",
            cursor: canDrag ? "crosshair" : "default",
          }}
        />
        <button
          onClick={handleRecord}
          disabled={!isCustom || processing}
          className={`nes-btn ${recording ? "is-error" : !isCustom ? "is-disabled" : "is-dark"}`}
          style={{ fontSize: "8px", padding: "4px 8px", flexShrink: 0 }}
        >
          {processing ? "..." : recording ? "Stop" : "Rec"}
        </button>
      </div>


      {/* Typewriter preview */}
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
          {typewriterText}<span style={{ opacity: typewriterPlaying ? 1 : 0 }}>_</span>
        </div>
      </div>
    </div>
  );
}
