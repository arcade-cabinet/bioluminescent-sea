import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { OverlayButton } from "./OverlayButton";

interface StartScreenProps {
  title: string;
  subtitle?: string;
  primaryAction: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
  children?: ReactNode;
}

/**
 * The title-card before a dive. Diegetic — meant to feel like the surface
 * tension of the water you're about to sink through. Display face on the
 * title, Inter body on the tagline, generous breath between elements.
 */
export function StartScreen({
  title,
  subtitle,
  primaryAction,
  secondaryAction,
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
        padding: "2rem",
        background:
          "radial-gradient(ellipse at center, rgba(14, 79, 85, 0.35), rgba(5, 10, 20, 0.9) 70%)",
        color: "var(--color-fg)",
        textAlign: "center",
        pointerEvents: "none",
      }}
    >
      <motion.h1
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.8 }}
        className="bs-display"
        style={{
          fontSize: "clamp(2.5rem, 9vw, 5rem)",
          margin: 0,
          fontWeight: 500,
          color: "var(--color-glow)",
          textShadow: "0 0 24px rgba(107, 230, 193, 0.45)",
        }}
      >
        {title}
      </motion.h1>
      {subtitle && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.85 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          style={{
            marginTop: "0.75rem",
            fontSize: "clamp(0.95rem, 2.4vw, 1.1rem)",
            color: "var(--color-fg-muted)",
            maxWidth: "36ch",
            lineHeight: 1.5,
          }}
        >
          {subtitle}
        </motion.p>
      )}
      {children && (
        <div style={{ marginTop: "2rem", pointerEvents: "auto" }}>{children}</div>
      )}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9, duration: 0.6 }}
        style={{
          marginTop: "2.5rem",
          display: "flex",
          gap: "1rem",
          flexWrap: "wrap",
          justifyContent: "center",
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
