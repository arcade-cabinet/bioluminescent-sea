import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useDeviceClass } from "@/hooks/useDeviceClass";
import { setRuntimePaused } from "@/lib/runtimePause";

interface HudShellProps {
  /** The full HUD — rendered inline on tablet/desktop, into the slide-out
   * panel on phone-portrait / phone-landscape. */
  fullHud: ReactNode;
  /** Compact always-visible primary HUD: oxygen + score + chain. Only
   * surfaces when the device class is compact. */
  compactPrimary: ReactNode;
  /** Objective progression list. Always shown inside the slide-out
   * panel regardless of device class — tablet/desktop players open
   * the hamburger to see quest progress too. */
  objectivePanel: ReactNode;
  /** Threat-alert pulse — surfaced even on compact HUD because it's a
   * critical immediate signal. */
  threatAlert?: boolean;
}

/**
 * Adaptive HUD shell. On tablet/desktop the full HUD renders inline as
 * before (no behaviour change). On phone-portrait / phone-landscape the
 * full HUD collapses behind a hamburger button at the top-right; tapping
 * opens a slide-out panel that **pauses the game** via setRuntimePaused.
 * Closing the panel resumes.
 *
 * The compact primary cluster (oxygen + score + chain) stays always
 * visible inline so the player keeps the most critical telemetry at a
 * glance. Everything else (codename, biome chip, landmark, depth,
 * charted%) is one tap away.
 */
export function HudShell({
  fullHud,
  compactPrimary,
  objectivePanel,
  threatAlert,
}: HudShellProps) {
  const { isCompact, klass } = useDeviceClass();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      setRuntimePaused(true);
      return () => setRuntimePaused(false);
    }
    return undefined;
  }, [open]);

  // Focus management: move focus into the panel on open, restore focus
  // to the trigger on close. Combined with the keydown handler below
  // this gives the modal dialog real keyboard support — screen reader
  // users land inside the panel and tab never leaks to the gameplay
  // behind.
  useEffect(() => {
    if (!open) return undefined;
    const panel = panelRef.current;
    if (panel) {
      const focusable = panel.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      focusable?.focus();
    }
    return () => {
      triggerRef.current?.focus();
    };
  }, [open]);

  // ESC closes the panel; Tab traps focus inside the panel while open.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute("disabled"));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Tablet/desktop: inline HUD + a hamburger button anchored top-right
  // that opens the slide-out for objectives (the HUD itself is already
  // visible so the panel only carries the objective list).
  // Phone: compact primary + hamburger; the panel carries HUD + objectives.
  return (
    <>
      {!isCompact && fullHud}

      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between px-3 pt-3"
        style={{
          paddingTop: "max(env(safe-area-inset-top), 0.5rem)",
          paddingLeft: "max(env(safe-area-inset-left), 0.5rem)",
          paddingRight: "max(env(safe-area-inset-right), 0.5rem)",
        }}
      >
        {isCompact ? (
          <div className="pointer-events-auto">{compactPrimary}</div>
        ) : (
          <div />
        )}

        <button
          ref={triggerRef}
          type="button"
          aria-label="Open dive details"
          aria-expanded={open}
          data-testid="hud-menu-button"
          onClick={() => setOpen(true)}
          className={[
            "pointer-events-auto flex size-11 items-center justify-center rounded-full border bg-abyss/85 text-fg backdrop-blur-md transition-colors",
            threatAlert
              ? "border-warn animate-pulse text-warn"
              : "border-glow/30 hover:border-glow/60 hover:text-glow",
          ].join(" ")}
          style={{ boxShadow: "var(--shadow-hud)" }}
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <>
            {/* Scrim — taps close the panel. */}
            <motion.button
              key="hud-scrim"
              type="button"
              aria-label="Close dive details"
              data-testid="hud-menu-scrim"
              onClick={() => setOpen(false)}
              className="absolute inset-0 z-40 cursor-pointer bg-bg/60 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            />

            {/* Slide-out panel. Phone-landscape slides in from the right,
             * phone-portrait drops from the top — both maximize legibility
             * while keeping the playfield orientation hint visible. */}
            <motion.aside
              ref={panelRef}
              key="hud-panel"
              role="dialog"
              aria-modal="true"
              aria-label="Dive details"
              data-testid="hud-menu-panel"
              className={
                klass === "phone-landscape"
                  ? "absolute bottom-0 right-0 top-0 z-50 flex w-[min(20rem,80vw)] flex-col gap-3 overflow-y-auto border-l border-deep/60 bg-abyss/95 p-4"
                  : klass === "phone-portrait"
                    ? "absolute inset-x-0 top-0 z-50 flex max-h-[85vh] flex-col gap-3 overflow-y-auto border-b border-deep/60 bg-abyss/95 p-4"
                    // Tablet / desktop: fixed-width right-side drawer.
                    : "absolute bottom-0 right-0 top-0 z-50 flex w-[min(26rem,60vw)] flex-col gap-4 overflow-y-auto border-l border-deep/60 bg-abyss/95 p-5"
              }
              style={{
                paddingTop: "max(env(safe-area-inset-top), 1rem)",
                paddingBottom: "max(env(safe-area-inset-bottom), 1rem)",
                boxShadow:
                  klass === "phone-portrait"
                    ? "var(--shadow-hud-panel)"
                    : "var(--shadow-hud-panel-side)",
              }}
              initial={
                klass === "phone-portrait"
                  ? { y: "-100%", opacity: 0 }
                  : { x: "100%", opacity: 0 }
              }
              animate={{ x: 0, y: 0, opacity: 1 }}
              exit={
                klass === "phone-portrait"
                  ? { y: "-100%", opacity: 0 }
                  : { x: "100%", opacity: 0 }
              }
              transition={{ type: "spring", damping: 28, stiffness: 240 }}
            >
              <header className="flex items-center justify-between">
                <span className="font-body text-xs uppercase tracking-[0.18em] text-fg-muted">
                  Dive Details · Paused
                </span>
                <button
                  type="button"
                  aria-label="Close dive details"
                  data-testid="hud-menu-close"
                  onClick={() => setOpen(false)}
                  className="flex size-9 items-center justify-center rounded-full border border-deep/60 bg-bg/60 text-fg-muted hover:border-glow/50 hover:text-glow"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </header>

              {/* Objective progression — always shown, tablet/desktop
               * included, because the hamburger is the canonical place
               * to check quest progress. */}
              <div className="flex flex-col gap-2">
                <h3 className="m-0 font-body text-xs uppercase tracking-[0.18em] text-fg-muted">
                  Objectives
                </h3>
                {objectivePanel}
              </div>

              {/* On compact viewports the full HUD also lives inside
               * the panel (on tablet/desktop it's already inline so no
               * need to duplicate). */}
              {isCompact && (
                <div className="flex flex-col gap-2">
                  <h3 className="m-0 font-body text-xs uppercase tracking-[0.18em] text-fg-muted">
                    Dive Details
                  </h3>
                  <div className="contents">{fullHud}</div>
                </div>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
