/**
 * Haptics — Capacitor `@capacitor/haptics` wrapper with graceful
 * fallbacks for web and unsupported environments.
 *
 * Architecture
 * ------------
 * The game has *moments* that warrant a tactile cue, not raw events.
 * Each moment maps to one of the high-level helpers below; callers
 * never construct ImpactStyle / NotificationType themselves.
 *
 * Native: routes through Haptics.{impact,notification,vibrate} so iOS
 * uses Core Haptics taptics and Android uses VibratorManager. Web:
 * routes through the standard `navigator.vibrate` API which only
 * fires on touch-input mobile browsers (silently no-op on desktop).
 *
 * User control
 * ------------
 * Mirrors the audio mixer's mute pattern — a single boolean stored in
 * localStorage under `bs.haptics.muted` so users who find the buzz
 * intrusive can disable it. Defaults to *enabled* because a phone
 * player has explicit physical engagement and benefits from the
 * extra channel.
 *
 * Throttling
 * ----------
 * In a 16 ms frame multiple events can co-fire (collect during
 * impact during pickup). Native haptics gracefully serialize. Web
 * vibrate clobbers — the most recent call wins. We coalesce per
 * frame: the "loudest" requested intensity for the frame is what
 * actually fires. Higher intensities take precedence.
 */

import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { Capacitor } from "@capacitor/core";

const STORAGE_KEY = "bs.haptics.muted";
const isBrowser = typeof window !== "undefined";

let mutedState = readMutedFromStorage();
const muteListeners = new Set<(muted: boolean) => void>();

function readMutedFromStorage(): boolean {
  if (!isBrowser) return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeMutedToStorage(muted: boolean): void {
  if (!isBrowser) return;
  try {
    if (muted) window.localStorage.setItem(STORAGE_KEY, "1");
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Privacy mode or quota — silently swallow.
  }
}

export function isHapticsMuted(): boolean {
  return mutedState;
}

export function setHapticsMuted(muted: boolean): void {
  if (mutedState === muted) return;
  mutedState = muted;
  writeMutedToStorage(muted);
  for (const listener of muteListeners) listener(muted);
}

export function toggleHapticsMuted(): boolean {
  setHapticsMuted(!mutedState);
  return mutedState;
}

export function onHapticsMuteChange(listener: (muted: boolean) => void): () => void {
  muteListeners.add(listener);
  return () => muteListeners.delete(listener);
}

/**
 * Per-frame coalescer. Each call escalates the intensity for the
 * current frame; an `await Promise.resolve()` queue microtask drains
 * it, so only one Haptics call per frame escapes to the platform.
 *
 * The `intensity` ordering (low → medium → heavy) lets a heavy
 * impact from a predator collision override a coincident collect
 * tick. The `notification` channel is independent — it represents
 * a state change rather than a physical hit and never coalesces
 * with impact.
 */
type ImpactIntensity = "light" | "medium" | "heavy";
const INTENSITY_RANK: Record<ImpactIntensity, number> = {
  light: 1,
  medium: 2,
  heavy: 3,
};

let pendingImpact: ImpactIntensity | null = null;
let pendingNotification: NotificationType | null = null;
let drainScheduled = false;

const isNativeShell = () => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

async function drainPending(): Promise<void> {
  drainScheduled = false;
  const impact = pendingImpact;
  const notif = pendingNotification;
  pendingImpact = null;
  pendingNotification = null;

  if (mutedState) return;

  // Native: route through Capacitor Haptics. iOS uses Core Haptics
  // (CHHapticEngine) for impact + notification taptics; Android
  // uses VibratorManager (API 31+) or Vibrator fallback.
  if (isNativeShell()) {
    try {
      if (impact) {
        const style =
          impact === "heavy"
            ? ImpactStyle.Heavy
            : impact === "medium"
              ? ImpactStyle.Medium
              : ImpactStyle.Light;
        await Haptics.impact({ style });
      }
      if (notif) {
        await Haptics.notification({ type: notif });
      }
    } catch {
      // Hardware refusal or permission denied — silent.
    }
    return;
  }

  // Web fallback. `navigator.vibrate` is well-supported on Android
  // Chrome; iOS Safari does not implement it (no-op). Pattern lengths
  // are tuned to feel close to Capacitor's native impact intensities
  // when the browser does support them.
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    try {
      if (impact === "heavy") {
        navigator.vibrate(28);
      } else if (impact === "medium") {
        navigator.vibrate(14);
      } else if (impact === "light") {
        navigator.vibrate(7);
      } else if (notif === NotificationType.Warning) {
        navigator.vibrate([10, 40, 10]);
      } else if (notif === NotificationType.Success) {
        navigator.vibrate([8, 20, 8]);
      } else if (notif === NotificationType.Error) {
        navigator.vibrate([24, 18, 24]);
      }
    } catch {
      // Permission denied or hardware refusal.
    }
  }
}

function queueImpact(intensity: ImpactIntensity): void {
  if (!pendingImpact || INTENSITY_RANK[intensity] > INTENSITY_RANK[pendingImpact]) {
    pendingImpact = intensity;
  }
  scheduleDrain();
}

function queueNotification(type: NotificationType): void {
  pendingNotification = type;
  scheduleDrain();
}

function scheduleDrain(): void {
  if (drainScheduled) return;
  drainScheduled = true;
  // Microtask flush — runs at end of current event loop tick. Faster
  // than rAF and decouples from render cadence; avoids waiting a
  // full frame to feel a hit.
  void Promise.resolve().then(drainPending);
}

// ---------- High-level moment-named API ----------

/** Player's hull collides with predator/pirate. Heavy impact. */
export function hapticImpact(): void {
  queueImpact("heavy");
}

/** Successful collection of a scoring beacon. Light tick. */
export function hapticCollect(): void {
  queueImpact("light");
}

/** Anomaly buff picked up. Medium tap so it differentiates from collect. */
export function hapticPickup(): void {
  queueImpact("medium");
}

/** Adrenaline auto-engages — the "moment of truth" save. Notification success
 *  sells it as a positive system event rather than a hit. */
export function hapticAdrenaline(): void {
  queueNotification(NotificationType.Success);
}

/** Predator killed by lamp. Medium impact — satisfying but not jarring. */
export function hapticPredatorKill(): void {
  queueImpact("medium");
}

/** Oxygen below critical threshold — periodic warning. Light tick at the
 *  same cadence as the audio heartbeat so the two cues co-fire. */
export function hapticOxygenTick(): void {
  queueImpact("light");
}

/** Game over (oxygen depleted or collision-fatal). Notification error so
 *  the platform can render its alarm taptic pattern. */
export function hapticGameOver(): void {
  queueNotification(NotificationType.Error);
}
