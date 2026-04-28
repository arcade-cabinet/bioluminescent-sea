import { motion } from "framer-motion";
import { Compass, Crosshair, MoveDown } from "lucide-react";
import type { ComponentType } from "react";
import {
  getModeMetadata,
  SESSION_MODES,
  type SessionMode,
  type SessionModeMetadata,
} from "@/sim";
import {
  Carousel,
  CarouselContent,
  CarouselIndicator,
  CarouselItem,
  CarouselNavigation,
  EmbossFilters,
} from "@/ui/primitives";
import { LandingHero } from "@/ui/shell/LandingHero";
import { useDeviceClass } from "@/hooks/useDeviceClass";

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

      {/* Drydock — top right. Floating label, no chip border.
       *  Padding pulls the safe-area insets in via env() so phones
       *  with rounded corners / notches don't clip the label. The
       *  baseline `1rem` / `1.5rem` are the inland defaults; max()
       *  picks whichever is larger so we never lose padding on a
       *  device without a notch.
       */}
      <header
        className="relative flex items-start justify-end"
        style={{
          paddingTop: "max(env(safe-area-inset-top), 1rem)",
          paddingRight: "max(env(safe-area-inset-right), 1.5rem)",
          paddingLeft: "max(env(safe-area-inset-left), 1.5rem)",
        }}
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
       * doesn't push the carousel off-screen.
       *
       * `pt-6` on `<sm` clears the Drydock chip in the header so the
       * wrapped title's first line doesn't render in the chip's
       * horizontal band. Without this the "BIOLUMINESCENT" wrap on
       * mobile-portrait visually collides with "DRYDOCK · Lux".
       * (Iter-2 finding #2.) */}
      <div className="relative flex flex-col items-center justify-center px-6 pt-6 text-center sm:pt-3 md:pt-10 [@media(max-height:500px)]:pt-0.5">
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
          Pilot a submarine into the deep ocean. Collect glowing creatures,
          dodge predators, and see how far down you can go.
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
      whileHover={{
        y: -3,
        scale: 1.015,
        backgroundImage: `radial-gradient(120% 90% at 50% 0%, ${meta.accentHex}38 0%, ${meta.accentHex}14 40%, transparent 75%)`,
        boxShadow: `0 0 32px ${meta.accentHex}28 inset, 0 8px 24px ${meta.accentHex}10`,
      }}
      whileTap={{ scale: 0.985, transition: { duration: 0.08 } }}
      // Compact padding on shortest viewports so the card fits inside
      // a 390px-tall mobile-landscape window without pushing the
      // carousel chrome off-screen.
      className="group relative h-full w-full bg-transparent p-3 text-left text-fg transition-shadow sm:p-5 lg:p-6"
      style={{
        // Soft radial wash carries the mode's accent without a frame.
        // whileHover intensifies the wash + adds an inset glow so
        // the card reads as "warming up" under the cursor.
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
 * Mode carousel built on the shared <Carousel/> primitive. The
 * primitive uses framer-motion drag + translateX, so each
 * `<CarouselItem>` IS a full page — only one mode is visible at
 * a time and you swipe/click between them. No fixed grid, no
 * "3-up row" pretending to be a carousel. The outer container
 * caps width so even on a 1920px desktop you see one centered
 * card with breathing room either side.
 */
function ModeCarousel({ onPickMode }: ModeCarouselProps) {
  const { klass } = useDeviceClass();
  // Phones get the inline controls-strip layout (chevrons outside
  // the card, dot row centred between them with a backdrop pill).
  // Tablet+ keeps the original cinematic layout: floating chevrons
  // in the gutters + dot row absolutely positioned beneath the
  // viewport. Branching at the JS layer (not Tailwind responsive
  // classes) keeps a single CarouselNavigation in the DOM so
  // `getByTestId('carousel-next')` selects the visible button.
  // (Iter-2 finding #1.)
  const isPhone = klass === "phone-portrait" || klass === "phone-landscape";
  return (
    <div
      className="relative mx-auto w-full max-w-md sm:max-w-lg"
      data-testid="mode-carousel"
    >
      <Carousel>
        <CarouselContent>
          {SESSION_MODES.map((mode, index) => (
            // No horizontal padding on phone so the card uses the
            // full carousel viewport width — the controls strip
            // below carries pagination instead.
            <CarouselItem key={mode} className={isPhone ? "" : "px-3"}>
              <ModeCard
                meta={getModeMetadata(mode)}
                icon={MODE_ICONS[mode]}
                onSelect={() => onPickMode(mode)}
                animationDelay={0.9 + index * 0.08}
              />
            </CarouselItem>
          ))}
        </CarouselContent>
        {isPhone ? (
          <div className="relative mt-4 flex items-center justify-between gap-3 px-2">
            <CarouselNavigation alwaysShow layout="inline" className="flex-1" />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="pointer-events-auto">
                <CarouselIndicator modeIds={SESSION_MODES} layout="inline" />
              </div>
            </div>
          </div>
        ) : (
          <>
            <CarouselNavigation alwaysShow />
            <CarouselIndicator modeIds={SESSION_MODES} />
          </>
        )}
      </Carousel>
    </div>
  );
}
