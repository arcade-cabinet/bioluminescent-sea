/**
 * Reusable SVG `<filter>` definitions for the abyssal type system.
 * Mounted once at the root of LandingScreen / GameOverScreen / dive
 * overlays so every floating-text element can reference them by id
 * without redeclaring filter graphs.
 *
 * - `bs-emboss-glow` — bright mint outer glow + close white halo + a
 *   soft inset stroke. Use for primary display text (title, mode
 *   labels, CTA glyphs). Reads as "carved into the water and
 *   bioluminescent."
 *
 * - `bs-soft-glow` — a subtler version (no inner stroke, lighter
 *   spread). Use for HUD readouts and chart annotations.
 *
 * - `bs-warm-glow` — the warn-red counterpart for low-oxygen pulses
 *   and threat warnings. Same shape language, different hue.
 *
 * Filter performance: each filter is a small-radius blur (4-12px)
 * over text only — paints in CSS-pixel-space, not full canvas.
 * Browser composites natively; no perf hit at gameplay framerates.
 */
export function EmbossFilters() {
  return (
    <svg
      aria-hidden="true"
      width="0"
      height="0"
      style={{ position: "absolute", overflow: "hidden", pointerEvents: "none" }}
    >
      <defs>
        <filter id="bs-emboss-glow" x="-40%" y="-40%" width="180%" height="180%">
          {/* Outer mint halo — wide, soft. */}
          <feGaussianBlur in="SourceAlpha" stdDeviation="6" result="halo" />
          <feColorMatrix
            in="halo"
            type="matrix"
            values="0 0 0 0 0.42  0 0 0 0 0.90  0 0 0 0 0.76  0 0 0 0.85 0"
            result="haloMint"
          />
          {/* Tight inner glow — close to the glyph edge. */}
          <feGaussianBlur in="SourceAlpha" stdDeviation="1.4" result="rim" />
          <feColorMatrix
            in="rim"
            type="matrix"
            values="0 0 0 0 0.85  0 0 0 0 0.95  0 0 0 0 0.92  0 0 0 0.9 0"
            result="rimWhite"
          />
          {/* Composite halo behind, source on top. */}
          <feMerge>
            <feMergeNode in="haloMint" />
            <feMergeNode in="rimWhite" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <filter id="bs-soft-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="halo" />
          <feColorMatrix
            in="halo"
            type="matrix"
            values="0 0 0 0 0.42  0 0 0 0 0.90  0 0 0 0 0.76  0 0 0 0.55 0"
            result="haloMint"
          />
          <feMerge>
            <feMergeNode in="haloMint" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <filter id="bs-warm-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="5" result="halo" />
          <feColorMatrix
            in="halo"
            type="matrix"
            values="0 0 0 0 1.00  0 0 0 0 0.42  0 0 0 0 0.42  0 0 0 0.85 0"
            result="haloRed"
          />
          <feMerge>
            <feMergeNode in="haloRed" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    </svg>
  );
}
