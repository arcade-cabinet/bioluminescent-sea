/**
 * Capacitor platform bridges.
 *
 * - orientation: portrait lock + rotation event handling
 * - safeArea: iOS notch + Android navbar insets as CSS vars
 * - persistence: localStorage-backed save slot for best score + last
 *   completed codename; a thin wrapper so the UI layer doesn't
 *   sprinkle localStorage calls across components
 * - haptics: Capacitor Haptics + web vibrate fallback, mute-aware,
 *   per-frame coalesced
 */
export {
  hapticImpact,
  hapticCollect,
  hapticPickup,
  hapticAdrenaline,
  hapticPredatorKill,
  hapticOxygenTick,
  hapticGameOver,
  isHapticsMuted,
  setHapticsMuted,
  toggleHapticsMuted,
  onHapticsMuteChange,
} from "./haptics";
