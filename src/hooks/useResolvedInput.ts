import { useEffect, useRef } from "react";
import type { PlayerInputProvider, PlayerSubObservation } from "@/sim/ai";
import type { InputPosition } from "./useTouchInput";
import { useTouchInput } from "./useTouchInput";

/**
 * Test seam over the human pointer input.
 *
 * Production passes only `containerRef` and gets the same touch input
 * the game has always used. Browser-mode tests pass an
 * `externalProvider` (typically a `GoapInputProvider`) plus a live
 * observation source via `getObservation`; the hook ticks the
 * provider and writes the result into the same `InputPosition`-shaped
 * ref the dive loop already reads.
 *
 * The returned object identity is stable so downstream `useCallback`
 * deps don't churn — its x/y/isActive fields mutate in place.
 */
export function useResolvedInput(
  containerRef: React.RefObject<HTMLElement | null>,
  externalProvider?: PlayerInputProvider,
  getObservation?: () => PlayerSubObservation,
): InputPosition {
  const touchInput = useTouchInput(containerRef);
  const synthRef = useRef<InputPosition>({ x: 0, y: 0, isActive: false });
  // Drive the synthetic input from a RAF loop when an external provider
  // is wired up. The dive loop reads `synthRef.current` every frame and
  // ignores `touchInput` while a provider is active.
  useEffect(() => {
    if (!externalProvider || !getObservation) return undefined;
    let frameId = 0;
    const tick = () => {
      try {
        const obs = getObservation();
        const result = externalProvider.next(obs);
        synthRef.current.x = result.x;
        synthRef.current.y = result.y;
        synthRef.current.isActive = result.isActive;
      } catch (err) {
        // Don't crash the loop on a bot bug — log and freeze idle.
        // eslint-disable-next-line no-console
        console.warn("[useResolvedInput] provider error:", err);
        synthRef.current.isActive = false;
      }
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [externalProvider, getObservation]);

  return externalProvider ? synthRef.current : touchInput;
}
