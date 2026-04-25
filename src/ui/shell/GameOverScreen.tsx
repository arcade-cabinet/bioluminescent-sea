import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { EmbossFilters, StatTile, type StatTileProps } from "@/ui/primitives";

interface GameOverScreenProps {
  title: string;
  subtitle?: string;
  stats?: StatTileProps[];
  children?: ReactNode;
}

/**
 * Surface-break after a dive. The chrome is the trench: a soft mint
 * vignette wash, the title floats engraved into the water, stats
 * flow as ink on a chart. No tiles, no boxes — same identity rules
 * as the landing.
 */
export function GameOverScreen({ title, subtitle, stats, children }: GameOverScreenProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
      className="absolute inset-0 flex flex-col items-center justify-center gap-7 p-8 text-center text-fg pointer-events-auto"
      style={{
        // Single soft mint wash from the centre — reads as a column of
        // light from the surface punching through to where the player
        // resurfaces. No hard ellipse, no rectangular vignette.
        background:
          "radial-gradient(ellipse at center, rgba(14, 79, 85, 0.35) 0%, rgba(5, 10, 20, 0.85) 60%, rgba(2, 6, 17, 0.95) 100%)",
      }}
    >
      <EmbossFilters />

      <motion.h2
        className="bs-display m-0 text-glow"
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.8 }}
        style={{
          fontSize: "clamp(2.2rem, 7vw, 4rem)",
          fontWeight: 500,
          letterSpacing: "0.12em",
          filter: "url(#bs-emboss-glow)",
          textShadow:
            "0 0 22px rgba(107,230,193,0.55), 0 0 44px rgba(107,230,193,0.22), 0 2px 0 rgba(2,6,17,0.6)",
        }}
      >
        {title}
      </motion.h2>

      {subtitle && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.9 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="m-0 max-w-[44ch] italic text-fg leading-relaxed"
          style={{
            fontFamily: "var(--font-body)",
            fontWeight: 300,
            fontSize: "clamp(0.95rem, 2.2vw, 1.1rem)",
            filter: "url(#bs-soft-glow)",
            textShadow: "0 0 12px rgba(2,6,17,0.85), 0 1px 0 rgba(2,6,17,0.5)",
          }}
        >
          {subtitle}
        </motion.p>
      )}

      {stats && stats.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.6 }}
          // Stats flow horizontally across a single row when there's
          // room — no grid, no tiles. Each readout is type-on-water.
          className="flex w-full max-w-2xl flex-wrap items-center justify-center gap-x-8 gap-y-3"
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
          className="flex flex-wrap items-center justify-center gap-4"
        >
          {children}
        </motion.div>
      )}
    </motion.div>
  );
}
