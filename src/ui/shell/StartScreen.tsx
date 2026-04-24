import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { LandingHero } from "./LandingHero";
import { OverlayButton } from "./OverlayButton";

interface StartScreenProps {
  title: string;
  subtitle?: string;
  primaryAction: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
  /**
   * Optional run preview, rendered between the verb chips and the mode
   * picker. Used to show the next dive's codename ("Drowsy Ember
   * Anglerfish") so the shareable run identity is visible before
   * gameplay starts.
   */
  runPreview?: {
    codename: string;
    label?: string;
  };
  children?: ReactNode;
}

/**
 * The title-card before a dive. The *first* thing a player sees — it must
 * orient them in under 15 seconds per the player-journey gate in
 * docs/STANDARDS.md.
 *
 * Layout priority, top to bottom:
 *   1. Display title (Cormorant Garamond, mint, glow)
 *   2. One-sentence subtitle tagline — sets stakes in one breath
 *   3. Three-chip feature teaser ("collect · read the trench · come home")
 *      so a cold player knows the verbs before they see gameplay
 *   4. Mode selector (the `children` slot)
 *   5. Primary CTA ("Begin Dive"), optional secondary (ghost)
 *
 * Everything is staggered via framer-motion so the title reads first,
 * then stakes, then verbs, then choice. ~2 seconds to full paint.
 */
export function StartScreen({
  title,
  subtitle,
  primaryAction,
  secondaryAction,
  runPreview,
  children,
}: StartScreenProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1.5rem",
        background: "var(--color-bg)",
        color: "var(--color-fg)",
        textAlign: "center",
        pointerEvents: "none",
      }}
    >
      {/* Canvas hero — animated abyss with bioluminescent sparks and a
          drifting submersible silhouette. Paints behind the text so the
          landing reads as a living trench, not a gradient card. */}
      <LandingHero />

      <motion.h1
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.8 }}
        className="bs-display"
        style={{
          position: "relative",
          fontSize: "clamp(2.5rem, 9vw, 5rem)",
          margin: 0,
          fontWeight: 500,
          color: "var(--color-glow)",
          textShadow:
            "0 0 24px rgba(107, 230, 193, 0.45), 0 0 48px rgba(107, 230, 193, 0.18)",
          letterSpacing: "0.01em",
        }}
      >
        {title}
      </motion.h1>

      {subtitle && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.88 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          style={{
            position: "relative",
            marginTop: "1rem",
            fontSize: "clamp(0.95rem, 2.4vw, 1.1rem)",
            color: "var(--color-fg-muted)",
            maxWidth: "42ch",
            lineHeight: 1.55,
          }}
        >
          {subtitle}
        </motion.p>
      )}

      {/* Verbs teaser — three short chips to pre-teach the loop */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.75, duration: 0.6 }}
        style={{
          position: "relative",
          marginTop: "1.75rem",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "0.5rem",
        }}
      >
        {[
          { icon: "◉", text: "Collect bioluminescence" },
          { icon: "⟡", text: "Read the bottom banner" },
          { icon: "⇡", text: "Surface before oxygen ends" },
        ].map((verb) => (
          <div
            key={verb.text}
            style={{
              padding: "0.4rem 0.8rem",
              border: "1px solid rgba(107, 230, 193, 0.25)",
              borderRadius: 999,
              fontFamily: "var(--font-body)",
              fontSize: "0.72rem",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--color-glow)",
              background: "rgba(10, 26, 46, 0.4)",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
            }}
          >
            <span style={{ opacity: 0.7 }}>{verb.icon}</span>
            <span>{verb.text}</span>
          </div>
        ))}
      </motion.div>

      {runPreview && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.95, duration: 0.55 }}
          style={{
            position: "relative",
            marginTop: "1.5rem",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.3rem",
          }}
        >
          <span
            style={{
              fontSize: "0.62rem",
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              color: "var(--color-fg-muted)",
              opacity: 0.75,
            }}
          >
            {runPreview.label ?? "Your next trench"}
          </span>
          <span
            className="bs-display"
            style={{
              fontSize: "clamp(1.15rem, 3.4vw, 1.55rem)",
              color: "var(--color-glow)",
              letterSpacing: "0.02em",
              textShadow: "0 0 18px rgba(107, 230, 193, 0.35)",
            }}
          >
            {runPreview.codename}
          </span>
        </motion.div>
      )}

      {children && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.0, duration: 0.5 }}
          style={{
            position: "relative",
            marginTop: "1.5rem",
            pointerEvents: "auto",
          }}
        >
          {children}
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.25, duration: 0.6 }}
        style={{
          position: "relative",
          marginTop: "2.25rem",
          display: "flex",
          gap: "1rem",
          flexWrap: "wrap",
          justifyContent: "center",
          pointerEvents: "auto",
        }}
      >
        <OverlayButton onClick={primaryAction.onClick}>
          {primaryAction.label}
        </OverlayButton>
        {secondaryAction && (
          <OverlayButton variant="ghost" onClick={secondaryAction.onClick}>
            {secondaryAction.label}
          </OverlayButton>
        )}
      </motion.div>
    </motion.div>
  );
}

