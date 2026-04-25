import { z } from "zod";

/**
 * Zod schemas for authored content in config/raw/*.json.
 *
 * Any field read from JSON flows through these schemas; `safeParse`
 * failures fail loud at content-compile time (scripts/compile-content.mjs)
 * and again at runtime module load as a guard against drift.
 */

export const BiomeSchema = z.object({
  id: z.enum(["photic-gate", "twilight-shelf", "midnight-column", "abyssal-trench"]),
  label: z.string().min(1),
  description: z.string().min(1),
  depthStartMeters: z.number().int().min(0),
  depthEndMeters: z.number().int().positive(),
  tintHex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  creatureDensity: z.number().min(0).max(2),
  predatorDensity: z.number().min(0).max(2),
  pirateDensity: z.number().min(0).max(2),
});

export const CreatureSpeciesSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["jellyfish", "plankton", "fish"]),
  baseScore: z.number().int().nonnegative(),
  oxygenBonusSeconds: z.number().int().nonnegative(),
  glowColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  sizeMeters: z.object({
    min: z.number().positive(),
    max: z.number().positive(),
  }),
});

export const LandmarkSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  depthMeters: z.number().int().positive(),
  biome: z.enum(["photic-gate", "twilight-shelf", "midnight-column", "abyssal-trench"]),
  flavor: z.string().min(1),
});

export type BiomeJson = z.infer<typeof BiomeSchema>;
export type CreatureSpeciesJson = z.infer<typeof CreatureSpeciesSchema>;
export type LandmarkJson = z.infer<typeof LandmarkSchema>;
