/**
 * Runtime pause coordination. The UI shell writes
 * `documentElement.dataset.runtimePaused = "true"` when a modal/settings/
 * pause menu is on screen; the game loop reads this flag to freeze time.
 *
 * Kept independent of React state so the game loop can check it without
 * subscribing to a context.
 */

const PAUSE_EVENT = "bioluminescent-sea:pause-change";

export interface PauseChangeDetail {
  paused: boolean;
}

export function setRuntimePaused(paused: boolean): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.runtimePaused = String(paused);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<PauseChangeDetail>(PAUSE_EVENT, { detail: { paused } })
    );
  }
}

export function isRuntimePaused(): boolean {
  return (
    typeof document !== "undefined" &&
    document.documentElement.dataset.runtimePaused === "true"
  );
}

export function onRuntimePauseChange(
  handler: (detail: PauseChangeDetail) => void
): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (evt: Event) => {
    const detail = (evt as CustomEvent<PauseChangeDetail>).detail;
    handler(detail);
  };
  window.addEventListener(PAUSE_EVENT, listener);
  return () => window.removeEventListener(PAUSE_EVENT, listener);
}
