import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface GameOverScreenProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}

/**
 * The surface-break after a dive. Same display-font title as the start
 * screen so the dive feels like a single breath from start to resurface.
 */
export function GameOverScreen({ title, subtitle, children }: GameOverScreenProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        background:
          "radial-gradient(ellipse at center, rgba(14, 79, 85, 0.5), rgba(5, 10, 20, 0.95) 70%)",
        color: "var(--color-fg)",
        textAlign: "center",
        pointerEvents: "auto",
      }}
    >
      <motion.h2
        className="bs-display"
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.8 }}
        style={{
          fontSize: "clamp(2rem, 7vw, 3.75rem)",
          margin: 0,
          fontWeight: 500,
          color: "var(--color-glow)",
          textShadow: "0 0 20px rgba(107, 230, 193, 0.35)",
        }}
      >
        {title}
      </motion.h2>
      {subtitle && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.9 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          style={{
            marginTop: "0.75rem",
            fontSize: "clamp(0.95rem, 2.2vw, 1.1rem)",
            color: "var(--color-fg-muted)",
            maxWidth: "40ch",
          }}
        >
          {subtitle}
        </motion.p>
      )}
      {children && (
        <div
          style={{
            marginTop: "2rem",
            display: "flex",
            gap: "1rem",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {children}
        </div>
      )}
    </motion.div>
  );
}
