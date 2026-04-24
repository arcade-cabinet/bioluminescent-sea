import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { StatTile, type StatTileProps } from "@/ui/primitives";

interface GameOverScreenProps {
  title: string;
  subtitle?: string;
  stats?: StatTileProps[];
  children?: ReactNode;
}

/**
 * The surface-break after a dive. Same display-font title as the start
 * screen so the dive feels like a single breath from start to resurface.
 */
export function GameOverScreen({ title, subtitle, stats, children }: GameOverScreenProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
      className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-8 text-center text-fg pointer-events-auto"
      style={{
        background:
          "radial-gradient(ellipse at center, rgba(14, 79, 85, 0.5), rgba(5, 10, 20, 0.95) 70%)",
      }}
    >
      <motion.h2
        className="bs-display m-0 text-glow"
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.8 }}
        style={{
          fontSize: "clamp(2rem, 7vw, 3.75rem)",
          fontWeight: 500,
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
          className="m-0 max-w-[42ch] text-fg-muted leading-relaxed"
          style={{ fontSize: "clamp(0.95rem, 2.2vw, 1.1rem)" }}
        >
          {subtitle}
        </motion.p>
      )}

      {stats && stats.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.6 }}
          className="grid w-full max-w-md grid-cols-2 gap-2"
          data-testid="gameover-stats"
        >
          {stats.map((stat) => (
            <StatTile key={stat.label} {...stat} />
          ))}
        </motion.div>
      )}

      {children && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.5 }}
          className="flex flex-wrap items-center justify-center gap-3"
        >
          {children}
        </motion.div>
      )}
    </motion.div>
  );
}
