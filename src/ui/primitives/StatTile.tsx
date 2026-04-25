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
 * Compact label-over-value tile used by the dive summary screens. Pure layout —
 * the GameOverScreen renders these in a grid.
 */
export function StatTile({ label, value, accent, className }: StatTileProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-1 rounded-md border border-deep/70 bg-abyss/60 px-4 py-3 text-left",
        className,
      )}
    >
      <span className="text-[0.65rem] uppercase tracking-[0.14em] text-fg-muted">
        {label}
      </span>
      <span
        className={cn(
          "text-xl font-medium tabular-nums",
          accent ? "text-glow" : "text-fg",
        )}
      >
        {value}
      </span>
    </div>
  );
}
