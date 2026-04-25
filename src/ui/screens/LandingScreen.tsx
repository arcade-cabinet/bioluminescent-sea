import { motion } from "framer-motion";
import { Compass, Crosshair, MoveDown } from "lucide-react";
import type { ComponentType } from "react";
import { useDeviceClass } from "@/hooks/useDeviceClass";
import {
  getModeMetadata,
  SESSION_MODES,
  type SessionMode,
  type SessionModeMetadata,
} from "@/sim";
import { Button, Card, CardCorners } from "@/ui/primitives";
import { LandingHero } from "@/ui/shell/LandingHero";

interface LandingScreenProps {
  /** Lux balance to surface in the Drydock chip on the landing. */
  currency: number;
  /** Called when the player picks a mode card — opens the seed picker. */
  onPickMode: (mode: SessionMode) => void;
  /** Opens the drydock screen. */
  onOpenDrydock: () => void;
}

const MODE_ICONS: Record<SessionMode, ComponentType<{ className?: string }>> = {
  exploration: Compass,
  descent: MoveDown,
  arena: Crosshair,
};

export function LandingScreen({ currency, onPickMode, onOpenDrydock }: LandingScreenProps) {
  const { klass, isPortrait } = useDeviceClass();
  const isPhoneLandscape = klass === "phone-landscape";
  const isPhonePortrait = klass === "phone-portrait";
  const isTabletPortrait = klass === "tablet" && isPortrait;
  // Compact layouts get the triptych pinned to viewport-bottom so the
  // three mode cards are always above the fold — the top half is the
  // hero + title. Desktop + tablet-landscape keep the natural flow.
  const pinTriptychToBottom = isPhonePortrait || isPhoneLandscape || isTabletPortrait;
  return (
    <motion.div
      data-testid="landing-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
      className={
        pinTriptychToBottom
          ? // Compact layouts: header + title flow top-down; triptych is
            // absolutely pinned to viewport-bottom by the section below.
            "absolute inset-0 flex flex-col items-stretch justify-start overflow-hidden bg-bg text-fg"
          : // Desktop + tablet-landscape: space header / title / triptych
            // evenly down the viewport so the title centers and the
            // triptych sits in the lower third.
            "absolute inset-0 flex flex-col items-stretch justify-between overflow-hidden bg-bg text-fg"
      }
    >
      <LandingHero />

      {/* Drydock chip — top right, shows Lux balance */}
      <header
        className="relative flex items-start justify-end px-6 pt-4"
        style={{ paddingTop: "max(env(safe-area-inset-top), 1rem)" }}
      >
        <button
          type="button"
          onClick={onOpenDrydock}
          data-testid="drydock-chip"
          className="pointer-events-auto group flex items-center gap-2 rounded-full border border-deep bg-abyss/70 px-3.5 py-1.5 font-body text-xs uppercase tracking-[0.14em] text-fg backdrop-blur-md transition-colors hover:border-glow/60 hover:text-glow"
        >
          <span className="text-glow" aria-hidden="true">◇</span>
          <span>Drydock</span>
          <span className="text-glow tabular-nums">{currency} Lux</span>
        </button>
      </header>

      {/* Title + tagline — tighter sizing across compact viewports so
       * the hero doesn't eat the fold. Tagline only renders when there's
       * room (desktop + tablet-landscape) and sits on a dark scrim so
       * the god-ray beams underneath can't bleach the body text. */}
      <div
        className={
          isPhoneLandscape
            ? "relative flex flex-col items-center justify-center px-4 pb-0 pt-1 text-center"
            : isPhonePortrait
              ? "relative flex flex-col items-center justify-start px-4 pb-2 pt-10 text-center"
              : "relative flex flex-col items-center justify-center px-6 pb-2 pt-4 text-center"
        }
      >
        <motion.h1
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.8 }}
          className="bs-display m-0 font-medium text-glow"
          style={{
            fontSize: isPhoneLandscape
              ? "1.5rem"
              : isPhonePortrait
                ? "clamp(2rem, 10vw, 2.75rem)"
                : "clamp(2.5rem, 9vw, 5rem)",
            textShadow:
              "0 0 24px rgba(107, 230, 193, 0.45), 0 0 48px rgba(107, 230, 193, 0.18)",
            letterSpacing: "0.01em",
          }}
        >
          Bioluminescent Sea
        </motion.h1>

        {!isPhoneLandscape && !isPhonePortrait && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.95 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="m-0 mt-3 max-w-[44ch] rounded-lg text-fg-muted"
            style={{
              fontSize: "clamp(0.95rem, 2.4vw, 1.05rem)",
              lineHeight: 1.55,
              padding: "0.5rem 1rem",
              background:
                "color-mix(in srgb, var(--color-bg) 68%, transparent)",
              backdropFilter: "blur(3px)",
              WebkitBackdropFilter: "blur(3px)",
            }}
          >
            Sink into an abyssal trench. Trace glowing routes past landmark
            creatures. Surface breathing easier than when you started.
          </motion.p>
        )}
      </div>

      {/* Mode triptych — every compact viewport pins it to the bottom so
       * the three mode cards are always above the fold. Desktop +
       * tablet-landscape get natural document flow. */}
      <motion.section
        initial={pinTriptychToBottom ? { opacity: 0 } : { opacity: 0, y: 16 }}
        animate={pinTriptychToBottom ? { opacity: 1 } : { opacity: 1, y: 0 }}
        transition={{ delay: 0.75, duration: 0.7 }}
        className={
          pinTriptychToBottom
            ? "absolute inset-x-0 bottom-3 z-10 mx-auto w-full max-w-5xl px-3"
            : "relative mx-auto w-full max-w-5xl px-6 pb-10"
        }
        aria-label="Choose dive mode"
        data-testid="mode-triptych"
      >
        {!pinTriptychToBottom && (
          <p className="mb-3 text-center text-[0.7rem] uppercase tracking-[0.18em] text-fg-muted">
            Choose your descent
          </p>
        )}
        <div
          className={
            pinTriptychToBottom
              ? "grid grid-cols-3 gap-2"
              : "grid grid-cols-1 gap-3 sm:grid-cols-3"
          }
        >
          {SESSION_MODES.map((mode, index) => (
            <ModeCard
              key={mode}
              meta={getModeMetadata(mode)}
              icon={MODE_ICONS[mode]}
              onSelect={() => onPickMode(mode)}
              animationDelay={0.8 + index * 0.08}
              compact={pinTriptychToBottom}
            />
          ))}
        </div>
      </motion.section>
    </motion.div>
  );
}

