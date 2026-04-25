import type { SessionMode } from "@/sim/_shared/sessionMode";
import { type Numeric, resolveNumeric } from "@/sim/_shared/variance";
import { GAME_DURATION } from "@/sim/dive/constants";

/**
 * Single declarative source of truth for what makes a dive mode different.
 * Everything that branches on mode — the sim, the spawner, the AI manager,
 * the player controller — reads from this record. Modes are *compositions*
 * of slot values, not nests of `if mode === "arena"` branches.
 *
 * **Numeric variance.** Per-dive challenge variety comes from the seed,
 * not from authored constants. Numeric balance knobs are declared as
 * `[min, max]` ranges in `MODE_TEMPLATES`. `resolveModeSlots(mode, seed)`
 * realises the template into concrete `ModeSlots` by drawing each value
 * from its range with a tagged subseed of the dive seed. Two dives with
 * the same seed always resolve to identical slots; two dives with
 * different seeds always sample independently.
 *
 * Categorical knobs (movement, completion condition, threat pattern,
 * etc.) stay authored — they're the mode's *contract*, not its
 * difficulty. Numeric knobs are the difficulty.
 *
 * **No fallback seed.** Every caller MUST pass a real dive seed. There
 * is no default. If a caller can't produce a seed, that's a bug at the
 * call site, not something this module papers over.
 */

export interface ModeSlots {
  // ── Player movement ──────────────────────────────────────────────────────
  /** False = the sub is dragged downward by the trench at a fixed pace. */
  verticalMovement: "free" | "forced-descent" | "locked";
  /** False = lateral input is ignored (e.g. a pure auto-runner mode). */
  lateralMovement: "free" | "locked";

  // ── Completion + progression ────────────────────────────────────────────
  /** What ends the dive successfully. `infinite` = there is no completion. */
  completionCondition: "infinite" | "depth_goal" | "clear_room";
  /** When `completionCondition === "depth_goal"` this is the target depth. */
  targetDepthMeters: number | null;
  /** Hard cap on descent. Null = no ceiling. */
  depthCeilingMeters: number | null;
  /** What happens when the player surfaces past the trench rim. */
  scoringModel: "raw" | "depth-multiplied";
  /** Shape of the difficulty curve as depth grows. */
  difficultyScaling: "none" | "logarithmic" | "linear";

  // ── Threats ──────────────────────────────────────────────────────────────
  /** Do new threats spawn as chunks load? */
  respawnThreats: boolean;
  /** Pattern factory the spawner picks per chunk. */
  threatPattern: "scattered" | "swarm" | "shoal-press";

  // ── Survivability ────────────────────────────────────────────────────────
  /** True = a single contact ends the dive (arena rules). */
  collisionEndsDive: boolean;
  /** Seconds of post-impact invulnerability between hits. */
  impactGraceSeconds: number;
  /** Oxygen penalty applied per impact when `collisionEndsDive === false`. */
  impactOxygenPenaltySeconds: number;
  /** Multiplier on threat collision radius — sharpens or softens contact. */
  threatRadiusScale: number;
  /** Multiplier on oxygen gained from collection. */
  collectionOxygenScale: number;

  // ── Enemy AI scaling ─────────────────────────────────────────────────────
  predatorSpeedScale: number;
  pirateSpeedScale: number;

  // ── Run length ───────────────────────────────────────────────────────────
  /** Base oxygen budget in seconds (battery upgrades stack on top). */
  durationSeconds: number;
}

/**
 * Authored shape — every numeric balance knob may be a range. Fields
 * that are load-bearing for the mode's contract (e.g. Arena's
 * `impactOxygenPenaltySeconds: 0` — there's no grace, contact ends the
 * dive) stay as fixed numbers; making them ranges would break the
 * mode's identity, not its difficulty.
 */
interface ModeSlotsTemplate
  extends Omit<
    ModeSlots,
    | "targetDepthMeters"
    | "depthCeilingMeters"
    | "impactGraceSeconds"
    | "impactOxygenPenaltySeconds"
    | "threatRadiusScale"
    | "collectionOxygenScale"
    | "predatorSpeedScale"
    | "pirateSpeedScale"
    | "durationSeconds"
  > {
  targetDepthMeters: Numeric | null;
  depthCeilingMeters: Numeric | null;
  impactGraceSeconds: Numeric;
  impactOxygenPenaltySeconds: Numeric;
  threatRadiusScale: Numeric;
  collectionOxygenScale: Numeric;
  predatorSpeedScale: Numeric;
  pirateSpeedScale: Numeric;
  durationSeconds: Numeric;
}

