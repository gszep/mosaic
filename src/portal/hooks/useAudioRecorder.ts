import { useState, useRef, useCallback } from "react";
import { encodeWav, decodeAudio, SAMPLE_RATE } from "../../shared/audio";

const MAX_DURATION = 2000;
const CRUSHED_RATE = SAMPLE_RATE;
const BIT_DEPTH = 4;
export const MAX_BLIP_MS = 350;

function trimSilence(data: Float32Array, sampleRate: number): Float32Array {
  const windowSize = Math.floor(sampleRate * 0.01);
  const threshold = 0.02;
  const pad = Math.floor(sampleRate * 0.05);

  let start = 0;
  let end = data.length;

  for (let i = 0; i < data.length - windowSize; i += windowSize) {
    let sum = 0;
    for (let j = 0; j < windowSize; j++) sum += data[i + j] * data[i + j];
    if (Math.sqrt(sum / windowSize) > threshold) {
      start = Math.max(0, i - pad);
      break;
    }
  }

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

  const trimmed = trimSilence(rendered.getChannelData(0), rendered.sampleRate);
  if (trimmed.length === 0) return "";

  const levels = Math.pow(2, BIT_DEPTH);
  for (let i = 0; i < trimmed.length; i++) {
    trimmed[i] = Math.round(trimmed[i] * levels) / levels;
  }

  const buf = new AudioBuffer({ length: trimmed.length, sampleRate: rendered.sampleRate, numberOfChannels: 1 });
  buf.copyToChannel(new Float32Array(trimmed), 0);
  return encodeWav(buf.getChannelData(0), rendered.sampleRate);
}

export { decodeAudio as getWaveform };

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
