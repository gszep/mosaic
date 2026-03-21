const BASE = import.meta.env.BASE_URL as string;

let currentAudio: HTMLAudioElement | null = null;
let currentTrack: string | null = null;

export function playMusic(track: string): void {
  if (track === currentTrack) return;
  stopMusic();
  currentTrack = track;
  currentAudio = new Audio(`${BASE}audio/${track}`);
  currentAudio.loop = true;
  currentAudio.volume = 0.3;
  currentAudio.play().catch(() => {});
}

export function stopMusic(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  currentTrack = null;
}