interface ModeCardProps {
  meta: SessionModeMetadata;
  icon: ComponentType<{ className?: string }>;
  onSelect: () => void;
  animationDelay: number;
  /** Compact card layout for phone-landscape — single-row label, no
   * tagline, smaller icon badge. Drops to ~56px tall so three cards fit
   * across a 390px-tall viewport without crowding the title. */
  compact?: boolean;
}

function ModeCard({ meta, icon: Icon, onSelect, animationDelay, compact }: ModeCardProps) {
  return (
    <motion.div
      initial={compact ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={compact ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={{ delay: animationDelay, duration: 0.55 }}
    >
      <Button
        asChild
        variant="ghost"
        size="lg"
        className="group h-auto w-full justify-start whitespace-normal p-0 text-left"
        data-testid={`mode-card-${meta.id}`}
      >
        <button
          type="button"
          onClick={onSelect}
          aria-label={`Begin ${meta.label} dive — ${meta.tagline}`}
        >
          <Card
            className={
              compact
                ? "group relative w-full overflow-hidden border-deep/70 bg-abyss/80 p-2 transition-all duration-300 group-hover:border-glow/50"
                : "group relative w-full overflow-hidden border-deep/70 bg-abyss/80 p-5 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:border-glow/50 group-hover:shadow-[0_0_32px_rgba(107,230,193,0.18)]"
            }
            style={{
              backgroundImage: `radial-gradient(circle at 0% 0%, ${meta.accentHex}14, transparent 60%)`,
            }}
          >
            <CardCorners color={meta.accentHex} />

            <div
              className={
                compact
                  ? "flex flex-col items-center gap-1.5"
                  : "flex items-start gap-3"
              }
            >
              <div
                className={
                  compact
                    ? "flex size-8 shrink-0 items-center justify-center rounded-full border bg-bg/40"
                    : "flex size-10 shrink-0 items-center justify-center rounded-md border bg-bg/40"
                }
                style={{
                  borderColor: `${meta.accentHex}55`,
                  color: meta.accentHex,
                }}
              >
                <Icon className={compact ? "size-4" : "size-5"} />
              </div>
              <div
                className={
                  compact
                    ? "flex flex-col items-center gap-0"
                    : "flex flex-col gap-0.5"
                }
              >
                {!compact && (
                  <span className="text-[0.65rem] uppercase tracking-[0.14em] text-fg-muted">
                    {meta.paceLabel}
                  </span>
                )}
                <h3
                  className={
                    compact
                      ? "bs-display m-0 text-xs font-medium uppercase tracking-[0.08em] leading-tight"
                      : "bs-display m-0 text-2xl font-medium leading-tight"
                  }
                  style={{ color: meta.accentHex }}
                >
                  {meta.label}
                </h3>
              </div>
            </div>

            {!compact && (
              <p className="mt-3 text-sm leading-relaxed text-fg-muted normal-case">
                {meta.tagline}
              </p>
            )}

            {!compact && (
              <div className="mt-4 flex items-center justify-between text-[0.7rem] uppercase tracking-[0.16em] text-fg/70 normal-case">
                <span className="text-fg-muted">Tap to chart</span>
                <span
                  aria-hidden="true"
                  className="transition-transform duration-300 group-hover:translate-x-0.5"
                  style={{ color: meta.accentHex }}
                >
                  →
                </span>
              </div>
            )}
          </Card>
        </button>
      </Button>
    </motion.div>
  );
}
