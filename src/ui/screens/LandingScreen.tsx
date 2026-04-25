import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Compass, Crosshair, MoveDown } from "lucide-react";
import { type ComponentType, useCallback, useEffect, useRef, useState } from "react";
import {
  getModeMetadata,
  SESSION_MODES,
  type SessionMode,
  type SessionModeMetadata,
} from "@/sim";
import { EmbossFilters } from "@/ui/primitives";
import { LandingHero } from "@/ui/shell/LandingHero";

interface LandingScreenProps {
  /** Lux balance to surface in the Drydock label on the landing. */
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

/**
 * LandingScreen — the trench is the chrome.
 *
 * No boxy cards, no bordered chips. The fluidic backdrop (LandingHero)
 * IS the surface; every label floats on top with an SVG-filter glow
 * that makes it look like it's been carved into the water and lit
 * from within. Cinzel display + Spectral body + small-caps tracking
 * carry the identity.
 *
 * The single mode picker is the carousel — full descriptions, scales
 * to N modes, no fixed grid.
 */
export function LandingScreen({ currency, onPickMode, onOpenDrydock }: LandingScreenProps) {
  return (
    <motion.div
      data-testid="landing-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
      className="absolute inset-0 flex flex-col overflow-hidden bg-bg text-fg"
    >
      <EmbossFilters />
      <LandingHero />

      {/* Drydock — top right. Floating label, no chip border. */}
      <header
        className="relative flex items-start justify-end px-6 pt-4"
        style={{ paddingTop: "max(env(safe-area-inset-top), 1rem)" }}
      >
        <button
          type="button"
          onClick={onOpenDrydock}
          data-testid="drydock-chip"
          className="pointer-events-auto group flex items-baseline gap-2 bg-transparent text-fg-muted transition-colors hover:text-glow"
        >
          <span
            className="bs-label text-[0.62rem]"
            style={{ filter: "url(#bs-soft-glow)" }}
          >
            Drydock
          </span>
          <span
            className="bs-numeral text-[0.78rem] tracking-wider text-glow"
            style={{ filter: "url(#bs-soft-glow)" }}
          >
            {currency} Lux
          </span>
        </button>
      </header>

      {/* Title + tagline — engraved into the water via SVG emboss filter.
       * Sizing scales on min(vw, vh) so phone-landscape (390px tall)
       * doesn't push the carousel off-screen. */}
      <div className="relative flex flex-col items-center justify-center px-6 pt-1 text-center sm:pt-3 md:pt-10 [@media(max-height:500px)]:pt-0.5">
        <motion.h1
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.9 }}
          className="bs-display m-0 font-medium text-glow"
          style={{
            fontSize: "clamp(1.6rem, min(7vw, 8vh), 5rem)",
            letterSpacing: "0.16em",
            filter: "url(#bs-emboss-glow)",
            textShadow:
              "0 0 18px rgba(107,230,193,0.55), 0 0 40px rgba(107,230,193,0.25), 0 2px 0 rgba(2,6,17,0.4)",
          }}
        >
          Bioluminescent Sea
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.92 }}
          transition={{ delay: 0.55, duration: 0.9 }}
          className="m-0 mt-2 max-w-[42ch] text-fg italic sm:mt-3 md:mt-5 [@media(max-height:500px)]:hidden"
          style={{
            fontFamily: "var(--font-body)",
            fontWeight: 300,
            fontSize: "clamp(0.82rem, min(2.2vw, 2.4vh), 1.05rem)",
            lineHeight: 1.55,
            filter: "url(#bs-soft-glow)",
            textShadow: "0 0 12px rgba(2,6,17,0.85), 0 1px 0 rgba(2,6,17,0.6)",
          }}
        >
          Sink into an abyssal trench. Trace glowing routes past landmark
          creatures. Surface breathing easier than when you started.
        </motion.p>
      </div>

      {/* Mode carousel — the only picker. Floating, no card boxes. */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.85, duration: 0.7 }}
        // Bottom-anchored on phones (where the title eats most of the
        // viewport), naturally placed below the title on tablet/desktop.
        // Generous bottom padding so the chevrons + page dots never
        // brush the viewport edge — the playwright clipping diagnostic
        // is intentionally strict here.
        className="relative mt-auto px-4"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 2rem)" }}
        aria-label="Choose dive mode"
        data-testid="mode-triptych"
      >
        <ModeCarousel onPickMode={onPickMode} />
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

/**
 * Mode entry — text-on-water with a soft radial wash behind. No
 * border, no rounded panel; the label glows in the trench. Hover
 * deepens the wash and lifts the title closer to the lamp colour.
 */
