import { advanceScene } from "@/sim/dive/advance";
import { resolveDiveThreatImpact } from "@/sim/dive/impact";
import type {
  DiveInput,
  SceneAdvanceResult,
  SceneState,
  ViewportDimensions,
} from "@/sim/dive/types";
import { DiveRoot } from "./traits";
import {
  readSceneFromWorld,
  writeSceneToWorld,
  type DiveWorld,
} from "./world";

/**
 * Actions — the only way outside code mutates the ECS world.
 *
 * The React UI never writes traits directly; it dispatches through
 * these action functions. The sim stays pure — actions are the
 * thin layer that reads from traits, delegates to `src/sim/*`, and
 * writes the result back.
 *
 * In PR E + F these actions will own more of the dive lifecycle
 * (chunk generation, biome transitions). For PR D they wrap the
 * existing sim step so downstream layers can migrate to the ECS
 * interface without behavior drift.
 */

export interface AdvanceDiveFrameInput {
  world: DiveWorld;
  input: DiveInput;
  dimensions: ViewportDimensions;
  deltaTime: number;
  totalTime: number;
  timeLeft: number;
  mode: string;
  lastCollectTime: number;
  multiplier: number;
}

export interface AdvanceDiveFrameOutput {
  world: DiveWorld;
  result: SceneAdvanceResult;
}

export function advanceDiveFrame(args: AdvanceDiveFrameInput): AdvanceDiveFrameOutput {
  const scene: SceneState = readSceneFromWorld(args.world);
  const result = advanceScene(
    scene,
    args.input,
    args.dimensions,
    args.totalTime,
    args.deltaTime,
    args.lastCollectTime,
    args.multiplier,
    args.timeLeft,
    args.mode
  );

  const nextWorld = writeSceneToWorld(args.world, result.scene);
  nextWorld.rootEntity.set(DiveRoot, {
    totalTime: args.totalTime,
    threatFlashAlpha:
      nextWorld.rootEntity.get(DiveRoot)?.threatFlashAlpha ?? 0,
  });

  return { world: nextWorld, result };
}

export function recordThreatFlash(world: DiveWorld): void {
  const current = world.rootEntity.get(DiveRoot);
  if (!current) return;
  world.rootEntity.set(DiveRoot, { ...current, threatFlashAlpha: 1 });
}

export function decayThreatFlash(world: DiveWorld, deltaTime: number): void {
  const current = world.rootEntity.get(DiveRoot);
  if (!current) return;
  world.rootEntity.set(DiveRoot, {
    ...current,
    threatFlashAlpha: Math.max(0, current.threatFlashAlpha - deltaTime * 3),
  });
}

export { resolveDiveThreatImpact };
