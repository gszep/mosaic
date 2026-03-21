const SAMPLE_RATE = 8000;

export function encodeWav(samples: Float32Array, sampleRate = SAMPLE_RATE): string {
  const dataSize = samples.length * 2;
  const buf = new ArrayBuffer(44 + dataSize);
  const v = new DataView(buf);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); v.setUint32(4, 36 + dataSize, true); w(8, "WAVE"); w(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, dataSize, true);
  for (let i = 0; i < samples.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i])) * 0x7fff, true);
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return "data:audio/wav;base64," + btoa(bin);
}

export async function decodeAudio(dataUrl: string): Promise<Float32Array> {
  const resp = await fetch(dataUrl);
  const buf = await resp.arrayBuffer();
  const ctx = new OfflineAudioContext(1, 1, SAMPLE_RATE);
  const decoded = await ctx.decodeAudioData(buf);
  return decoded.getChannelData(0);
}

export function cropSamples(data: Float32Array, startMs: number, endMs: number, sampleRate = SAMPLE_RATE): Float32Array {
  const s = Math.floor((startMs / 1000) * sampleRate);
  const e = Math.floor((endMs / 1000) * sampleRate);
  return data.slice(s, e);
}

export { SAMPLE_RATE };
