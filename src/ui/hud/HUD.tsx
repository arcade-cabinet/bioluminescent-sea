import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
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

const clusterStyle: CSSProperties = {
  display: "flex",
  alignItems: "stretch",
  gap: 0,
  background: "rgba(10, 26, 46, 0.72)",
  border: "1px solid rgba(107, 230, 193, 0.2)",
  borderRadius: 12,
  padding: "0.5rem 0.25rem",
  color: "var(--color-fg)",
  fontFamily: "var(--font-body)",
  boxShadow: "0 4px 18px rgba(5, 10, 20, 0.45)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  minWidth: 0,
  overflow: "hidden",
};

const statCellStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  minWidth: 0,
  padding: "0 0.6rem",
};

const dividerStyle: CSSProperties = {
  width: 1,
  background: "rgba(107, 230, 193, 0.18)",
  margin: "0.1rem 0",
};

const labelStyle: CSSProperties = {
  fontSize: "0.58rem",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.14em",
  color: "var(--color-fg-muted)",
  margin: 0,
  marginBottom: "0.1rem",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const valueStyle: CSSProperties = {
  fontSize: "1.2rem",
  fontWeight: 600,
  lineHeight: 1.1,
  color: "var(--color-fg)",
  margin: 0,
  fontFeatureSettings: "\"tnum\"",
  whiteSpace: "nowrap",
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
  const toneColor =
    tone === "warn"
      ? "var(--color-warn)"
      : tone === "muted"
        ? "var(--color-fg-muted)"
        : "var(--color-glow)";
  return (
    <div data-testid={`hud-stat-${testId}`} style={statCellStyle}>
      <div style={{ ...labelStyle, color: toneColor }}>{label}</div>
      <div style={{ ...valueStyle, color: tone === "warn" ? toneColor : "var(--color-fg)" }}>
        {value}
      </div>
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
  // Oxygen progression: comfortable → warn (< 25%) → critical (< 10%).
  // The critical stage adds a distinct "hold your breath" finale banner
  // above the stat row so the player sees one more beat before the run
  // surfaces or ends. Pure visual; does not change sim behavior.
  const critical = oxygenRatio < 0.1;
  const lowOxygen = oxygenRatio < 0.25;

  // Biome transition banner — flashes center-screen for ~2.2s when
  // the biome shifts during descent. Silent when biomeLabel hasn't
  // changed; fires on first real biome too (photic-gate) so the
  // player sees the frame they're entering.
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
      {/* Top stat cluster — grouped as a single pill so the five cells
          share one surround. Much easier to read than the old five
          independent panels, and stays on one row down to 320px. */}
      <div
        style={{
          position: "absolute",
          top: "max(env(safe-area-inset-top), 1rem)",
          left: "1rem",
          right: "1rem",
          display: "flex",
          justifyContent: "flex-start",
          pointerEvents: "none",
          zIndex: 10,
        }}
      >
        <div
          data-testid="hud-stat-cluster"
          style={{
            ...clusterStyle,
            borderColor: lowOxygen
              ? "rgba(255, 107, 107, 0.45)"
              : "rgba(107, 230, 193, 0.2)",
          }}
        >
          <StatCell label="Score" value={score} testId="score" />
          <div style={dividerStyle} />
          <StatCell
            label={critical ? "O₂ critical" : lowOxygen ? "O₂ low" : "Oxygen"}
            value={`${Math.max(0, timeLeft).toFixed(0)}s`}
            tone={lowOxygen ? "warn" : "glow"}
            testId="oxygen"
          />
          <div style={dividerStyle} />
          <StatCell label="Chain" value={`×${multiplier}`} testId="chain" />
          <div style={dividerStyle} />
          <StatCell label="Depth" value={`${depthMeters}m`} tone="muted" testId="depth" />
          <div style={dividerStyle} />
          <StatCell label="Charted" value={`${beacons}%`} tone="muted" testId="charted" />
        </div>
      </div>

      {/* Right-side chip stack — landmark + biome + run codename.
          Grouped in one column so they never collide with the
          top-left HUD row when it wraps on narrow viewports. The
          codename is last (smallest, muted) because it's identity,
          not information the player needs frame-to-frame. */}
      <div
        style={{
          position: "absolute",
          top: "max(env(safe-area-inset-top), 1rem)",
          right: "1rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: "0.35rem",
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
              padding: "0.5rem 0.75rem",
              background: "rgba(14, 79, 85, 0.65)",
              border: "1px solid rgba(107, 230, 193, 0.3)",
              borderRadius: 999,
              fontFamily: "var(--font-body)",
              fontSize: "0.75rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--color-glow)",
              boxShadow: "0 0 14px rgba(107, 230, 193, 0.18)",
              whiteSpace: "nowrap",
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
              padding: "0.3rem 0.65rem",
              background: "rgba(10, 26, 46, 0.55)",
              border: `1px solid ${biomeTintHex ?? "#6be6c1"}55`,
              borderRadius: 999,
              fontFamily: "var(--font-body)",
              fontSize: "0.65rem",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: biomeTintHex ?? "var(--color-glow)",
              whiteSpace: "nowrap",
            }}
          >
            {biomeLabel}
          </motion.div>
        )}
        {runCodename && (
          <div
            data-testid="hud-codename-chip"
            style={{
              padding: "0.25rem 0.6rem",
              background: "rgba(10, 26, 46, 0.45)",
              border: "1px solid rgba(107, 230, 193, 0.14)",
              borderRadius: 999,
              fontFamily: "var(--font-display)",
              fontSize: "0.68rem",
              letterSpacing: "0.04em",
              color: "var(--color-fg-muted)",
              whiteSpace: "nowrap",
              maxWidth: "min(60vw, 220px)",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {runCodename}
          </div>
        )}
      </div>

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

      {critical && <CriticalBreathBanner />}

      {/* Biome transition banner — fires briefly when the biome
          shifts as the sub descends. Gives the player a clear
          beat of "you're now in X" without re-stating it every
          frame. Dismisses itself after 2.2s. */}
      {/* Biome transition toast — slim pill above the HUD stat cluster.
          The prior 3.25rem center-screen banner blocked the playfield
          on every dive start (the first frame of each dive triggers a
          biome change). The toast version surfaces the transition
          without hiding the world; auto-dismisses after 2.2s. */}
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
              gap: "0.5rem",
              padding: "0.35rem 0.85rem",
              background: "color-mix(in srgb, var(--color-abyss) 82%, transparent)",
              border: `1px solid ${biomeTintHex ?? "#6be6c1"}55`,
              borderRadius: 999,
              boxShadow:
                "0 4px 18px color-mix(in srgb, var(--color-bg) 45%, transparent)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "0.55rem",
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: biomeTintHex ?? "var(--color-glow)",
                opacity: 0.78,
              }}
            >
              Entering
            </span>
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "0.95rem",
                fontWeight: 500,
                color: "var(--color-fg)",
                letterSpacing: "0.02em",
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
 * Final "hold your breath" beat between the oxygen-low warning and the
 * ascent. Fires when oxygenRatio drops below 10%; sits just above the
 * objective banner at the bottom of the viewport where the player's
 * eye is already landing. Copy is a single cartographer-voice
 * sentence — no alarm, no shouted all-caps.
 *
 * Positioning was originally top-center, but on mobile portrait the
 * wrapping stat row would push the banner into the playfield and
 * overlap the landmark chip. Bottom-center keeps it out of the
 * HUD-chip area on any viewport.
 */
function CriticalBreathBanner() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{
        opacity: [0.75, 1, 0.75],
        y: 0,
      }}
      transition={{
        opacity: { duration: 1.6, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" },
        y: { duration: 0.4, ease: "easeOut" },
      }}
      style={{
        position: "absolute",
        bottom: "calc(max(env(safe-area-inset-bottom), 1rem) + 4.5rem)",
        left: "50%",
        transform: "translateX(-50%)",
        padding: "0.55rem 1.1rem",
        background: "rgba(40, 8, 8, 0.78)",
        border: "1px solid var(--color-warn)",
        borderRadius: 8,
        fontFamily: "var(--font-display)",
        fontSize: "clamp(0.92rem, 2.6vw, 1.1rem)",
        letterSpacing: "0.04em",
        color: "var(--color-warn)",
        textShadow: "0 0 14px rgba(255, 107, 107, 0.55)",
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
