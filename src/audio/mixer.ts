/**
 * Master audio mixer.
 *
 * Tracks a single `muted` flag used by both ambient and sfx subsystems.
 * Persists to localStorage so the choice sticks across dives. Also
 * honors `prefers-reduced-motion` — a user who has reduced motion set
 * at the OS level probably doesn't want the ambient synth either.
 */

const MUTE_KEY = "bioluminescent-sea:v1:audio-muted";

type MuteListener = (muted: boolean) => void;
const listeners = new Set<MuteListener>();

let mutedState: boolean | null = null;

function readPersistedMute(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

function writePersistedMute(muted: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    // ignore quota errors
  }
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function isMuted(): boolean {
  if (mutedState === null) {
    mutedState = readPersistedMute() || prefersReducedMotion();
  }
  return mutedState;
}

export function setMuted(muted: boolean): void {
  mutedState = muted;
  writePersistedMute(muted);
  for (const listener of listeners) listener(muted);
}

export function toggleMuted(): boolean {
  setMuted(!isMuted());
  return isMuted();
}

export function onMuteChange(listener: MuteListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
