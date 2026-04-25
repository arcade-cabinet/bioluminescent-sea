import type { DiveCompletionCelebration, DiveRunSummary } from "@/sim";

interface CompletionBackdropProps {
  celebration: DiveCompletionCelebration;
  summary: DiveRunSummary;
}

/**
 * Completion backdrop — the arc the player traced through the trench
 * and the named landmarks they passed. Painted behind the GameOverScreen
 * summary. Pure decoration, aria-hidden.
 *
 * Identity rule: stays inside the locked palette (mint glow on
 * abyssal navy). The previous version went amber + cyan + monospace
 * which broke the brand.
 */
export function CompletionBackdrop({ celebration, summary }: CompletionBackdropProps) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{
        background:
          "radial-gradient(circle at 50% 42%, rgba(107, 230, 193, 0.18), transparent 42%), linear-gradient(180deg, #072033 0%, #050a14 60%, #020611 100%)",
      }}
    >
      {/* The arc through the trench — a soft mint ellipse echoing the
       * route the dive traced. */}
      <div
        className="absolute inset-x-[8%] top-[16%] h-[52%]"
        style={{
          borderRadius: "50%",
          border: "1px solid rgba(107, 230, 193, 0.25)",
          boxShadow: "0 0 80px rgba(107, 230, 193, 0.22)",
        }}
      />
      {/* Landmark dots along the arc — each is a glowing mint mark
       * showing the order they were charted. */}
      {celebration.landmarkSequence.map((landmark, index) => {
        const progress =
          celebration.landmarkSequence.length <= 1
            ? 0
            : index / (celebration.landmarkSequence.length - 1);
        return (
          <div
            key={landmark}
            className="bs-numeral absolute grid h-12 w-12 place-items-center text-glow"
            style={{
              left: `${12 + progress * 76}%`,
              top: `${62 - Math.sin(progress * Math.PI) * 34}%`,
              transform: "translate(-50%, -50%)",
              fontSize: "0.78rem",
              filter: "url(#bs-soft-glow)",
              textShadow: "0 0 14px rgba(107, 230, 193, 0.55)",
            }}
          >
            {index + 1}
          </div>
        );
      })}
      {/* Below-arc readout — oxygen banked + depth charted. Type-on-water,
       * not a tile. */}
      <div
        className="absolute bottom-[16%] left-1/2 -translate-x-1/2 text-center"
        style={{
          fontFamily: "var(--font-body)",
          fontFeatureSettings: '"smcp" 1, "c2sc" 1, "tnum" 1, "lnum" 1',
          fontSize: "0.7rem",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--color-fg-muted)",
          filter: "url(#bs-soft-glow)",
          textShadow: "0 0 12px rgba(2,6,17,0.85)",
        }}
      >
        {summary.timeLeft}s oxygen banked &nbsp;·&nbsp; {summary.depthMeters}m charted
      </div>
    </div>
  );
}
