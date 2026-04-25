import { Check } from "lucide-react";
import type { ObjectiveProgress } from "@/sim/factories/dive";

interface ObjectivePanelProps {
  /** Live objective queue from the dive scene — read-only. The engine
   * advances `current` / `completed` each frame; this component renders
   * the result with progress bars. */
  queue: readonly ObjectiveProgress[];
}

/**
 * Objective progression list. Shown inside the HudShell slide-out panel
 * so the player can see their current goal + queued objectives without
 * cluttering the dive viewport. Each row carries:
 *   - the objective's area context (where the goal lives),
 *   - a one-line label,
 *   - a progress bar with current/target.
 * Completed objectives render with a check mark and dimmed styling.
 */
export function ObjectivePanel({ queue }: ObjectivePanelProps) {
  if (queue.length === 0) {
    return (
      <div
        data-testid="objective-panel-empty"
        className="rounded-md border border-deep/50 bg-bg/50 p-3 text-xs text-fg-muted"
      >
        No objectives for this dive.
      </div>
    );
  }
  return (
    <ol
      data-testid="objective-panel"
      className="flex flex-col gap-2 text-sm text-fg"
    >
      {queue.map((entry, index) => {
        const { objective, current, completed } = entry;
        const isActive = !completed && queue.slice(0, index).every((e) => e.completed);
        const ratio = Math.max(0, Math.min(1, current / objective.target));
        return (
          <li
            key={objective.id}
            data-testid={`objective-row-${objective.id}`}
            data-active={isActive ? "true" : "false"}
            data-completed={completed ? "true" : "false"}
            className={
              completed
                ? "rounded-md border border-deep/30 bg-abyss/30 p-3 opacity-60"
                : isActive
                  ? "rounded-md border border-glow/40 bg-abyss/80 p-3"
                  : "rounded-md border border-deep/40 bg-abyss/50 p-3 opacity-80"
            }
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[0.6rem] uppercase tracking-[0.16em] text-fg-muted">
                  {objective.areaLabel}
                </span>
                <span className="font-body text-sm font-medium leading-tight text-fg">
                  {objective.label}
                </span>
              </div>
              {completed && (
                <Check className="size-4 shrink-0 text-glow" aria-hidden="true" />
              )}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-bg/60">
                <div
                  className={
                    completed ? "h-full bg-glow/60" : isActive ? "h-full bg-glow" : "h-full bg-glow/40"
                  }
                  style={{ width: `${ratio * 100}%`, transition: "width 240ms ease-out" }}
                />
              </div>
              <span className="shrink-0 font-body text-xs tabular-nums text-fg-muted">
                {Math.floor(current)}/{objective.target}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