const MODE_TEMPLATES: Record<SessionMode, ModeSlotsTemplate> = {
  exploration: {
    // Exploration's contract is "drift, observe, breathe." Numeric
    // variance keeps each chart feeling like a different mood, not a
    // different game.
    verticalMovement: "free",
    lateralMovement: "free",
    completionCondition: "infinite",
    targetDepthMeters: null,
    depthCeilingMeters: null,
    scoringModel: "raw",
    difficultyScaling: "none",
    respawnThreats: false,
    threatPattern: "scattered",
    collisionEndsDive: false,
    impactGraceSeconds: [6, 10],
    impactOxygenPenaltySeconds: [6, 10],
    threatRadiusScale: [0.55, 0.75],
    collectionOxygenScale: [1.4, 1.8],
    predatorSpeedScale: [0.5, 0.65],
    pirateSpeedScale: [0.5, 0.65],
    durationSeconds: [780, 1020],
  },
  descent: {
    // Descent: a vertical-only sounding to a depth picked per dive.
    // Target depth especially — every codename names a different
    // challenge depth so 'Ember Hyacinth Halocline' might want 1820m
    // while 'Ash Coral Plateau' wants 1280m.
    verticalMovement: "free",
    lateralMovement: "locked",
    completionCondition: "depth_goal",
    targetDepthMeters: [1200, 2400],
    depthCeilingMeters: null,
    scoringModel: "depth-multiplied",
    difficultyScaling: "logarithmic",
    respawnThreats: true,
    threatPattern: "scattered",
    collisionEndsDive: false,
    impactGraceSeconds: [4, 8],
    impactOxygenPenaltySeconds: [18, 30],
    threatRadiusScale: [0.75, 1.05],
    collectionOxygenScale: [0.95, 1.25],
    predatorSpeedScale: [0.85, 1.15],
    pirateSpeedScale: [0.85, 1.15],
    durationSeconds: [GAME_DURATION - 60, GAME_DURATION + 120],
  },
  arena: {
    // Arena strings together clear-to-advance pockets. Per-dive
    // variance lives in threat geometry and oxygen pace; the
    // collision-ends-dive contract + zero grace + zero penalty are
    // the *definition* of Arena and stay fixed.
    verticalMovement: "free",
    lateralMovement: "free",
    completionCondition: "infinite",
    targetDepthMeters: null,
    depthCeilingMeters: null,
    scoringModel: "raw",
    difficultyScaling: "logarithmic",
    respawnThreats: true,
    threatPattern: "shoal-press",
    collisionEndsDive: true,
    impactGraceSeconds: 0,
    impactOxygenPenaltySeconds: 0,
    threatRadiusScale: [1.15, 1.45],
    collectionOxygenScale: [0.6, 0.9],
    predatorSpeedScale: [1.1, 1.4],
    pirateSpeedScale: [1.1, 1.4],
    durationSeconds: [420, 540],
  },
};

/**
 * Resolve a mode's authored template into concrete `ModeSlots` for a
 * specific dive seed. Categorical fields pass through unchanged;
 * numeric fields with `[min, max]` ranges are sampled with a per-knob
 * tagged subseed so draws are stable and independent.
 */
export function resolveModeSlots(mode: SessionMode, seed: number): ModeSlots {
  const t = MODE_TEMPLATES[mode];
  return {
    verticalMovement: t.verticalMovement,
    lateralMovement: t.lateralMovement,
    completionCondition: t.completionCondition,
    targetDepthMeters:
      t.targetDepthMeters === null
        ? null
        : resolveNumeric(t.targetDepthMeters, seed, `${mode}:targetDepth`, true),
    depthCeilingMeters:
      t.depthCeilingMeters === null
        ? null
        : resolveNumeric(t.depthCeilingMeters, seed, `${mode}:depthCeiling`, true),
    scoringModel: t.scoringModel,
    difficultyScaling: t.difficultyScaling,
    respawnThreats: t.respawnThreats,
    threatPattern: t.threatPattern,
    collisionEndsDive: t.collisionEndsDive,
    impactGraceSeconds: resolveNumeric(
      t.impactGraceSeconds,
      seed,
      `${mode}:impactGrace`,
    ),
    impactOxygenPenaltySeconds: resolveNumeric(
      t.impactOxygenPenaltySeconds,
      seed,
      `${mode}:impactPenalty`,
    ),
    threatRadiusScale: resolveNumeric(
      t.threatRadiusScale,
      seed,
      `${mode}:threatRadius`,
    ),
    collectionOxygenScale: resolveNumeric(
      t.collectionOxygenScale,
      seed,
      `${mode}:collectionOxygen`,
    ),
    predatorSpeedScale: resolveNumeric(
      t.predatorSpeedScale,
      seed,
      `${mode}:predatorSpeed`,
    ),
    pirateSpeedScale: resolveNumeric(
      t.pirateSpeedScale,
      seed,
      `${mode}:pirateSpeed`,
    ),
    durationSeconds: Math.round(
      resolveNumeric(t.durationSeconds, seed, `${mode}:duration`),
    ),
  };
}

/**
 * The only public API. Call sites that don't know a seed at the moment
 * they need slot values are wrong — fix the call site, don't add a
 * fallback here.
 */
export const getModeSlots = resolveModeSlots;

/**
 * The authored templates are exported for tests + tooling that needs to
 * inspect the *envelope* of legal values per mode (e.g. asserting that
 * for any seed, Descent's resolved oxygen budget falls inside the
 * authored range). Production code should call `resolveModeSlots(mode,
 * seed)` and read the resolved values, not poke at templates.
 */
export { MODE_TEMPLATES };
