import { motion } from "framer-motion";
import { Compass, Crosshair, MoveDown } from "lucide-react";
import type { ComponentType } from "react";
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
  return (
    <motion.div
      data-testid="landing-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
      className="absolute inset-0 flex flex-col items-stretch justify-between overflow-hidden bg-bg text-fg"
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

      {/* Title + tagline */}
      <div className="relative flex flex-col items-center justify-center px-6 pb-2 pt-4 text-center">
        <motion.h1
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.8 }}
          className="bs-display m-0 font-medium text-glow"
          style={{
            fontSize: "clamp(2.5rem, 9vw, 5rem)",
            textShadow:
              "0 0 24px rgba(107, 230, 193, 0.45), 0 0 48px rgba(107, 230, 193, 0.18)",
            letterSpacing: "0.01em",
          }}
        >
          Bioluminescent Sea
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.88 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="m-0 mt-3 max-w-[44ch] text-fg-muted"
          style={{
            fontSize: "clamp(0.95rem, 2.4vw, 1.05rem)",
            lineHeight: 1.55,
          }}
        >
          Sink into an abyssal trench. Trace glowing routes past landmark
          creatures. Surface breathing easier than when you started.
        </motion.p>
      </div>

      {/* Mode triptych */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.75, duration: 0.7 }}
        className="relative mx-auto w-full max-w-5xl px-6 pb-10"
        aria-label="Choose dive mode"
        data-testid="mode-triptych"
      >
        <p className="mb-3 text-center text-[0.7rem] uppercase tracking-[0.18em] text-fg-muted">
          Choose your descent
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {SESSION_MODES.map((mode, index) => (
            <ModeCard
              key={mode}
              meta={getModeMetadata(mode)}
              icon={MODE_ICONS[mode]}
              onSelect={() => onPickMode(mode)}
              animationDelay={0.8 + index * 0.08}
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
}

function ModeCard({ meta, icon: Icon, onSelect, animationDelay }: ModeCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
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
            className="group relative w-full overflow-hidden border-deep/70 bg-abyss/80 p-5 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:border-glow/50 group-hover:shadow-[0_0_32px_rgba(107,230,193,0.18)]"
            style={{
              // Subtle accent-tinted radial wash that intensifies on hover.
              backgroundImage: `radial-gradient(circle at 0% 0%, ${meta.accentHex}14, transparent 60%)`,
            }}
          >
            <CardCorners color={meta.accentHex} />

            <div className="flex items-start gap-3">
              <div
                className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-bg/40"
                style={{
                  borderColor: `${meta.accentHex}55`,
                  color: meta.accentHex,
                }}
              >
                <Icon className="size-5" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[0.65rem] uppercase tracking-[0.14em] text-fg-muted">
                  {meta.paceLabel}
                </span>
                <h3
                  className="bs-display m-0 text-2xl font-medium leading-tight"
                  style={{ color: meta.accentHex }}
                >
                  {meta.label}
                </h3>
              </div>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-fg-muted normal-case">
              {meta.tagline}
            </p>

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
          </Card>
        </button>
      </Button>
    </motion.div>
  );
}
