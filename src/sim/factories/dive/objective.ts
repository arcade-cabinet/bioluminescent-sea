import type { SessionMode } from "@/sim/_shared/sessionMode";
import type { RegionArchetypeId } from "@/sim/factories/region/archetypes";

/**
 * What kind of goal an Objective tracks. Each kind has its own
 * progress function over the live SceneState — the engine never
 * branches on "is this the descent mode?", it only asks the kind
 * handler for progress.
 */
export type ObjectiveKind =
  | "collect-beacons-in-region" // chart N creatures while inside `regionId`
  | "reach-depth" // descend below `target` meters
  | "clear-regions" // complete every region in the current dive
  | "sustain-chain"; // hold a chain of `target`+ for any length

/**
 * An Objective ties a goal to a *place*. Authored data. The engine
 * produces a ObjectiveProgress wrapper at dive start and advances
 * `current` each frame; when `current >= target` the next objective
 * activates.
 */
export interface Objective {
  readonly id: string;
  /** Player-facing one-line label shown above the progress bar. */
  readonly label: string;
  readonly kind: ObjectiveKind;
  /** Where this objective lives — drives the HUD's area context. */
  readonly regionId?: RegionArchetypeId;
  /** Player-facing area copy ("Photic Gate"). */
  readonly areaLabel: string;
  /** Target counter. Semantics depend on kind. */
  readonly target: number;
}

/**
 * Runtime state attached to SceneState.objectiveQueue. The engine owns
 * mutation; the HUD owns read. `completed` flips when
 * `current >= objective.target`.
 */
export interface ObjectiveProgress {
  objective: Objective;
  current: number;
  completed: boolean;
}

/**
 * The author-time recipe a dive archetype pulls in to seed its queue.
 */
export interface ObjectiveSet {
  readonly id: string;
  readonly mode: SessionMode;
  readonly queue: readonly Objective[];
}

const EXPLORATION_OBJECTIVES: ObjectiveSet = {
  id: "exploration-default",
  mode: "exploration",
  queue: [
    {
      id: "photic-3",
      label: "Chart three beacons in the Photic Gate",
      kind: "collect-beacons-in-region",
      regionId: "photic-gate",
      areaLabel: "Photic Gate",
      target: 3,
    },
    {
      id: "twilight-3",
      label: "Chart three beacons on the Twilight Shelf",
      kind: "collect-beacons-in-region",
      regionId: "twilight-shelf",
      areaLabel: "Twilight Shelf",
      target: 3,
    },
    {
      id: "chain-4",
      label: "Sustain a chain of four",
      kind: "sustain-chain",
      areaLabel: "Any depth",
      target: 4,
    },
    {
      id: "explore-abyss",
      label: "Reach the Abyssal Trench",
      kind: "reach-depth",
      areaLabel: "Abyssal Trench",
      target: 900,
    },
  ],
};

const DESCENT_OBJECTIVES: ObjectiveSet = {
  id: "descent-default",
  mode: "descent",
  queue: [
    {
      id: "descent-200",
      label: "Descend to 200m",
      kind: "reach-depth",
      regionId: "photic-gate",
      areaLabel: "Photic Gate",
      target: 200,
    },
    {
      id: "descent-500",
      label: "Cross the Twilight Shelf — 500m",
      kind: "reach-depth",
      regionId: "twilight-shelf",
      areaLabel: "Twilight Shelf",
      target: 500,
    },
    {
      id: "descent-900",
      label: "Plunge to the Trench — 900m",
      kind: "reach-depth",
      regionId: "abyssal-trench",
      areaLabel: "Abyssal Trench",
      target: 900,
    },
  ],
};

const ARENA_OBJECTIVES: ObjectiveSet = {
  id: "arena-default",
  mode: "arena",
  queue: [
    {
      id: "arena-clear",
      label: "Clear every room in the hall",
      kind: "clear-regions",
      regionId: "arena-hall",
      areaLabel: "Arena Hall",
      // target = number of rooms to clear. The engine reads the
      // region's chunk pool depth span / chunk height to derive this.
      target: 3,
    },
  ],
};

export const OBJECTIVE_SETS: Record<SessionMode, ObjectiveSet> = {
  exploration: EXPLORATION_OBJECTIVES,
  descent: DESCENT_OBJECTIVES,
  arena: ARENA_OBJECTIVES,
};

export function getObjectiveSet(mode: SessionMode): ObjectiveSet {
  return OBJECTIVE_SETS[mode];
}

/** Build the initial ObjectiveProgress queue at dive start. */
export function createObjectiveQueue(mode: SessionMode): ObjectiveProgress[] {
  return getObjectiveSet(mode).queue.map((objective) => ({
    objective,
    current: 0,
    completed: false,
  }));
}
