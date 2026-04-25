import type { DiveTelemetry, SceneState } from "@/sim";
import { type SessionMode, SESSION_MODES } from "@/sim";

export const DIVE_SAVE_KEY = "bioluminescent-sea:v1:save";

export interface DeepSeaRunSnapshot {
  lastCollectTime: number;
  mode: SessionMode;
  multiplier: number;
  scene: SceneState;
  score: number;
  /**
   * Seed used to generate this run. Stored so a refresh / resume picks
   * up the same procedural world even if the URL or preview seed has
   * since drifted. Optional for backward compatibility with snapshots
   * written before this field existed.
   */
  seed?: number;
  telemetry: DiveTelemetry;
  timeLeft: number;
}

export function cloneSceneState(scene: SceneState): SceneState {
  return JSON.parse(JSON.stringify(scene)) as SceneState;
}

function isSceneSnapshot(scene: unknown): scene is SceneState {
  const value = scene as Partial<SceneState> | undefined;
  return Boolean(
    value &&
      typeof value === "object" &&
      value.player &&
      typeof value.player === "object" &&
      Array.isArray(value.anomalies) &&
      Array.isArray(value.creatures) &&
      Array.isArray(value.predators) &&
      Array.isArray(value.pirates) &&
      Array.isArray(value.particles),
  );
}

function isDeepSeaSnapshot(snapshot: unknown): snapshot is DeepSeaRunSnapshot {
  const value = snapshot as Partial<DeepSeaRunSnapshot> | undefined;
  if (
    !value ||
    typeof value !== "object" ||
    typeof value.score !== "number" ||
    typeof value.timeLeft !== "number" ||
    typeof value.multiplier !== "number" ||
    typeof value.lastCollectTime !== "number" ||
    !isSceneSnapshot(value.scene)
  ) {
    return false;
  }
  // Mode must be a known SessionMode — a corrupted snapshot pointing at
  // an unknown mode would silently fall through to descent and confuse
  // the player about what they're playing.
  if (
    typeof value.mode !== "string" ||
    !(SESSION_MODES as readonly string[]).includes(value.mode)
  ) {
    return false;
  }
  return true;
}

export function resolveDeepSeaSnapshot(): DeepSeaRunSnapshot | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(DIVE_SAVE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isDeepSeaSnapshot(parsed)) return null;
    return { ...parsed, scene: cloneSceneState(parsed.scene) };
  } catch {
    return null;
  }
}

export function clearDeepSeaSnapshot(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(DIVE_SAVE_KEY);
  } catch {
    // ignore
  }
}

export function writeDeepSeaSnapshot(snapshot: DeepSeaRunSnapshot): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(DIVE_SAVE_KEY, JSON.stringify(snapshot));
  } catch {
    // Storage may be disabled or full — ignore.
  }
}
