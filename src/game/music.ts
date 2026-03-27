const BASE = import.meta.env.BASE_URL as string;

let currentAudio: HTMLAudioElement | null = null;
let currentTrack: string | null = null;
let unlocked = false;

/** Call inside a user-gesture handler to unlock audio on mobile */
export function unlockAudio(): void {
  if (unlocked) return;
  // Create a silent buffer and play it to unlock the audio context
  const silent = new Audio();
  silent.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
  silent.play().then(() => { silent.pause(); unlocked = true; }).catch(() => {});
}

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
