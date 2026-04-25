import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { isMuted, onMuteChange, toggleMuted } from "@/audio";
import { EmbossFilters } from "@/ui/primitives";

interface HUDProps {
  score: number;
  timeLeft: number;
  multiplier: number;
  depthMeters: number;
  beacons: number;
  oxygenRatio: number;
  threatAlert: boolean;
  nearestLandmarkLabel?: string;
  nearestLandmarkDistance?: number;
  runCodename?: string;
  biomeLabel?: string;
  biomeTintHex?: string;
}

/**
 * Field-journal HUD. No clusters, no chips, no dividers.
 *
 * Identity rule (v0.7): every readout is type floating in the water,
 * lit by an SVG glow filter. The trench is the chrome; the HUD reads
 * as ink on a chartmaker's overlay rather than a status bar.
 */

const labelStyle: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "0.6rem",
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
  fontSize: "1.4rem",
  fontWeight: 500,
  lineHeight: 1.05,
  color: "var(--color-fg)",
  margin: 0,
  whiteSpace: "nowrap",
  textShadow: "0 0 12px rgba(2,6,17,0.85), 0 1px 0 rgba(2,6,17,0.5)",
};

function StatCell({
  label,
  value,
  tone,
  testId,
}: {
  label: string;
  value: ReactNode;
  tone?: "glow" | "warn" | "muted";
  testId: string;
}) {
  const valueColor =
    tone === "warn"
      ? "var(--color-warn)"
      : tone === "muted"
        ? "var(--color-fg-muted)"
        : "var(--color-fg)";
  const valueGlow =
    tone === "warn"
      ? "url(#bs-warm-glow)"
      : tone === "glow"
        ? "url(#bs-soft-glow)"
        : undefined;
  return (
    <div
      data-testid={`hud-stat-${testId}`}
      style={{ display: "flex", flexDirection: "column", gap: "0.15rem", minWidth: 0 }}
    >
      <div style={{ ...labelStyle, color: tone === "warn" ? "var(--color-warn)" : "var(--color-fg-muted)" }}>
        {label}
      </div>
      <div style={{ ...valueStyle, color: valueColor, filter: valueGlow }}>{value}</div>
    </div>
  );
}

