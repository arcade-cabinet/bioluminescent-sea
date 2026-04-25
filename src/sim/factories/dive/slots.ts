import type { SessionMode } from "@/sim/_shared/sessionMode";
import { GAME_DURATION } from "@/sim/dive/constants";

/**
 * Single declarative source of truth for what makes a dive mode different.
 * Everything that branches on mode — the sim, the spawner, the AI manager,
 * the player controller — reads from this record. Modes are *compositions*
 * of slot values, not nests of `if mode === "arena"` branches.
 *
 * Adding a new mode means adding a `ModeSlots` entry. Adding a new gameplay
 * dimension means adding a slot here and a single branch where it's read.
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
 * Authored slot values per mode. This is the *only* place each mode is
 * defined. The legacy `DiveModeTuning` shape is derived from this record so
 * callers built before the slot split keep working without churn.
 */
export const MODE_SLOTS: Record<SessionMode, ModeSlots> = {
  exploration: {
    // Exploration's contract is "drift, observe, breathe." Numbers
    // here lean toward forgiveness: long grace between hits, small
    // penalty when one lands, threats patrol slowly and disengage
    // quickly, oxygen budget is the longest of the three modes.
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
    impactGraceSeconds: 8,
    impactOxygenPenaltySeconds: 8,
    threatRadiusScale: 0.65,
    collectionOxygenScale: 1.6,
    predatorSpeedScale: 0.55,
    pirateSpeedScale: 0.55,
    durationSeconds: 900,
  },
  descent: {
    // Descent is a vertical-only dive: player can freely pick how fast
    // to sink (including stop), but the trench current holds them on a
    // fixed lateral heading. Threats escalate logarithmically with
    // depth until the player touches the floor.
    //
    // Penalty was 45s — cripplingly punitive given a single missed
    // dodge in a lateral-locked sub. Cut to 25s with longer grace
    // (6s) so the player feels pressure but a slip doesn't end the
    // dive.
    verticalMovement: "free",
    lateralMovement: "locked",
    completionCondition: "depth_goal",
    targetDepthMeters: 1500,
    depthCeilingMeters: null,
    scoringModel: "depth-multiplied",
    difficultyScaling: "logarithmic",
    respawnThreats: true,
    threatPattern: "scattered",
    collisionEndsDive: false,
    impactGraceSeconds: 6,
    impactOxygenPenaltySeconds: 25,
    threatRadiusScale: 0.9,
    collectionOxygenScale: 1.1,
    predatorSpeedScale: 1,
    pirateSpeedScale: 1,
    // Single source of truth: pull from GAME_DURATION so tuning that
    // constant flows through cleanly. The mode.ts adapter no longer
    // overrides this.
    durationSeconds: GAME_DURATION,
  },
  arena: {
    // Arena strings together clear-to-advance pockets: each locked-
    // room chunk traps the player until the shoal is thinned, then the
    // direction they swim (any edge) unlocks the adjacent pocket.
    // Infinite traversal; difficulty climbs logarithmically. The dive
    // is "done" only when a collision ends it — no finish line.
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
    threatRadiusScale: 1.3,
    collectionOxygenScale: 0.75,
    predatorSpeedScale: 1.25,
    pirateSpeedScale: 1.25,
    durationSeconds: 480,
  },
};

export function getModeSlots(mode: SessionMode): ModeSlots {
  return MODE_SLOTS[mode];
}
