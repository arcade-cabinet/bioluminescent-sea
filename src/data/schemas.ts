import { z } from "zod";

/**
 * Zod schemas for authored content in config/raw/*.json.
 *
 * Any field read from JSON flows through these schemas; `safeParse`
 * failures fail loud at content-compile time (scripts/compile-content.mjs)
 * and again at runtime module load as a guard against drift.
 */

export const BiomeSchema = z.object({
  id: z.enum([
    "epipelagic",
    "mesopelagic",
    "bathypelagic",
    "abyssopelagic",
    "hadopelagic",
  ]),
  label: z.string().min(1),
  scientificName: z.string().min(1),
  description: z.string().min(1),
  depthStartMeters: z.number().int().min(0),
  depthEndMeters: z.number().int().positive(),
  tintHex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  /** 0..1 — ambient sunlight reaching this zone. 1 = surface. */
  lightLevel: z.number().min(0).max(1),
  /** 0..1 — how clear the water reads. 1 = pristine. */
  waterClarity: z.number().min(0).max(1),
  creatureDensity: z.number().min(0).max(2),
  predatorDensity: z.number().min(0).max(2),
  pirateDensity: z.number().min(0).max(2),
  /**
   * Real-world ecology atlas for this depth zone. Drives creature /
   * predator / ambient archetype selection in the factory pyramid —
   * each ID in these arrays corresponds to an actor archetype tagged
   * for that biome. Authored, not computed.
   */
  ecology: z.object({
    collectibles: z.array(z.string().min(1)),
    predators: z.array(z.string().min(1)),
    ambient: z.array(z.string().min(1)),
    lightSources: z.string().min(1),
  }),
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
  biome: z.enum([
    "epipelagic",
    "mesopelagic",
    "bathypelagic",
    "abyssopelagic",
    "hadopelagic",
  ]),
  flavor: z.string().min(1),
});

export type BiomeJson = z.infer<typeof BiomeSchema>;
export type CreatureSpeciesJson = z.infer<typeof CreatureSpeciesSchema>;
export type LandmarkJson = z.infer<typeof LandmarkSchema>;
