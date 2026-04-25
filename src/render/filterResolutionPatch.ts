import type { Renderer } from "pixi.js";
import { FilterSystem } from "pixi.js";

/**
 * Workaround for pixijs/pixijs#11467 — filters at default
 * `resolution = 1` render to lower-resolution textures than the
 * renderer when `devicePixelRatio > 1`. On retina (DPR=2) that
 * produced the persistent "upper-left quadrant" artifact: the
 * filter texture rendered at half size, then composited over the
 * 2× canvas covering only the upper-left quarter of the visible
 * area.
 *
 * The fix patches `FilterSystem.prototype.push` once per process so
 * any filter that lacks an explicit resolution inherits the
 * renderer's. Original code by an end-user in issue #11467; we
 * adapt it here so we don't have to author `filter.resolution =
 * renderer.resolution` at every construction site.
 *
 * Idempotent: subsequent calls are no-ops.
 */
let applied = false;

interface FilterEffect {
  filters?: Array<{ resolution?: number } | null | undefined>;
}

interface PushInstruction {
  filterEffect?: FilterEffect;
}

interface PatchableFilterSystem {
  push: (instruction: PushInstruction) => unknown;
  renderer: Renderer;
}

export function applyFilterResolutionPatch(): void {
  if (applied) return;
  applied = true;

  const proto = FilterSystem.prototype as unknown as PatchableFilterSystem;
  const originalPush = proto.push;

  proto.push = function (this: PatchableFilterSystem, instruction: PushInstruction) {
    const result = originalPush.call(this, instruction);
    const targetResolution = this.renderer.resolution;
    const filters = instruction.filterEffect?.filters;
    if (filters) {
      for (const filter of filters) {
        if (filter && typeof filter === "object" && "resolution" in filter) {
          if (filter.resolution === 1) {
            filter.resolution = targetResolution;
          }
        }
      }
    }
    return result;
  };
}
