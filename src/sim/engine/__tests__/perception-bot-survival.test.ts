import { describe, expect, test } from "vitest";
import { advancePlayer } from "@/sim/entities/player";
import {
  type DiveInput,
  advanceScene,
  createInitialScene,
  getDiveDurationSeconds,
  resolveDiveThreatImpact,
  resetAIManager,
  type SceneState,
} from "@/sim/dive";
import {
  createCollectBeaconsProfile,
  createGoapBrainOwner,
  GoapInputProvider,
  type PlayerInputProvider,
} from "@/sim/ai";

/**
 * Player-journey gate for Spec 1 (perception layer).
 *
 * The pre-perception baseline measured a `createCollectBeaconsProfile`
 * GOAP bot surviving exploration mode at near-100% across the seeds
 * below — the bot is omniscient: it reads `scene.predators` directly,
 * dodges threats it could never see in-game, and hovers at the
 * beacon-stream peak indefinitely. That bot is useless as a launch-
 * readiness gate because it solves challenges a real player cannot.
 *
 * Once the perception layer lands (Spec 1c), the same bot can only
 * see what its `PLAYER_PERCEPTION_PROFILE` permits: a 520px radius,
 * occluded by leviathans + repel debris + locked-room walls. Survival
 * must drop into the 55–75% band averaged across 5 seeds.
 *
 * Five seeds are run because a single seed can place debris/leviathans
 * on a path that's geometry-neutral (survival 90%+) or geometry-hostile
 * (survival ≤40%). The 55–75% band is on the *average* across seeds.
 *
 * The seed list and the 55–75% band are derived from the existing
 * playtest captured 2026-04-23 — the human-pilot survival rate on
 * exploration mode at 60s mark across the same seeds was 60–70%.
 * The bot must land in that human band, slightly wider on each side
 * to absorb GOAP-vs-human variance.
 */

const SEEDS = [0xCAFE, 0xBEEF, 0xFACE, 0xFEED, 0xC0DE] as const;
const SURVIVAL_RUN_SECONDS = 60;
const FRAMES_PER_SECOND = 30;
const FRAMES_TO_RUN = SURVIVAL_RUN_SECONDS * FRAMES_PER_SECOND;
const DELTA = 1 / FRAMES_PER_SECOND;
const DIMENSIONS = { width: 800, height: 600 };

interface RunResult {
  survived: boolean;
  finalScore: number;
}

function runOneDive(seed: number): RunResult {
  resetAIManager();
  let scene: SceneState = createInitialScene(DIMENSIONS);
  const owner = createGoapBrainOwner({
    scene,
    dimensions: DIMENSIONS,
    totalTime: 0,
    deltaTime: DELTA,
    timeLeft: getDiveDurationSeconds("exploration", seed),
  });
  const brain = createCollectBeaconsProfile(owner);
  const bot: PlayerInputProvider = new GoapInputProvider(brain, owner);

  let score = 0;
  let lastCollectTime = 0;
  let multiplier = 1;
  let lastImpactTime = 0;
  let totalTime = 0;
  let timeLeft = getDiveDurationSeconds("exploration", seed);

  for (let frame = 0; frame < FRAMES_TO_RUN; frame++) {
    totalTime += DELTA;
    timeLeft = Math.max(0, getDiveDurationSeconds("exploration", seed) - totalTime);
    if (timeLeft <= 0) {
      return { survived: false, finalScore: score };
    }

    const input: DiveInput = bot.next({
      scene,
      dimensions: DIMENSIONS,
      totalTime,
      deltaTime: DELTA,
      timeLeft,
    });

    scene = {
      ...scene,
      player: advancePlayer(
        { ...scene.player, targetX: input.x, targetY: input.y },
        input,
        DIMENSIONS,
        totalTime,
        DELTA,
      ),
    };

    const result = advanceScene(
      scene,
      input,
      DIMENSIONS,
      totalTime,
      DELTA,
      lastCollectTime,
      multiplier,
      timeLeft,
      "exploration",
      seed,
    );
    scene = result.scene;
    score += result.collection.scoreDelta;
    if (result.collection.collected.length > 0) {
      multiplier = result.collection.multiplier;
      lastCollectTime = result.collection.lastCollectTime;
    }

    if (result.collidedWithPredator) {
      const impact = resolveDiveThreatImpact({
        collided: true,
        lastImpactTimeSeconds: lastImpactTime,
        mode: "exploration",
        seed,
        timeLeft,
        totalTimeSeconds: totalTime,
      });
      if (impact.type === "dive-failed") {
        return { survived: false, finalScore: score };
      }
      if (impact.type === "oxygen-penalty") {
        lastImpactTime = totalTime;
      }
    }
  }

  return { survived: true, finalScore: score };
}

describe("perception-bot-survival gate", () => {
  test(
    "survival rate across 5 seeds drops into the player-realistic 55–75% band",
    () => {
      const survivalCount = SEEDS.reduce(
        (acc, seed) => acc + (runOneDive(seed).survived ? 1 : 0),
        0,
      );
      const survivalRate = survivalCount / SEEDS.length;
      // Once perception lands, the bot can no longer flee threats it
      // cannot see, so it gets hit at a player-realistic rate.
      expect(survivalRate).toBeGreaterThanOrEqual(0.55);
      expect(survivalRate).toBeLessThanOrEqual(0.75);
    },
    30_000,
  );

  test(
    "score-per-minute stays in the human-playtest band 800–1800",
    () => {
      const totalScore = SEEDS.reduce((acc, seed) => acc + runOneDive(seed).finalScore, 0);
      const avgScorePerSecond = totalScore / SEEDS.length / SURVIVAL_RUN_SECONDS;
      const scorePerMinute = avgScorePerSecond * 60;
      // Bot can no longer hoover up beacons it cannot perceive — score
      // density drops to the human-pilot band measured 2026-04-23.
      expect(scorePerMinute).toBeGreaterThanOrEqual(800);
      expect(scorePerMinute).toBeLessThanOrEqual(1800);
    },
    30_000,
  );
});
