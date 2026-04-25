import { Check } from "lucide-react";

/**
 * UI-layer view of a single objective's progress. Shape matches the
 * dive engine's `ObjectiveProgress` exactly — colocated here so the
 * component has a local contract, even though screens read directly
 * from `result.scene.objectiveQueue` and pass it through. Keep this
 * type in sync with `@/sim/factories/dive/objective.ObjectiveProgress`
 * when the engine-side shape changes.
 */
export interface ObjectiveRow {
  readonly objective: {
    readonly id: string;
    readonly label: string;
    readonly areaLabel: string;
    readonly target: number;
  };
  readonly current: number;
  readonly completed: boolean;
}

interface ObjectivePanelProps {
  /** Live objective queue from the dive scene — read-only. The engine
   * advances `current` / `completed` each frame; this component renders
   * the result with progress bars. */
  queue: readonly ObjectiveRow[];
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
        className="text-xs italic text-fg-muted"
        style={{ fontFamily: "var(--font-body)", fontWeight: 300 }}
      >
        No objectives for this dive.
      </div>
    );
  }
  return (
    <ol
      data-testid="objective-panel"
      className="flex flex-col gap-3 text-sm text-fg"
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
                ? "py-1 opacity-50"
                : isActive
                  ? "py-1"
                  : "py-1 opacity-70"
            }
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span
                  className="bs-label text-[0.58rem] text-fg-muted"
                  style={{ filter: "url(#bs-soft-glow)" }}
                >
                  {objective.areaLabel}
                </span>
                <span
                  className="leading-tight text-fg"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontWeight: 400,
                    fontSize: "0.95rem",
                  }}
                >
                  {objective.label}
                </span>
              </div>
              {completed && (
                <Check
                  className="size-4 shrink-0 text-glow"
                  aria-hidden="true"
                  style={{ filter: "url(#bs-soft-glow)" }}
                />
              )}
            </div>
            <div className="mt-2 flex items-center gap-2">
              {/* Progress: a thin glowing thread, no track box. */}
              <div className="relative h-px flex-1 bg-fg-muted/15">
                <div
                  className={
                    completed
                      ? "h-px bg-glow/70"
                      : isActive
                        ? "h-px bg-glow"
                        : "h-px bg-glow/40"
                  }
                  style={{
                    width: `${ratio * 100}%`,
                    transition: "width 240ms ease-out",
                    boxShadow: isActive
                      ? "0 0 6px rgba(107,230,193,0.6)"
                      : undefined,
                  }}
                />
              </div>
              <span
                className="bs-numeral shrink-0 text-[0.7rem] text-fg-muted"
              >
                {Math.floor(current)}/{objective.target}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