export function HUD({
  score,
  timeLeft,
  multiplier,
  depthMeters,
  beacons,
  oxygenRatio,
  threatAlert,
  nearestLandmarkLabel,
  nearestLandmarkDistance,
  runCodename,
  biomeLabel,
  biomeTintHex,
}: HUDProps) {
  const critical = oxygenRatio < 0.1;
  const lowOxygen = oxygenRatio < 0.25;

  // Biome transition flash — same UX as before but now a floating
  // ribbon instead of a pill. Auto-dismisses after 2.2s.
  const [bannerLabel, setBannerLabel] = useState<string | null>(null);
  const lastBiomeRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!biomeLabel) return;
    if (lastBiomeRef.current === biomeLabel) return;
    lastBiomeRef.current = biomeLabel;
    setBannerLabel(biomeLabel);
    const timeout = window.setTimeout(() => setBannerLabel(null), 2200);
    return () => window.clearTimeout(timeout);
  }, [biomeLabel]);

  return (
    <>
      <EmbossFilters />

      {/* Top-left readouts — five floating columns, no cluster bg. */}
      <div
        data-testid="hud-stat-cluster"
        style={{
          position: "absolute",
          top: "max(env(safe-area-inset-top), 1rem)",
          left: "1.25rem",
          display: "flex",
          gap: "1.6rem",
          alignItems: "flex-start",
          pointerEvents: "none",
          zIndex: 10,
        }}
      >
        <StatCell label="Score" value={score} testId="score" />
        <StatCell
          label={critical ? "O₂ critical" : lowOxygen ? "O₂ low" : "Oxygen"}
          value={`${Math.max(0, timeLeft).toFixed(0)}s`}
          tone={lowOxygen ? "warn" : "glow"}
          testId="oxygen"
        />
        <StatCell label="Chain" value={`×${multiplier}`} testId="chain" />
        <StatCell label="Depth" value={`${depthMeters}m`} tone="muted" testId="depth" />
        <StatCell label="Charted" value={`${beacons}%`} tone="muted" testId="charted" />
      </div>

      {/* Right-side annotations — landmark, biome, run codename. All
          floating type. The biome label glows in its biome accent. */}
      <div
        style={{
          position: "absolute",
          top: "max(env(safe-area-inset-top), 1rem)",
          right: "1.25rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: "0.4rem",
          pointerEvents: "none",
          zIndex: 10,
        }}
      >
        {nearestLandmarkLabel && (
          <motion.div
            data-testid="hud-landmark-chip"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              ...labelStyle,
              color: "var(--color-glow)",
              fontSize: "0.7rem",
              filter: "url(#bs-soft-glow)",
            }}
          >
            {nearestLandmarkLabel}
            {typeof nearestLandmarkDistance === "number" &&
              Number.isFinite(nearestLandmarkDistance) && (
                <span style={{ marginLeft: "0.5rem", color: "var(--color-fg-muted)" }}>
                  {Math.round(nearestLandmarkDistance)}m
                </span>
              )}
          </motion.div>
        )}
        {biomeLabel && (
          <motion.div
            key={biomeLabel}
            data-testid="hud-biome-chip"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            style={{
              ...labelStyle,
              fontSize: "0.62rem",
              color: biomeTintHex ?? "var(--color-glow)",
            }}
          >
            {biomeLabel}
          </motion.div>
        )}
        {runCodename && (
          <div
            data-testid="hud-codename-chip"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "0.78rem",
              letterSpacing: "0.06em",
              color: "var(--color-fg-muted)",
              whiteSpace: "nowrap",
              maxWidth: "min(60vw, 240px)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              filter: "url(#bs-soft-glow)",
              textShadow: "0 0 10px rgba(2,6,17,0.85)",
            }}
          >
            {runCodename}
          </div>
        )}
      </div>

      {/* Low-oxygen pulse — radial warm wash. */}
      {lowOxygen && (
        <motion.div
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.15, 0.32, 0.15] }}
          transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.1 }}
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse at center, transparent 55%, rgba(255, 107, 107, 0.20) 100%)",
            pointerEvents: "none",
            zIndex: 5,
          }}
        />
      )}

      {threatAlert && (
        <motion.div
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 50% 52%, transparent 40%, rgba(255, 107, 107, 0.35) 100%)",
            pointerEvents: "none",
            zIndex: 5,
          }}
        />
      )}

      {critical && <CriticalBreathBanner />}

      {/* Biome transition — small floating ribbon, type-on-water. */}
      <AnimatePresence>
        {bannerLabel && (
          <motion.div
            key={bannerLabel}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.32, ease: "easeOut" }}
            style={{
              position: "fixed",
              top: "max(env(safe-area-inset-top), 5rem)",
              left: "50%",
              transform: "translateX(-50%)",
              pointerEvents: "none",
              zIndex: 20,
              display: "flex",
              alignItems: "baseline",
              gap: "0.6rem",
            }}
          >
            <span
              style={{
                ...labelStyle,
                fontSize: "0.55rem",
                color: biomeTintHex ?? "var(--color-glow)",
                filter: "url(#bs-soft-glow)",
              }}
            >
              Entering
            </span>
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "1.1rem",
                fontWeight: 500,
                letterSpacing: "0.10em",
                color: biomeTintHex ?? "var(--color-glow)",
                filter: "url(#bs-emboss-glow)",
                textShadow: `0 0 14px ${biomeTintHex ?? "#6be6c1"}55, 0 0 28px ${biomeTintHex ?? "#6be6c1"}25`,
              }}
            >
              {bannerLabel}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <MuteButton />
    </>
  );
}

/**
 * Critical-breath beat — the last warning before surface or end. The
 * old version was a red-on-blood-red box. Replaced with type-on-water
 * carrying a warm-glow filter so it pops against the trench without
 * looking like an error toast.
 */
function CriticalBreathBanner() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: [0.8, 1, 0.8], y: 0 }}
      transition={{
        opacity: { duration: 1.6, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" },
        y: { duration: 0.4, ease: "easeOut" },
      }}
      style={{
        position: "absolute",
        bottom: "calc(max(env(safe-area-inset-bottom), 1rem) + 4.5rem)",
        left: "50%",
        transform: "translateX(-50%)",
        fontFamily: "var(--font-display)",
        fontSize: "clamp(1rem, 2.8vw, 1.25rem)",
        fontWeight: 500,
        letterSpacing: "0.10em",
        color: "var(--color-warn)",
        filter: "url(#bs-warm-glow)",
        textShadow: "0 0 16px rgba(255,107,107,0.55), 0 0 30px rgba(255,107,107,0.25)",
        pointerEvents: "none",
        whiteSpace: "nowrap",
        zIndex: 11,
      }}
    >
      Hold your breath — surface now.
    </motion.div>
  );
}

function MuteButton() {
  const [muted, setMuted] = useState<boolean>(() => isMuted());
  useEffect(() => onMuteChange(setMuted), []);
  return (
    <button
      type="button"
      aria-label={muted ? "Unmute audio" : "Mute audio"}
      onClick={() => setMuted(toggleMuted())}
      style={{
        position: "absolute",
        bottom: "max(env(safe-area-inset-bottom), 1rem)",
        left: "1rem",
        width: 36,
        height: 36,
        background: "transparent",
        border: "none",
        color: muted ? "var(--color-fg-muted)" : "var(--color-glow)",
        fontSize: "1rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "auto",
        zIndex: 10,
        cursor: "pointer",
        filter: "url(#bs-soft-glow)",
      }}
    >
      {muted ? "🔇" : "🔊"}
    </button>
  );
}
