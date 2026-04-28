/**
 * Occluder collection — pure scene → Occluder[].
 *
 * Three classes:
 *  - debris    : repel-anomaly debris fields, radius = anomaly.size × 1.4
 *  - leviathan : predators with isLeviathan=true, radius = predator.size
 *  - wall      : 4 segments framing the viewport rect when lockedRoom=true
 *
 * `perceiverEntityId` excludes the named entity's own leviathan entry
 * so a leviathan doesn't occlude its own line-of-sight to the player.
 *
 * Output is sorted (kind asc, then x asc, then y asc) so iteration is
 * deterministic across runs and machines — important because the LoS
 * cull short-circuits on first hit and stable order keeps fuzzing /
 * snapshot tests stable.
 */

import type { SceneState, ViewportDimensions } from "@/sim/dive/types";

export type Occluder =
  | { kind: "debris"; x: number; y: number; radius: number }
  | { kind: "leviathan"; x: number; y: number; radius: number }
  | { kind: "wall"; x1: number; y1: number; x2: number; y2: number };

const KIND_ORDER: Record<Occluder["kind"], number> = {
  debris: 0,
  leviathan: 1,
  wall: 2,
};

const DEBRIS_RADIUS_MULTIPLIER = 1.4;

/**
 * Soft cap on occluder count. Production scenes should never approach
 * this — the chunk archetype catalogue produces ≤4 anomalies and ≤1
 * leviathan per chunk, plus 4 walls in locked-room. The cap stops a
 * pathological scene state (fuzz, future content authoring) from
 * blowing the per-tick LoS budget.
 */
const MAX_OCCLUDERS = 32;

export function collectOccluders(
  scene: SceneState,
  dimensions: ViewportDimensions,
  perceiverEntityId?: string,
  lockedRoom = false,
): Occluder[] {
  const out: Occluder[] = [];

  for (const a of scene.anomalies) {
    if (a.type === "repel") {
      out.push({
        kind: "debris",
        x: a.x,
        y: a.y,
        radius: a.size * DEBRIS_RADIUS_MULTIPLIER,
      });
    }
  }

  for (const p of scene.predators) {
    if (!p.isLeviathan) continue;
    if (perceiverEntityId !== undefined && p.id === perceiverEntityId) continue;
    out.push({ kind: "leviathan", x: p.x, y: p.y, radius: p.size });
  }

  if (lockedRoom) {
    const w = dimensions.width;
    const h = dimensions.height;
    out.push({ kind: "wall", x1: 0, y1: 0, x2: w, y2: 0 }); // top
    out.push({ kind: "wall", x1: w, y1: 0, x2: w, y2: h }); // right
    out.push({ kind: "wall", x1: 0, y1: h, x2: w, y2: h }); // bottom
    out.push({ kind: "wall", x1: 0, y1: 0, x2: 0, y2: h }); // left
  }

  out.sort(compareOccluders);

  if (out.length > MAX_OCCLUDERS) {
    out.length = MAX_OCCLUDERS;
  }

  return out;
}

function compareOccluders(a: Occluder, b: Occluder): number {
  const ka = KIND_ORDER[a.kind];
  const kb = KIND_ORDER[b.kind];
  if (ka !== kb) return ka - kb;
  const ax = a.kind === "wall" ? a.x1 : a.x;
  const bx = b.kind === "wall" ? b.x1 : b.x;
  if (ax !== bx) return ax - bx;
  const ay = a.kind === "wall" ? a.y1 : a.y;
  const by = b.kind === "wall" ? b.y1 : b.y;
  return ay - by;
}
