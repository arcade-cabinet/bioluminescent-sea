import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface StatTileProps {
  label: string;
  value: ReactNode;
  /** When true, paints the value in the bioluminescent mint accent. */
  accent?: boolean;
  /** When true and `value` is a finite number, the displayed numeral
   *  counts up from 0 over ~0.9s with an easeOut curve. Used by the
   *  GameOverScreen so post-dive stats arrive with a satisfying tick
   *  rather than slamming on screen. */
  countUp?: boolean;
  /** When true, renders a small "NEW BEST" badge above the value
   *  with a creamy-yellow glow. Used by the post-dive screen to
   *  celebrate categories where the player's lifetime peak just
   *  improved. */
  newBest?: boolean;
  className?: string;
}

const COUNT_UP_DURATION_MS = 900;

function useCountUp(target: number, enabled: boolean): number {
  const [display, setDisplay] = useState(enabled ? 0 : target);
  const startedAtRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || !Number.isFinite(target)) {
      setDisplay(target);
      return;
    }
    startedAtRef.current = null;
    const startValue = 0;
    const tick = (now: number) => {
      if (startedAtRef.current === null) startedAtRef.current = now;
      const elapsed = now - startedAtRef.current;
      const t = Math.min(1, elapsed / COUNT_UP_DURATION_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(startValue + (target - startValue) * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, enabled]);

  return display;
}

/**
 * Stat readout — small-caps label + tabular-numeral value, both
 * floating in the water with a soft glow. No border, no panel bg;
 * the brand identity says HUD/summary readouts read as "ink on a
 * chart," not "values in cells."
 */
export function StatTile({ label, value, accent, countUp, newBest, className }: StatTileProps) {
  const numericTarget = typeof value === "number" && Number.isFinite(value) ? value : Number.NaN;
  const isNumeric = !Number.isNaN(numericTarget);
  const counted = useCountUp(isNumeric ? numericTarget : 0, !!countUp && isNumeric);
  const renderedValue = countUp && isNumeric ? counted : value;
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-1 px-3 py-2 text-left",
        className,
      )}
    >
      {newBest && (
        <span
          data-testid="stat-tile-new-best"
          className="bs-label text-[0.55rem] font-semibold tracking-[0.18em]"
          style={{
            color: "#fef9c3",
            filter: "url(#bs-warm-glow)",
            textShadow:
              "0 0 10px rgba(254,249,195,0.7), 0 0 22px rgba(253,230,138,0.35)",
          }}
        >
          NEW BEST
        </span>
      )}
      <span
        className="bs-label text-[0.6rem] text-fg-muted"
        style={{ filter: "url(#bs-soft-glow)" }}
      >
        {label}
      </span>
      <span
        className={cn(
          "bs-numeral text-2xl font-medium",
          accent ? "text-glow" : "text-fg",
        )}
        style={{
          filter: newBest
            ? "url(#bs-warm-glow)"
            : accent
              ? "url(#bs-soft-glow)"
              : undefined,
          textShadow: newBest
            ? "0 0 16px rgba(254,249,195,0.55), 0 0 32px rgba(253,230,138,0.28)"
            : accent
              ? "0 0 14px rgba(107,230,193,0.45), 0 0 28px rgba(107,230,193,0.18)"
              : "0 0 10px rgba(2,6,17,0.85), 0 1px 0 rgba(2,6,17,0.5)",
          color: newBest ? "#fef9c3" : undefined,
        }}
      >
        {renderedValue}
      </span>
    </div>
  );
}
