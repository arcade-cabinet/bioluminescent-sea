import type { Chunk } from "@/sim/factories/region/types";

/**
 * Chunk lifecycle delta.
 *
 * Given the set of chunk indices that were live last frame and the
 * chunks that should be live this frame (from `chunksInWindow`), return
 * the chunks that newly entered the camera's window (`spawned`) and
 * the chunk indices that fell off the window (`retiredIndices`).
 *
 * The caller is responsible for spawning creatures for `spawned`
 * chunks and pruning entities belonging to `retiredIndices`. This
 * helper is pure — no side effects, no RNG, no entities.
 *
 * F.4f groundwork: the chunked scene factory already spawns a
 * snapshot at t=0. This function is the per-frame delta so the spawn
 * / retire loop works as the camera descends.
 */

export interface ChunkLifecycleDelta {
  /** Chunks whose index is in `currentWindow` but was NOT live last frame. */
  spawned: Chunk[];
  /** Indices that WERE live last frame but are NOT in `currentWindow`. */
  retiredIndices: number[];
}

export function chunkLifecycleDelta(
  previousLiveIndices: ReadonlySet<number>,
  currentWindow: readonly Chunk[],
): ChunkLifecycleDelta {
  const currentIndices = new Set(currentWindow.map((c) => c.index));
  const spawned = currentWindow.filter((c) => !previousLiveIndices.has(c.index));
  const retiredIndices: number[] = [];
  for (const idx of previousLiveIndices) {
    if (!currentIndices.has(idx)) retiredIndices.push(idx);
  }
  // Sort so callers that use retiredIndices for cache invalidation
  // get a stable order — same delta → same output.
  retiredIndices.sort((a, b) => a - b);
  return { spawned, retiredIndices };
}
