import { motion } from "framer-motion";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { isMuted, onMuteChange, toggleMuted } from "@/audio";

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

const panelStyle: CSSProperties = {
  background: "rgba(10, 26, 46, 0.72)",
  border: "1px solid rgba(107, 230, 193, 0.2)",
  borderRadius: 8,
  padding: "0.65rem 0.85rem",
  color: "var(--color-fg)",
  fontFamily: "var(--font-body)",
  boxShadow: "0 4px 18px rgba(5, 10, 20, 0.45)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  minWidth: 0,
};

const labelStyle: CSSProperties = {
  fontSize: "0.6rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  color: "var(--color-glow)",
  margin: 0,
  marginBottom: "0.15rem",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const valueStyle: CSSProperties = {
  fontSize: "1.35rem",
  fontWeight: 600,
  lineHeight: 1.1,
  color: "var(--color-fg)",
  margin: 0,
  fontFeatureSettings: "\"tnum\"",
  whiteSpace: "nowrap",
};

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: ReactNode;
  tone?: "glow" | "warn" | "muted";
}) {
  const toneColor =
    tone === "warn"
      ? "var(--color-warn)"
      : tone === "muted"
        ? "var(--color-fg-muted)"
        : "var(--color-glow)";
  return (
    <div style={{ ...panelStyle, borderColor: `${toneColor}30` }}>
      <div style={{ ...labelStyle, color: toneColor }}>{label}</div>
      <div style={valueStyle}>{value}</div>
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
  const lowOxygen = oxygenRatio < 0.25;
  return (
    <>
      {/* Top stat row */}
      <div
        style={{
          position: "absolute",
          top: "max(env(safe-area-inset-top), 1rem)",
          left: "1rem",
          right: "1rem",
          display: "flex",
          gap: "0.5rem",
          justifyContent: "flex-start",
          pointerEvents: "none",
          zIndex: 10,
          flexWrap: "wrap",
        }}
      >
        <Stat label="Score" value={score} />
        <Stat
          label={lowOxygen ? "Oxygen — Low" : "Oxygen"}
          value={`${Math.max(0, timeLeft).toFixed(0)}s`}
          tone={lowOxygen ? "warn" : undefined}
        />
        <Stat label="Chain" value={`×${multiplier}`} />
        <Stat label="Depth" value={`${depthMeters}m`} tone="muted" />
        <Stat label="Charted" value={`${beacons}%`} tone="muted" />
      </div>

      {/* Run codename chip — the brand identity of this specific
          trench, placed below the landmark chip at top-right. */}
      {runCodename && (
        <div
          style={{
            position: "absolute",
            top: "calc(max(env(safe-area-inset-top), 1rem) + 2.4rem)",
            right: "1rem",
            padding: "0.3rem 0.65rem",
            background: "rgba(10, 26, 46, 0.55)",
            border: "1px solid rgba(107, 230, 193, 0.18)",
            borderRadius: 999,
            fontFamily: "var(--font-display)",
            fontSize: "0.78rem",
            letterSpacing: "0.02em",
            color: "var(--color-fg-muted)",
            pointerEvents: "none",
            zIndex: 10,
          }}
        >
          {runCodename}
        </div>
      )}

      {/* Biome chip — the current depth band, updates as the dive
          descends. Stroke color comes from the biome's tintHex so the
          chip itself shifts palette on transition. */}
      {biomeLabel && (
        <motion.div
          key={biomeLabel}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          style={{
            position: "absolute",
            top: "calc(max(env(safe-area-inset-top), 1rem) + 4.6rem)",
            right: "1rem",
            padding: "0.3rem 0.65rem",
            background: "rgba(10, 26, 46, 0.55)",
            border: `1px solid ${biomeTintHex ?? "#6be6c1"}55`,
            borderRadius: 999,
            fontFamily: "var(--font-body)",
            fontSize: "0.65rem",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: biomeTintHex ?? "var(--color-glow)",
            pointerEvents: "none",
            zIndex: 10,
          }}
        >
          {biomeLabel}
        </motion.div>
      )}

      {/* Route landmark chip */}
      {nearestLandmarkLabel && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            position: "absolute",
            top: "max(env(safe-area-inset-top), 1rem)",
            right: "1rem",
            padding: "0.5rem 0.75rem",
            background: "rgba(14, 79, 85, 0.65)",
            border: "1px solid rgba(107, 230, 193, 0.3)",
            borderRadius: 999,
            fontFamily: "var(--font-body)",
            fontSize: "0.75rem",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--color-glow)",
            pointerEvents: "none",
            zIndex: 10,
            boxShadow: "0 0 14px rgba(107, 230, 193, 0.18)",
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

      {/* Low-oxygen pulse */}
      {lowOxygen && (
        <motion.div
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.15, 0.3, 0.15] }}
          transition={{ repeat: Number.POSITIVE_INFINITY, duration: 1.1 }}
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse at center, transparent 55%, rgba(255, 107, 107, 0.18) 100%)",
            pointerEvents: "none",
            zIndex: 5,
          }}
        />
      )}

      {/* Threat flash */}
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

      <MuteButton />
    </>
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
        borderRadius: 999,
        background: "rgba(10, 26, 46, 0.72)",
        border: "1px solid rgba(107, 230, 193, 0.25)",
        color: muted ? "var(--color-fg-muted)" : "var(--color-glow)",
        fontSize: "1rem",
        fontFamily: "var(--font-body)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "auto",
        zIndex: 10,
        cursor: "pointer",
      }}
    >
      {muted ? "🔇" : "🔊"}
    </button>
  );
}
