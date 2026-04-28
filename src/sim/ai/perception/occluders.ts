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
 * Soft cap on non-wall occluders. Production scenes should never
 * approach this — the chunk archetype catalogue produces ≤4 anomalies
 * and ≤1 leviathan per chunk. The cap stops a pathological scene
 * state (fuzz, future content authoring) from blowing the per-tick
 * LoS budget.
 *
 * Walls are NEVER capped: a locked-room chunk's 4 walls are
 * load-bearing for room geometry — dropping them would let predators
 * see through walls. Walls are appended after the cap.
 */
const MAX_NON_WALL_OCCLUDERS = 28;

/**
 * `perceiverEntityId` is reserved for a future per-brain perception
 * context (currently the `manager.ts` rebuild call passes a single
 * shared context with no exclusion). Documented as a known deferred
 * extension — wired but unused on the production path.
 */
export function collectOccluders(
  scene: SceneState,
  dimensions: ViewportDimensions,
  perceiverEntityId?: string,
  lockedRoom = false,
): Occluder[] {
  const debrisAndLev: Occluder[] = [];

  for (const a of scene.anomalies) {
    if (a.type === "repel") {
      debrisAndLev.push({
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
    debrisAndLev.push({ kind: "leviathan", x: p.x, y: p.y, radius: p.size });
  }

  debrisAndLev.sort(compareOccluders);
  if (debrisAndLev.length > MAX_NON_WALL_OCCLUDERS) {
    debrisAndLev.length = MAX_NON_WALL_OCCLUDERS;
  }

  if (!lockedRoom) return debrisAndLev;

  // Walls go LAST and are never capped. The 4 viewport-edge segments.
  const w = dimensions.width;
  const h = dimensions.height;
  debrisAndLev.push({ kind: "wall", x1: 0, y1: 0, x2: w, y2: 0 }); // top
  debrisAndLev.push({ kind: "wall", x1: w, y1: 0, x2: w, y2: h }); // right
  debrisAndLev.push({ kind: "wall", x1: 0, y1: h, x2: w, y2: h }); // bottom
  debrisAndLev.push({ kind: "wall", x1: 0, y1: 0, x2: 0, y2: h }); // left
  return debrisAndLev;
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
  if (ay !== by) return ay - by;
  // Walls share start coords (top/left both at 0,0) — break ties on
  // end coords so the order is fully determined by the wall's own
  // geometry, not by Array.sort's stability guarantee.
  if (a.kind === "wall" && b.kind === "wall") {
    if (a.x2 !== b.x2) return a.x2 - b.x2;
    return a.y2 - b.y2;
  }
  return 0;
}
