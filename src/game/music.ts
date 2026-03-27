const BASE = import.meta.env.BASE_URL as string;

let currentAudio: HTMLAudioElement | null = null;
let currentPlaylist: string[] | null = null;
let playlistIndex = 0;
let unlocked = false;

/** Call inside a user-gesture handler to unlock audio on mobile */
export function unlockAudio(): void {
  if (unlocked) return;
  const silent = new Audio();
  silent.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
  silent.play().then(() => { silent.pause(); unlocked = true; }).catch(() => {});
}

function playTrack(track: string): void {
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  currentAudio = new Audio(`${BASE}audio/${track}`);
  currentAudio.loop = false;
  currentAudio.volume = 0.3;
  currentAudio.addEventListener("ended", onTrackEnded);
  currentAudio.play().catch(() => {});
}

function onTrackEnded(): void {
  if (!currentPlaylist) return;
  playlistIndex = (playlistIndex + 1) % currentPlaylist.length;
  playTrack(currentPlaylist[playlistIndex]);
}

export function playMusic(track: string | string[]): void {
  const tracks = Array.isArray(track) ? track : [track];
  // Check if same playlist is already playing
  if (currentPlaylist && JSON.stringify(currentPlaylist) === JSON.stringify(tracks)) return;
  stopMusic();
  currentPlaylist = tracks;
  playlistIndex = 0;
  playTrack(tracks[0]);
}

export function fadeOutMusic(durationMs = 3000): void {
  if (!currentAudio) return;
  const audio = currentAudio;
  const startVol = audio.volume;
  const step = 50;
  const decrement = startVol / (durationMs / step);
  const interval = setInterval(() => {
    audio.volume = Math.max(0, audio.volume - decrement);
    if (audio.volume <= 0) {
      clearInterval(interval);
      stopMusic();
    }
  }, step);
}

export function stopMusic(): void {
  if (currentAudio) {
    currentAudio.removeEventListener("ended", onTrackEnded);
    currentAudio.pause();
    currentAudio = null;
  }
  currentPlaylist = null;
  playlistIndex = 0;
}
