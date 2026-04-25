import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useDeviceClass } from "@/hooks/useDeviceClass";
import { setRuntimePaused } from "@/lib/runtimePause";

interface HudShellProps {
  /** The full HUD — rendered inline on tablet/desktop, into the slide-out
   * panel on phone-portrait / phone-landscape. */
  fullHud: ReactNode;
  /** Compact always-visible primary HUD: oxygen + score + chain. Only
   * surfaces when the device class is compact. */
  compactPrimary: ReactNode;
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
export function HudShell({ fullHud, compactPrimary, threatAlert }: HudShellProps) {
  const { isCompact, klass } = useDeviceClass();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setRuntimePaused(true);
      return () => setRuntimePaused(false);
    }
    return undefined;
  }, [open]);

  // ESC closes the panel.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!isCompact) {
    // Tablet, desktop, foldable unfolded — render the full HUD inline.
    return <>{fullHud}</>;
  }

  // Phone — compact primary + hamburger button.
  return (
    <>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between px-3 pt-3"
        style={{
          paddingTop: "max(env(safe-area-inset-top), 0.5rem)",
          paddingLeft: "max(env(safe-area-inset-left), 0.5rem)",
          paddingRight: "max(env(safe-area-inset-right), 0.5rem)",
        }}
      >
        {/* Compact primary cluster on the left — pointer events on so
         * the SFX toggle inside it stays tappable. */}
        <div className="pointer-events-auto">{compactPrimary}</div>

        {/* Hamburger — opens the full-HUD panel. Threat-alert ring
         * pulses when something dangerous is closing in. */}
        <button
          type="button"
          aria-label="Open dive details"
          aria-expanded={open}
          data-testid="hud-menu-button"
          onClick={() => setOpen(true)}
          className={[
            "pointer-events-auto flex size-11 items-center justify-center rounded-full border bg-abyss/85 text-fg shadow-[0_4px_18px_rgba(5,10,20,0.45)] backdrop-blur-md transition-colors",
            threatAlert
              ? "border-warn animate-pulse text-warn"
              : "border-glow/30 hover:border-glow/60 hover:text-glow",
          ].join(" ")}
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
              key="hud-panel"
              role="dialog"
              aria-modal="true"
              aria-label="Dive details"
              data-testid="hud-menu-panel"
              className={
                klass === "phone-landscape"
                  ? "absolute bottom-0 right-0 top-0 z-50 flex w-[min(20rem,80vw)] flex-col gap-3 overflow-y-auto border-l border-deep/60 bg-abyss/95 p-4 shadow-[-12px_0_32px_rgba(5,10,20,0.6)]"
                  : "absolute inset-x-0 top-0 z-50 flex max-h-[85vh] flex-col gap-3 overflow-y-auto border-b border-deep/60 bg-abyss/95 p-4 shadow-[0_12px_32px_rgba(5,10,20,0.6)]"
              }
              style={{
                paddingTop: "max(env(safe-area-inset-top), 1rem)",
                paddingBottom: "max(env(safe-area-inset-bottom), 1rem)",
              }}
              initial={
                klass === "phone-landscape"
                  ? { x: "100%", opacity: 0 }
                  : { y: "-100%", opacity: 0 }
              }
              animate={{ x: 0, y: 0, opacity: 1 }}
              exit={
                klass === "phone-landscape"
                  ? { x: "100%", opacity: 0 }
                  : { y: "-100%", opacity: 0 }
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

              {/* The full HUD lives inside the panel on compact viewports. */}
              <div className="contents">{fullHud}</div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
