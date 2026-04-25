import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface StatTileProps {
  label: string;
  value: ReactNode;
  /** When true, paints the value in the bioluminescent mint accent. */
  accent?: boolean;
  className?: string;
}

/**
 * Stat readout — small-caps label + tabular-numeral value, both
 * floating in the water with a soft glow. No border, no panel bg;
 * the brand identity says HUD/summary readouts read as "ink on a
 * chart," not "values in cells."
 */
export function StatTile({ label, value, accent, className }: StatTileProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-1 px-3 py-2 text-left",
        className,
      )}
    >
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
          filter: accent ? "url(#bs-soft-glow)" : undefined,
          textShadow: accent
            ? "0 0 14px rgba(107,230,193,0.45), 0 0 28px rgba(107,230,193,0.18)"
            : "0 0 10px rgba(2,6,17,0.85), 0 1px 0 rgba(2,6,17,0.5)",
        }}
      >
        {value}
      </span>
    </div>
  );
}
