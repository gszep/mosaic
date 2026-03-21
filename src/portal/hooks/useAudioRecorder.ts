import { useState, useRef, useCallback } from "react";

const MAX_DURATION = 3000; // ms
const CRUSHED_RATE = 8000; // low sample rate for retro feel
const BIT_DEPTH = 4; // bits for crushing

async function bitcrush(blob: Blob): Promise<string> {
  const arrayBuf = await blob.arrayBuffer();
  const audioCtx = new OfflineAudioContext(1, CRUSHED_RATE * 3, CRUSHED_RATE);
  const source = audioCtx.createBufferSource();
  const decoded = await audioCtx.decodeAudioData(arrayBuf);
  source.buffer = decoded;
  source.connect(audioCtx.destination);
  source.start();
  const rendered = await audioCtx.startRendering();

  // Bitcrush: reduce bit depth
  const data = rendered.getChannelData(0);
  const levels = Math.pow(2, BIT_DEPTH);
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.round(data[i] * levels) / levels;
  }

  // Encode to WAV base64
  return audioBufferToBase64Wav(rendered);
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

export function useAudioRecorder() {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        recorderRef.current.stop();
      }
    }, MAX_DURATION);
  }, []);

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
        setRecording(false);
        setProcessing(true);
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        recorder.stream.getTracks().forEach((t) => t.stop());
        try {
          const result = await bitcrush(blob);
          setProcessing(false);
          resolve(result);
        } catch {
          setProcessing(false);
          resolve("");
        }
      };
      recorder.stop();
    });
  }, []);

  return { recording, processing, start, stop };
}

export function playAudio(dataUrl: string): void {
  const audio = new Audio(dataUrl);
  audio.play().catch(() => {});
}
