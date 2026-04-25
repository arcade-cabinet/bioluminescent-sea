import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Compass, Crosshair, MoveDown } from "lucide-react";
import { type ComponentType, useCallback, useEffect, useRef, useState } from "react";
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
  // Compact layouts swap the 3-up grid for a swipeable carousel: one
  // full mode card per page, snap-scroll, dot indicators below. This
  // gives the tagline + description back on phones (the compact grid
  // had to drop them) and scales naturally to a fourth/fifth mode.
  const useCarousel = isPhonePortrait || isPhoneLandscape || isTabletPortrait;
  const pinTriptychToBottom = useCarousel;
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

        {!isPhoneLandscape && (
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
        {!useCarousel && (
          <p className="mb-3 text-center text-[0.7rem] uppercase tracking-[0.18em] text-fg-muted">
            Choose your descent
          </p>
        )}
        {useCarousel ? (
          <ModeCarousel onPickMode={onPickMode} />
        ) : (
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
        )}
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
      className="h-full"
    >
      <Button
        asChild
        variant="ghost"
        size="lg"
        className="group h-full w-full justify-start whitespace-normal p-0 text-left"
        data-testid={`mode-card-${meta.id}`}
      >
        <button
          type="button"
          onClick={onSelect}
          aria-label={`Begin ${meta.label} dive — ${meta.tagline}`}
        >
          <Card
            className="group relative h-full w-full overflow-hidden border-deep/70 bg-abyss/80 p-5 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:border-glow/50 group-hover:shadow-[0_0_32px_rgba(107,230,193,0.18)]"
            style={{
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

interface ModeCarouselProps {
  onPickMode: (mode: SessionMode) => void;
}

/**
 * Horizontal scroll-snap carousel — one full mode card per page on
 * compact viewports. All cards stay in the DOM (clickable from
 * Playwright via auto-scroll). Dot indicators reflect the active page;
 * left/right keys navigate; arrow buttons appear on tablet-portrait
 * where there's room for chrome. Adding a fourth mode is one extra
 * card in the same scroller — no layout work.
 */
function ModeCarousel({ onPickMode }: ModeCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const scrollToIndex = useCallback((index: number) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const clamped = Math.max(0, Math.min(SESSION_MODES.length - 1, index));
    scroller.scrollTo({
      left: clamped * scroller.clientWidth,
      behavior: "smooth",
    });
  }, []);

  // Track the active page from scroll position so swipe + arrow + dot
  // taps all stay in sync. We round to nearest page width.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const onScroll = () => {
      const page = Math.round(scroller.scrollLeft / scroller.clientWidth);
      setActiveIndex(page);
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, []);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      scrollToIndex(activeIndex + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      scrollToIndex(activeIndex - 1);
    }
  };

  return (
    <div className="relative" data-testid="mode-carousel">
      <div
        ref={scrollerRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-roledescription="carousel"
        aria-label="Dive mode picker"
      >
        {SESSION_MODES.map((mode, index) => (
          <div
            key={mode}
            className="w-full shrink-0 snap-center px-2"
            aria-roledescription="slide"
            aria-label={`${getModeMetadata(mode).label} (${index + 1} of ${SESSION_MODES.length})`}
          >
            <ModeCard
              meta={getModeMetadata(mode)}
              icon={MODE_ICONS[mode]}
              onSelect={() => onPickMode(mode)}
              animationDelay={0.8 + index * 0.08}
            />
          </div>
        ))}
      </div>

      {/* Page dots — tap to jump. */}
      <div
        className="mt-1 flex items-center justify-center gap-2"
        role="tablist"
        aria-label="Mode pages"
      >
        {SESSION_MODES.map((mode, index) => {
          const isActive = index === activeIndex;
          return (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={`Go to ${getModeMetadata(mode).label}`}
              data-testid={`mode-dot-${mode}`}
              onClick={() => scrollToIndex(index)}
              className={
                isActive
                  ? "h-2 w-6 rounded-full bg-glow transition-all"
                  : "h-2 w-2 rounded-full bg-fg-muted/40 transition-all hover:bg-fg-muted/70"
              }
            />
          );
        })}
      </div>

      {/* Prev/Next chevrons — tablet-portrait has the width to host
       * them; phones rely on swipe + dots. */}
      <button
        type="button"
        aria-label="Previous mode"
        onClick={() => scrollToIndex(activeIndex - 1)}
        disabled={activeIndex === 0}
        className="absolute left-0 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full border border-deep/60 bg-abyss/80 p-1.5 text-fg-muted backdrop-blur-md transition-colors hover:border-glow/60 hover:text-glow disabled:opacity-30 md:flex"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="Next mode"
        onClick={() => scrollToIndex(activeIndex + 1)}
        disabled={activeIndex === SESSION_MODES.length - 1}
        className="absolute right-0 top-1/2 hidden -translate-y-1/2 items-center justify-center rounded-full border border-deep/60 bg-abyss/80 p-1.5 text-fg-muted backdrop-blur-md transition-colors hover:border-glow/60 hover:text-glow disabled:opacity-30 md:flex"
      >
        <ChevronRight className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
