import { motion } from "framer-motion";
import type { CSSProperties } from "react";

interface CompactPrimaryProps {
  /** Score (current dive). */
  score: number;
  /** Seconds of oxygen remaining. */
  timeLeft: number;
  /** Current chain multiplier. */
  multiplier: number;
  /** True when chain > 1 AND ≤ 1.2 s remains in the streak window.
   *  Drives a warn-tone pulse on the chain readout. */
  chainExpiringSoon?: boolean;
  /** Oxygen 0..1 — drives the warn tint when low. */
  oxygenRatio: number;
}

/**
 * Compact phone HUD — three columns of floating type. No tile, no
 * border, no divider lines. Same identity language as the desktop
 * HUD: ink-on-water lit by an SVG glow.
 */

const cellStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.1rem",
  minWidth: 0,
};

const labelStyle: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "0.55rem",
  fontWeight: 500,
  fontFeatureSettings: '"smcp" 1, "c2sc" 1, "tnum" 1',
  textTransform: "uppercase",
  letterSpacing: "0.18em",
  color: "var(--color-fg-muted)",
  margin: 0,
  whiteSpace: "nowrap",
  filter: "url(#bs-soft-glow)",
};

const valueStyle: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontFeatureSettings: '"tnum" 1, "lnum" 1',
  fontSize: "1.2rem",
  fontWeight: 500,
  lineHeight: 1.05,
  color: "var(--color-fg)",
  margin: 0,
  whiteSpace: "nowrap",
  textShadow: "0 0 12px rgba(2,6,17,0.85), 0 1px 0 rgba(2,6,17,0.5)",
};

export function CompactPrimary({
  score,
  timeLeft,
  multiplier,
  chainExpiringSoon,
  oxygenRatio,
}: CompactPrimaryProps) {
  const oxygenLow = oxygenRatio < 0.25;
  return (
    <div
      style={{
        display: "flex",
        gap: "1.1rem",
        alignItems: "flex-start",
      }}
      data-testid="hud-compact-primary"
    >
      <div style={cellStyle} data-testid="hud-compact-oxygen">
        <span style={labelStyle}>Oxygen</span>
        <span
          style={{
            ...valueStyle,
            color: oxygenLow ? "var(--color-warn)" : valueStyle.color,
            filter: oxygenLow ? "url(#bs-warm-glow)" : "url(#bs-soft-glow)",
          }}
        >
          {Math.max(0, Math.floor(timeLeft))}s
        </span>
      </div>
      <div style={cellStyle} data-testid="hud-compact-score">
        <span style={labelStyle}>Score</span>
        <motion.span
          key={String(score)}
          initial={{ scale: 1.18, color: "var(--color-glow)" }}
          animate={{ scale: 1, color: valueStyle.color as string }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          style={{ ...valueStyle, display: "inline-block", transformOrigin: "left center" }}
        >
          {score}
        </motion.span>
      </div>
      <div style={cellStyle} data-testid="hud-compact-chain">
        <span style={labelStyle}>Chain</span>
        <motion.span
          key={`${multiplier}-${chainExpiringSoon ? "warn" : "ok"}`}
          initial={{ scale: 1.18 }}
          animate={
            chainExpiringSoon
              ? { scale: [1, 1.06, 1], color: "var(--color-warn)" }
              : { scale: 1, color: valueStyle.color as string }
          }
          transition={
            chainExpiringSoon
              ? { duration: 0.55, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }
              : { duration: 0.35, ease: "easeOut" }
          }
          style={{
            ...valueStyle,
            display: "inline-block",
            transformOrigin: "left center",
            filter: chainExpiringSoon ? "url(#bs-warm-glow)" : undefined,
          }}
        >
          ×{multiplier}
        </motion.span>
      </div>
    </div>
  );
}
