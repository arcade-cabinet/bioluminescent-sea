import { round } from "@/sim/_shared/math";
import type {
  Anomaly,
  Creature,
  Pirate,
  Player,
  Predator,
} from "@/sim/entities/types";
import { CREATURE_OXYGEN_BONUS_SECONDS, CREATURE_POINTS } from "@/sim/entities/types";
import { MAX_CHAIN_MULTIPLIER, STREAK_WINDOW_SECONDS } from "@/sim/dive/constants";
import type { CreatureCollectionResult } from "@/sim/dive/types";

export interface AnomalyCollectionResult {
  collected: Anomaly[];
  anomalies: Anomaly[];
}

export function collectAnomalies(
  anomalies: Anomaly[],
  player: Player,
): AnomalyCollectionResult {
  const collected: Anomaly[] = [];
  const remaining: Anomaly[] = [];

  for (const anomaly of anomalies) {
    const distance = Math.hypot(anomaly.x - player.x, anomaly.y - player.y);

    if (distance < anomaly.size * 0.5 + 30) {
      collected.push(anomaly);
    } else {
      remaining.push(anomaly);
    }
  }

  return { collected, anomalies: remaining };
}
export function collectCreatures(
  creatures: Creature[],
  player: Player,
  totalTime: number,
  lastCollectTime: number,
  currentMultiplier: number,
  oxygenScale = 1
): CreatureCollectionResult {
  const collected: Creature[] = [];
  const remaining: Creature[] = [];
  let multiplier = currentMultiplier;
  let oxygenBonusSeconds = 0;
  let scoreDelta = 0;
  let nextLastCollectTime = lastCollectTime;

  for (const creature of creatures) {
    if (creature.ambient) {
      remaining.push(creature);
      continue;
    }
    const distance = Math.hypot(creature.x - player.x, creature.y - player.y);

    if (distance < creature.size * 0.56 + 30) {
      multiplier = calculateMultiplier(nextLastCollectTime, totalTime, multiplier);
      oxygenBonusSeconds += CREATURE_OXYGEN_BONUS_SECONDS[creature.type] * oxygenScale;
      scoreDelta += CREATURE_POINTS[creature.type] * multiplier;
      nextLastCollectTime = totalTime;
      collected.push(creature);
    } else {
      remaining.push(creature);
    }
  }

  return {
    collected,
    creatures: remaining,
    lastCollectTime: nextLastCollectTime,
    multiplier,
    oxygenBonusSeconds: Math.round(oxygenBonusSeconds),
    scoreDelta,
  };
}

export function calculateMultiplier(
  lastCollectTime: number,
  totalTime: number,
  currentMultiplier: number
): number {
  const hasPreviousCollection = lastCollectTime > 0;
  const stillInChain =
    hasPreviousCollection && totalTime - lastCollectTime <= STREAK_WINDOW_SECONDS;

  if (!stillInChain) return 1;

  return Math.min(currentMultiplier + 1, MAX_CHAIN_MULTIPLIER);
}

export function hasPredatorCollision(
  player: Player,
  predators: Predator[],
  radiusScale = 1
): boolean {
  return predators.some((predator) => {
    const distance = Math.hypot(predator.x - player.x, predator.y - player.y);
    return distance < (predator.size * 0.4 + 25) * radiusScale;
  });
}

export function findNearestThreatDistance(
  player: Player,
  predators: Predator[],
  pirates: Pirate[] = []
): number {
  const predatorDistances = predators.map(
    (predator) => Math.hypot(predator.x - player.x, predator.y - player.y) - predator.size * 0.4
  );
  const pirateDistances = pirates.map(
    (pirate) => Math.hypot(pirate.x - player.x, pirate.y - player.y) - 34
  );
  const nearest = Math.min(...predatorDistances, ...pirateDistances);

  return Number.isFinite(nearest) ? Math.max(0, round(nearest, 2)) : Number.POSITIVE_INFINITY;
}

export function findNearestBeaconVector(
  player: Player,
  creatures: Creature[]
): { bearingRadians: number | null; distance: number } {
  if (creatures.length === 0) {
    return { bearingRadians: null, distance: 0 };
  }

  const nearest = creatures.reduce(
    (best, creature) => {
      const dx = creature.x - player.x;
      const dy = creature.y - player.y;
      const distance = Math.hypot(dx, dy);
      return distance < best.distance ? { bearingRadians: Math.atan2(dy, dx), distance } : best;
    },
    { bearingRadians: null as number | null, distance: Number.POSITIVE_INFINITY }
  );

  return {
    bearingRadians: nearest.bearingRadians,
    distance: Number.isFinite(nearest.distance) ? round(nearest.distance, 2) : 0,
  };
}
