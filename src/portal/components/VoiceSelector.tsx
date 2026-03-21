import { useState, useEffect, useRef } from "react";
import { useAudioRecorder, getWaveform, MAX_BLIP_MS } from "../hooks/useAudioRecorder";

const BASE = import.meta.env.BASE_URL;
const VOICES = Array.from({ length: 10 }, (_, i) => `Voice${i + 1}`);
const DEFAULT_VOICE = "Voice9";
const PREVIEW_TEXT = "Happy birthday!";
const TYPEWRITER_INTERVAL = 17;
const BLIP_EVERY = 3;
const CANVAS_W = 280;
const CANVAS_H = 30;
const SAMPLE_RATE = 8000;

interface VoiceSelectorProps {
  voice: string | null;
  voiceData: string | null;
  voiceStart: number | null;
  voiceEnd: number | null;
  onVoice: (voice: string, voiceData?: string | null, voiceStart?: number | null, voiceEnd?: number | null) => void;
}

function cropToBlip(fullDataUrl: string, startMs: number, endMs: number): Promise<string> {
  return getWaveform(fullDataUrl).then((data) => {
    const s = Math.floor((startMs / 1000) * SAMPLE_RATE);
    const e = Math.floor((endMs / 1000) * SAMPLE_RATE);
    const cropped = data.slice(s, e);
    if (cropped.length === 0) return fullDataUrl;
    const buf = new AudioBuffer({ length: cropped.length, sampleRate: SAMPLE_RATE, numberOfChannels: 1 });
    buf.copyToChannel(new Float32Array(cropped), 0);

    // Encode WAV
    const bps = 16;
    const dataSize = cropped.length * 2;
    const ab = new ArrayBuffer(44 + dataSize);
    const v = new DataView(ab);
    const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, "RIFF"); v.setUint32(4, 36 + dataSize, true); w(8, "WAVE"); w(12, "fmt ");
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, SAMPLE_RATE, true); v.setUint32(28, SAMPLE_RATE * 2, true);
    v.setUint16(32, 2, true); v.setUint16(34, bps, true); w(36, "data"); v.setUint32(40, dataSize, true);
    for (let i = 0; i < cropped.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, cropped[i])) * 0x7fff, true);
    const bytes = new Uint8Array(ab);
    let bin = ""; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return "data:audio/wav;base64," + btoa(bin);
  });
}

