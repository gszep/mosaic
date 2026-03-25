import { useState, useEffect, useRef } from "react";
import { useAudioRecorder, getWaveform, MAX_BLIP_MS } from "../hooks/useAudioRecorder";
import { encodeWav, cropSamples, SAMPLE_RATE } from "../../shared/audio";

const BASE = import.meta.env.BASE_URL;
const VOICES = Array.from({ length: 10 }, (_, i) => `Voice${i + 1}`);
const VOICE_ICONS: Record<string, string> = {
  Voice1: "♩", Voice2: "♪", Voice3: "♫", Voice4: "♬", Voice5: "♭",
  Voice6: "♮", Voice7: "♯", Voice8: "𝄞", Voice9: "𝄢", Voice10: "𝅘𝅥",
};
const DEFAULT_VOICE = "Voice9";
const PREVIEW_TEXT = "Happy birthday!";
const TYPEWRITER_INTERVAL = 17;
const BLIP_EVERY = 3;
const CANVAS_W = 280;
const CANVAS_H = 30;

interface VoiceSelectorProps {
  voice: string | null;
  voiceData: string | null;
  voiceStart: number | null;
  voiceEnd: number | null;
  onVoice: (voice: string, voiceData?: string | null, voiceStart?: number | null, voiceEnd?: number | null) => void;
}

function cropToBlip(fullDataUrl: string, startMs: number, endMs: number): Promise<string> {
  return getWaveform(fullDataUrl).then((data) => {
    const cropped = cropSamples(data, startMs, endMs);
    if (cropped.length === 0) return fullDataUrl;
    return encodeWav(cropped);
  });
}

export function VoiceSelector({ voice, voiceData, voiceStart, voiceEnd, onVoice }: VoiceSelectorProps) {
  const handleRecordingResult = async (result: string) => {
    if (!result) return;
    const data = await getWaveform(result);
    const dur = (data.length / SAMPLE_RATE) * 1000;
    const center = dur / 2;
    const half = Math.min(MAX_BLIP_MS, dur) / 2;
    const s = Math.max(0, center - half);
    const e = Math.min(dur, center + half);
    onVoice("custom", result, s, e);
    triggerPreview(result, s, e);
  };

  const { recording, acquiring, processing, start, stop } = useAudioRecorder(handleRecordingResult);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [waveform, setWaveform] = useState<Float32Array | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [startMs, setStartMs] = useState(0);
  const [endMs, setEndMs] = useState(0);
  const dragging = useRef(false);
  const [preview, setPreview] = useState<{ url: string; s: number; e: number; n: number } | null>(null);
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

  useEffect(() => {
    if (!preview) return;
    if (typewriterTimer.current) clearTimeout(typewriterTimer.current);

    cropToBlip(preview.url, preview.s, preview.e).then((blipUrl) => {
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
  }, [preview]);

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

  const touchToMs = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const touch = e.touches[0] || e.changedTouches[0];
    return Math.max(0, Math.min(((touch.clientX - rect.left) / rect.width) * durationMs, durationMs));
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isCustom || !voiceData) return;
    e.preventDefault();
    const ms = touchToMs(e);
    setStartMs(ms);
    setEndMs(ms);
    dragging.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!dragging.current) return;
    e.preventDefault();
    const ms = touchToMs(e);
    setEndMs(Math.max(startMs, Math.min(ms, startMs + MAX_BLIP_MS)));
  };

  const handleTouchEnd = () => {
    if (!dragging.current) return;
    dragging.current = false;
    const len = endMs - startMs;
    if (len >= 5 && voiceData) {
      onVoice("custom", voiceData, startMs, endMs);
      triggerPreview(voiceData, startMs, endMs);
    }
  };

  const triggerPreview = (url: string, s: number, e: number) =>
    setPreview({ url, s, e, n: Date.now() });

  const handleMouseUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    const len = endMs - startMs;
    if (len >= 5 && voiceData) {
      onVoice("custom", voiceData, startMs, endMs);
      triggerPreview(voiceData, startMs, endMs);
    }
  };

  const selectPreset = (name: string) => {
    onVoice(name);
    triggerPreview(`${BASE}audio/voice/${name}.wav`, 0, 99999);
  };

  // Record — always available, auto-switches to custom
  const handleRecord = async () => {
    if (recording) {
      const result = await stop();
      await handleRecordingResult(result);
    } else {
      await start();
    }
  };

  const handlePlay = () => {
    if (!voiceData) return;
    onVoice("custom", voiceData, voiceStart, voiceEnd);
    triggerPreview(voiceData, voiceStart ?? 0, voiceEnd ?? 99999);
  };

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap" }}>
        {VOICES.map((name) => (
          <button
            key={name}
            onClick={() => selectPreset(name)}
            className={`nes-btn ${activeVoice === name ? "is-warning" : "is-dark"}`}
            style={{ fontSize: "16px", padding: "0 0 8px 0", margin: "2px", width: 32, height: 32, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
          >
            {VOICE_ICONS[name]}
          </button>
        ))}
      </div>

      {/* Waveform + record button */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, maxWidth: "100%", overflow: "hidden" }}>
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{ flex: 1, minWidth: 0, maxWidth: CANVAS_W, height: CANVAS_H, display: "block", cursor: isCustom && voiceData ? "crosshair" : "default", touchAction: "none" }}
        />
        <button
          onClick={handleRecord}
          disabled={processing || acquiring}
          className={`nes-btn ${recording ? "is-error" : acquiring ? "is-disabled" : isCustom && voiceData ? "is-warning" : "is-dark"}`}
          style={{ fontSize: "8px", padding: "4px 8px", flexShrink: 0, lineHeight: 1 }}
        >
          {processing || acquiring ? "..." : <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: recording ? 0 : "50%", background: recording ? "#fff" : "#E95420" }} />}
        </button>
        <button
          onClick={handlePlay}
          disabled={!voiceData || typewriterPlaying}
          className={`nes-btn ${!voiceData || typewriterPlaying ? "is-disabled" : isCustom ? "is-warning" : "is-dark"}`}
          style={{ fontSize: "8px", padding: "4px 8px", flexShrink: 0, lineHeight: 1 }}
        >
          ▶
        </button>
      </div>

      {/* Typewriter preview */}
      <div style={{ marginTop: 6 }}>
        <div style={{
          background: "#1a1a2e", border: "2px solid #E95420", padding: "6px 8px",
          minHeight: 24, fontFamily: "'Press Start 2P', cursive", fontSize: "10px", color: "#eee",
        }}>
          {typewriterText}<span style={{ opacity: typewriterPlaying ? 1 : 0 }}>_</span>
        </div>
      </div>
    </div>
  );
}
