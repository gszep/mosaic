import { useState, useRef, useCallback } from "react";

const MAX_DURATION = 3000; // ms
const CRUSHED_RATE = 8000; // low sample rate for retro feel
const BIT_DEPTH = 4; // bits for crushing
const MAX_BLIP_MS = 350;

function trimSilence(data: Float32Array, sampleRate: number): Float32Array {
  const windowSize = Math.floor(sampleRate * 0.01); // 10ms windows
  const threshold = 0.02; // RMS threshold for voice activity
  const pad = Math.floor(sampleRate * 0.05); // 50ms padding

  // Compute RMS energy per window
  let start = 0;
  let end = data.length;

  // Find start of voice
  for (let i = 0; i < data.length - windowSize; i += windowSize) {
    let sum = 0;
    for (let j = 0; j < windowSize; j++) sum += data[i + j] * data[i + j];
    if (Math.sqrt(sum / windowSize) > threshold) {
      start = Math.max(0, i - pad);
      break;
    }
  }

  // Find end of voice (scan backwards)
  for (let i = data.length - windowSize; i >= 0; i -= windowSize) {
    let sum = 0;
    for (let j = 0; j < windowSize; j++) sum += data[i + j] * data[i + j];
    if (Math.sqrt(sum / windowSize) > threshold) {
      end = Math.min(data.length, i + windowSize + pad);
      break;
    }
  }

  return data.slice(start, end);
}

async function bitcrush(blob: Blob): Promise<string> {
  const arrayBuf = await blob.arrayBuffer();
  const audioCtx = new OfflineAudioContext(1, CRUSHED_RATE * 3, CRUSHED_RATE);
  const source = audioCtx.createBufferSource();
  const decoded = await audioCtx.decodeAudioData(arrayBuf);
  source.buffer = decoded;
  source.connect(audioCtx.destination);
  source.start();
  const rendered = await audioCtx.startRendering();

  // Trim silence
  const trimmed = trimSilence(rendered.getChannelData(0), rendered.sampleRate);
  if (trimmed.length === 0) return "";

  // Create new buffer with trimmed data
  const trimBuf = new AudioBuffer({
    length: trimmed.length,
    sampleRate: rendered.sampleRate,
    numberOfChannels: 1,
  });
  trimBuf.copyToChannel(new Float32Array(trimmed), 0);

  // Bitcrush: reduce bit depth
  const data = trimBuf.getChannelData(0);
  const levels = Math.pow(2, BIT_DEPTH);
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.round(data[i] * levels) / levels;
  }

  return audioBufferToBase64Wav(trimBuf);
}

function audioBufferToBase64Wav(buffer: AudioBuffer): string {
  const numChannels = 1;
  const sampleRate = buffer.sampleRate;
  const data = buffer.getChannelData(0);
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = data.length * (bitsPerSample / 8);
  const headerSize = 44;

  const buf = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(buf);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < data.length; i++) {
    const s = Math.max(-1, Math.min(1, data[i]));
    view.setInt16(headerSize + i * 2, s * 0x7fff, true);
  }

  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return "data:audio/wav;base64," + btoa(binary);
}

export function useAudioRecorder(onAutoStop?: (result: string) => void) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onAutoStopRef = useRef(onAutoStop);
  onAutoStopRef.current = onAutoStop;

  const processChunks = useCallback(async (recorder: MediaRecorder): Promise<string> => {
    setRecording(false);
    setProcessing(true);
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    recorder.stream.getTracks().forEach((t) => t.stop());
    try {
      const result = await bitcrush(blob);
      setProcessing(false);
      return result;
    } catch {
      setProcessing(false);
      return "";
    }
  }, []);

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.start();
    recorderRef.current = recorder;
    setRecording(true);

    timerRef.current = setTimeout(() => {
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.onstop = async () => {
          const result = await processChunks(recorderRef.current!);
          if (result && onAutoStopRef.current) onAutoStopRef.current(result);
        };
        recorderRef.current.stop();
      }
    }, MAX_DURATION);
  }, [processChunks]);

  const stop = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      const recorder = recorderRef.current;
      if (!recorder || recorder.state !== "recording") {
        setRecording(false);
        resolve("");
        return;
      }
      recorder.onstop = async () => {
        const result = await processChunks(recorder);
        resolve(result);
      };
      recorder.stop();
    });
  }, [processChunks]);

  return { recording, processing, start, stop };
}

export function playAudio(dataUrl: string): void {
  const audio = new Audio(dataUrl);
  audio.play().catch(() => {});
}

export async function getWaveform(dataUrl: string): Promise<Float32Array> {
  const resp = await fetch(dataUrl);
  const buf = await resp.arrayBuffer();
  const ctx = new OfflineAudioContext(1, 1, CRUSHED_RATE);
  const decoded = await ctx.decodeAudioData(buf);
  return decoded.getChannelData(0);
}

export function getDurationMs(dataUrl: string): Promise<number> {
  return getWaveform(dataUrl).then(
    (data) => (data.length / CRUSHED_RATE) * 1000
  );
}

export function cropDataUrl(
  dataUrl: string,
  startMs: number,
  lengthMs?: number,
): Promise<string> {
  return getWaveform(dataUrl).then((data) => {
    const startSample = Math.floor((startMs / 1000) * CRUSHED_RATE);
    const dur = Math.min(lengthMs ?? MAX_BLIP_MS, MAX_BLIP_MS);
    const maxSamples = Math.floor((dur / 1000) * CRUSHED_RATE);
    const cropped = data.slice(startSample, startSample + maxSamples);
    const buf = new AudioBuffer({
      length: cropped.length,
      sampleRate: CRUSHED_RATE,
      numberOfChannels: 1,
    });
    buf.copyToChannel(new Float32Array(cropped), 0);
    return audioBufferToBase64Wav(buf);
  });
}

export { MAX_BLIP_MS };