export function VoiceSelector({ voice, voiceData, voiceStart, voiceEnd, onVoice }: VoiceSelectorProps) {
  const { recording, processing, start, stop } = useAudioRecorder();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [waveform, setWaveform] = useState<Float32Array | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [startMs, setStartMs] = useState(0);
  const [endMs, setEndMs] = useState(0);
  const dragging = useRef(false);
  const [trigger, setTrigger] = useState(0);
  const [typewriterText, setTypewriterText] = useState("");
  const [typewriterPlaying, setTypewriterPlaying] = useState(false);
  const typewriterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeVoice = voice || DEFAULT_VOICE;
  const isCustom = activeVoice === "custom";

  // Audio source for waveform display
  const waveformSrc = isCustom
    ? (voiceData || null)
    : `${BASE}audio/voice/${activeVoice}.wav`;

  // Load waveform
  useEffect(() => {
    if (!waveformSrc) { setWaveform(null); return; }
    let cancelled = false;
    getWaveform(waveformSrc).then((data) => {
      if (cancelled) return;
      const dur = (data.length / SAMPLE_RATE) * 1000;
      setWaveform(data);
      setDurationMs(dur);
      if (isCustom && voiceStart != null && voiceEnd != null) {
        setStartMs(voiceStart);
        setEndMs(voiceEnd);
      } else {
        setStartMs(0);
        setEndMs(dur);
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [waveformSrc]); // eslint-disable-line react-hooks/exhaustive-deps

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    if (!waveform || durationMs === 0) return;

    const spp = waveform.length / CANVAS_W;
    ctx.fillStyle = "#444";
    for (let x = 0; x < CANVAS_W; x++) {
      const val = Math.abs(waveform[Math.floor(x * spp)]);
      const h = Math.max(1, val * CANVAS_H);
      ctx.fillRect(x, (CANVAS_H - h) / 2, 1, h);
    }

    const selL = Math.floor((startMs / durationMs) * CANVAS_W);
    const selR = Math.ceil((endMs / durationMs) * CANVAS_W);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, selL, CANVAS_H);
    ctx.fillRect(selR, 0, CANVAS_W - selR, CANVAS_H);

    if (selR > selL) {
      ctx.fillStyle = "#E95420";
      for (let x = selL; x < selR && x < CANVAS_W; x++) {
        const val = Math.abs(waveform[Math.floor(x * spp)]);
        const h = Math.max(1, val * CANVAS_H);
        ctx.fillRect(x, (CANVAS_H - h) / 2, 1, h);
      }
      ctx.strokeStyle = "#E95420";
      ctx.lineWidth = 1;
      ctx.strokeRect(selL, 0, selR - selL, CANVAS_H);
    }
  }, [waveform, startMs, endMs, durationMs]);

  // Typewriter preview
  useEffect(() => {
    if (trigger === 0) return;
    if (typewriterTimer.current) clearTimeout(typewriterTimer.current);

    // Build the blip URL: crop from source
    let blipPromise: Promise<string>;
    if (waveformSrc) {
      blipPromise = cropToBlip(waveformSrc, startMs, endMs);
    } else {
      return;
    }

    blipPromise.then((blipUrl) => {
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
            const audio = new Audio(blipUrl);
            audio.volume = 0.4;
            audio.play().catch(() => {});
          }
        }
        typewriterTimer.current = setTimeout(tick, TYPEWRITER_INTERVAL);
      };
      tick();
    });
    return () => { if (typewriterTimer.current) clearTimeout(typewriterTimer.current); };
  }, [trigger]); // eslint-disable-line react-hooks/exhaustive-deps

  // Drag handlers (custom only)
  const pxToMs = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return Math.max(0, Math.min(((e.clientX - rect.left) / rect.width) * durationMs, durationMs));
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isCustom || !voiceData) return;
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

  const handleMouseUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    const len = endMs - startMs;
    if (len >= 5 && voiceData) {
      onVoice("custom", voiceData, startMs, endMs);
      setTrigger((t) => t + 1);
    }
  };

  // Select preset (preserve custom data for switching back)
  const selectPreset = (name: string) => {
    onVoice(name);
    setTrigger((t) => t + 1);
  };

  // Select custom
  const selectCustom = () => {
    onVoice("custom");
    setTrigger((t) => t + 1);
  };

  // Record
  const handleRecord = async () => {
    if (recording) {
      const result = await stop();
      if (result) {
        // Get duration for default center selection
        const data = await getWaveform(result);
        const dur = (data.length / SAMPLE_RATE) * 1000;
        const center = dur / 2;
        const half = Math.min(MAX_BLIP_MS, dur) / 2;
        const s = Math.max(0, center - half);
        const e = Math.min(dur, center + half);
        onVoice("custom", result, s, e);
        setTrigger((t) => t + 1);
      }
    } else {
      await start();
    }
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
            onClick={() => selectPreset(name)}
            className={`nes-btn ${activeVoice === name ? "is-warning" : "is-dark"}`}
            style={{ fontSize: "8px", padding: "4px 6px", margin: "2px" }}
          >
            {name.replace("Voice", "")}
          </button>
        ))}
        <button
          onClick={selectCustom}
          className={`nes-btn ${isCustom ? "is-warning" : "is-dark"}`}
          style={{ fontSize: "8px", padding: "4px 8px", margin: "2px", lineHeight: 1 }}
        >
          <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#E95420" }} />
        </button>
      </div>

      {/* Waveform + record button */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ flex: 1, maxWidth: CANVAS_W, height: CANVAS_H, display: "block", cursor: isCustom && voiceData ? "crosshair" : "default" }}
        />
        <button
          onClick={handleRecord}
          disabled={!isCustom || processing}
          className={`nes-btn ${recording ? "is-error" : !isCustom ? "is-disabled" : "is-dark"}`}
          style={{ fontSize: "8px", padding: "4px 8px", flexShrink: 0, lineHeight: 1 }}
        >
          {processing ? "..." : recording ? "Stop" : <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: isCustom ? "#E95420" : "#666" }} />}
        </button>
      </div>

      {/* Typewriter preview */}
      <div style={{ marginTop: 6 }}>
        <div style={{
          background: "#1a1a2e", border: "2px solid #E95420", padding: "6px 8px",
          minHeight: 24, fontFamily: "monospace", fontSize: "11px", color: "#eee", letterSpacing: 1,
        }}>
          {typewriterText}<span style={{ opacity: typewriterPlaying ? 1 : 0 }}>_</span>
        </div>
      </div>
    </div>
  );
}