function ModeCard({ meta, icon: Icon, onSelect, animationDelay }: ModeCardProps) {
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      aria-label={`Begin ${meta.label} dive — ${meta.tagline}`}
      data-testid={`mode-card-${meta.id}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: animationDelay, duration: 0.55 }}
      whileHover={{ y: -2 }}
      // Compact padding on shortest viewports so the card fits inside
      // a 390px-tall mobile-landscape window without pushing the
      // carousel chrome off-screen.
      className="group relative h-full w-full bg-transparent p-3 text-left text-fg transition-all sm:p-5 lg:p-6"
      style={{
        // Soft radial wash carries the mode's accent without a frame.
        backgroundImage: `radial-gradient(120% 90% at 50% 0%, ${meta.accentHex}1c 0%, ${meta.accentHex}0a 40%, transparent 75%)`,
      }}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="inline-flex size-9 items-center justify-center"
          style={{
            color: meta.accentHex,
            filter: "url(#bs-soft-glow)",
          }}
        >
          <Icon className="size-6" />
        </span>
        <div className="flex flex-col">
          <span
            className="bs-label text-[0.6rem] text-fg-muted"
            style={{ filter: "url(#bs-soft-glow)" }}
          >
            {meta.paceLabel}
          </span>
          <h3
            className="bs-display m-0 font-medium leading-tight"
            style={{
              color: meta.accentHex,
              fontSize: "clamp(1.4rem, 3.4vw, 1.85rem)",
              filter: "url(#bs-emboss-glow)",
              textShadow: `0 0 14px ${meta.accentHex}60, 0 0 30px ${meta.accentHex}30`,
            }}
          >
            {meta.label}
          </h3>
        </div>
      </div>

      <p
        // Tagline hidden on very-short viewports (mobile-landscape)
        // so the card stays inside the 390px-tall window. The CSS
        // media query checks viewport height, not Tailwind's
        // width-based sm: which doesn't help here.
        className="mt-3 text-sm italic leading-relaxed text-fg/85 [@media(max-height:500px)]:hidden"
        style={{
          fontWeight: 300,
          textShadow: "0 0 10px rgba(2,6,17,0.85), 0 1px 0 rgba(2,6,17,0.5)",
        }}
      >
        {meta.tagline}
      </p>

      <div
        className="mt-3 flex items-center justify-between sm:mt-5"
        style={{ filter: "url(#bs-soft-glow)" }}
      >
        <span className="bs-label text-[0.62rem] text-fg-muted transition-colors group-hover:text-glow">
          Tap to chart
        </span>
        <span
          aria-hidden="true"
          className="text-base transition-transform duration-300 group-hover:translate-x-1"
          style={{ color: meta.accentHex }}
        >
          →
        </span>
      </div>
    </motion.button>
  );
}

interface ModeCarouselProps {
  onPickMode: (mode: SessionMode) => void;
}

/**
 * Universal mode picker — horizontal scroll-snap carousel. Slides are
 * full-width on phones (one card per page), fractional on tablet
 * landscape and desktop (multiple visible with side-peek). Adding a
 * 4th/5th mode is one more entry in SESSION_MODES — the carousel
 * adapts. No fixed 3-up grid anywhere.
 */
function ModeCarousel({ onPickMode }: ModeCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const slideRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  const scrollToIndex = useCallback((index: number) => {
    const scroller = scrollerRef.current;
    const slide = slideRefs.current[index];
    if (!scroller || !slide) return;
    const target = slide.offsetLeft - (scroller.clientWidth - slide.clientWidth) / 2;
    scroller.scrollTo({ left: target, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const onScroll = () => {
      const scrollerCentre = scroller.scrollLeft + scroller.clientWidth / 2;
      let bestIdx = 0;
      let bestDist = Number.POSITIVE_INFINITY;
      slideRefs.current.forEach((slide, i) => {
        if (!slide) return;
        const slideCentre = slide.offsetLeft + slide.clientWidth / 2;
        const d = Math.abs(slideCentre - scrollerCentre);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      });
      setActiveIndex(bestIdx);
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
    <div className="relative mx-auto w-full max-w-6xl" data-testid="mode-carousel">
      <div
        ref={scrollerRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-roledescription="carousel"
        aria-label="Dive mode picker"
      >
        {SESSION_MODES.map((mode, index) => (
          <div
            key={mode}
            ref={(node) => {
              slideRefs.current[index] = node;
            }}
            className="w-full shrink-0 snap-center px-3 sm:basis-[calc(60%-1.5rem)] md:basis-[calc(34%-1.5rem)] xl:basis-[calc(28%-1.5rem)]"
            aria-roledescription="slide"
            aria-label={`${getModeMetadata(mode).label} (${index + 1} of ${SESSION_MODES.length})`}
          >
            <ModeCard
              meta={getModeMetadata(mode)}
              icon={MODE_ICONS[mode]}
              onSelect={() => onPickMode(mode)}
              animationDelay={0.9 + index * 0.08}
            />
          </div>
        ))}
      </div>

      {/* Page dots — soft mint glow, never a chip. */}
      <div
        className="mt-2 flex items-center justify-center gap-2"
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
                  ? "h-1.5 w-7 rounded-full bg-glow shadow-[0_0_10px_rgba(107,230,193,0.6)] transition-all"
                  : "h-1.5 w-1.5 rounded-full bg-fg-muted/40 transition-all hover:bg-fg-muted/70"
              }
            />
          );
        })}
      </div>

      {/* Prev/Next chevrons — visible from sm+ where there's room. */}
      <button
        type="button"
        aria-label="Previous mode"
        onClick={() => scrollToIndex(activeIndex - 1)}
        disabled={activeIndex === 0}
        className="absolute left-0 top-1/2 hidden -translate-y-1/2 items-center justify-center bg-transparent p-2 text-fg-muted transition-colors hover:text-glow disabled:opacity-20 sm:flex"
        style={{ filter: "url(#bs-soft-glow)" }}
      >
        <ChevronLeft className="size-5" aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="Next mode"
        onClick={() => scrollToIndex(activeIndex + 1)}
        disabled={activeIndex === SESSION_MODES.length - 1}
        className="absolute right-0 top-1/2 hidden -translate-y-1/2 items-center justify-center bg-transparent p-2 text-fg-muted transition-colors hover:text-glow disabled:opacity-20 sm:flex"
        style={{ filter: "url(#bs-soft-glow)" }}
      >
        <ChevronRight className="size-5" aria-hidden="true" />
      </button>
    </div>
  );
}
