/**
 * CI-aware test timeout budgets. Local runs stay tight; CI doubles the
 * budget to absorb GitHub Actions' slower first-frame warm-up (headed
 * Chromium under xvfb + Pixi initialization + font load). Import this
 * into e2e specs rather than hard-coding literal timeouts so the knob
 * is in one place.
 */

function isCI(): boolean {
  return Boolean(
    (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
      ?.env?.CI,
  );
}

/** Scale a local-run budget to the CI equivalent. */
export function budget(localMs: number, ciMultiplier = 2): number {
  return isCI() ? Math.max(localMs, localMs * ciMultiplier) : localMs;
}

/** Canonical "canvas has mounted" budget — used by every dive-start
 * spec. Tight locally, forgiving on CI. */
export const CANVAS_MOUNT_BUDGET_MS = budget(2000);

/** Canonical "landing → playing transition" budget. */
export const TRANSITION_BUDGET_MS = budget(2500);

/** Canonical "UI element toggles" budget (panel open, menu close). */
export const UI_TOGGLE_BUDGET_MS = budget(2000);
