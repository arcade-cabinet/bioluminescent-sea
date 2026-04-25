import type { CSSProperties } from "react";

interface CompactPrimaryProps {
  /** Score (current dive). */
  score: number;
  /** Seconds of oxygen remaining. */
  timeLeft: number;
  /** Current chain multiplier. */
  multiplier: number;
  /** Oxygen 0..1 — drives the warn tint when low. */
  oxygenRatio: number;
}

const wrapStyle: CSSProperties = {
  display: "flex",
  alignItems: "stretch",
  gap: 0,
  background: "color-mix(in srgb, var(--color-abyss) 72%, transparent)",
  border: "1px solid color-mix(in srgb, var(--color-glow) 20%, transparent)",
  borderRadius: 10,
  color: "var(--color-fg)",
  fontFamily: "var(--font-body)",
  boxShadow: "0 4px 18px color-mix(in srgb, var(--color-bg) 45%, transparent)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  overflow: "hidden",
};

const cellStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  padding: "0.35rem 0.6rem",
  minWidth: 0,
};

const dividerStyle: CSSProperties = {
  width: 1,
  background: "color-mix(in srgb, var(--color-glow) 18%, transparent)",
  margin: "0.25rem 0",
};

const labelStyle: CSSProperties = {
  fontSize: "0.55rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.14em",
  color: "var(--color-fg-muted)",
  margin: 0,
  marginBottom: "0.1rem",
  whiteSpace: "nowrap",
};

const valueStyle: CSSProperties = {
  fontSize: "1.05rem",
  fontWeight: 600,
  lineHeight: 1.05,
  color: "var(--color-fg)",
  margin: 0,
  fontFeatureSettings: '"tnum"',
  whiteSpace: "nowrap",
};

/**
 * Always-visible primary readout for compact (phone) viewports — the
 * three values a player checks every second or two: oxygen left, score,
 * and the chain multiplier. Everything else lives inside the hamburger
 * panel via HudShell.
 */
export function CompactPrimary({
  score,
  timeLeft,
  multiplier,
  oxygenRatio,
}: CompactPrimaryProps) {
  const oxygenLow = oxygenRatio < 0.25;
  return (
    <div style={wrapStyle} data-testid="hud-compact-primary">
      <div style={cellStyle} data-testid="hud-compact-oxygen">
        <span style={labelStyle}>Oxygen</span>
        <span
          style={{
            ...valueStyle,
            color: oxygenLow ? "var(--color-warn)" : valueStyle.color,
          }}
        >
          {Math.max(0, Math.floor(timeLeft))}s
        </span>
      </div>
      <div style={dividerStyle} />
      <div style={cellStyle} data-testid="hud-compact-score">
        <span style={labelStyle}>Score</span>
        <span style={valueStyle}>{score}</span>
      </div>
      <div style={dividerStyle} />
      <div style={cellStyle} data-testid="hud-compact-chain">
        <span style={labelStyle}>Chain</span>
        <span style={valueStyle}>×{multiplier}</span>
      </div>
    </div>
  );
}
