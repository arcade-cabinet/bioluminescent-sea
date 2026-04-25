import type { SessionMode } from "@/sim/_shared/sessionMode";
import { resolveModeSlots, type ModeSlots } from "@/sim/factories/dive/slots";
import { readKv, writeKv } from "./database";

/**
 * SQLite-cached resolved dive bundle.
 *
 * The variance primitives in `src/sim/_shared/variance.ts` resolve
 * gameplay parameters from `[min, max]` templates against a dive seed.
 * That resolution is pure and deterministic, but it still costs a few
 * RNG draws per dive. Caching the resolved bundle on first
 * encounter — keyed by `(mode, seed)` — turns subsequent loads of the
 * same trench into a single SQLite read.
 *
 * The cache is **a perf optimisation, not the source of truth**. If the
 * cache is missing, the resolver computes the bundle. If the cache
 * exists, it must match the live resolver byte-for-byte; we revalidate
 * on read by comparing a `version` field embedded in the row. When the
 * resolver's authored ranges change (template edits, new knobs added)
 * the version bumps and stale entries are recomputed and overwritten.
 *
 * One row per `(mode, seed)`. The `app_kv` table from `database.ts`
 * provides the storage; we just author the namespace + serialisation.
 */

const NAMESPACE = "dive-seed-bundle";

/**
 * Bump this any time the *meaning* of a `ModeSlots` field changes — a
 * new field added, a range widened, a numeric resolver changing
 * behaviour. Stale rows are silently invalidated and recomputed on
 * read.
 */
const BUNDLE_VERSION = 1;

interface StoredBundle {
  version: number;
  mode: SessionMode;
  seed: number;
  slots: ModeSlots;
}

function cacheKey(mode: SessionMode, seed: number): string {
  return `${mode}:${seed >>> 0}`;
}

/**
 * Resolve the slots for `(mode, seed)`, preferring the cache. On a
 * miss (or stale version), compute fresh and write through to SQLite.
 *
 * Errors from the database (no platform support, locked DB, corrupt
 * row) fall through to a fresh compute — the bundle is too cheap to
 * resolve to be worth bubbling up. We log the error so production
 * pipeline issues are visible without breaking gameplay.
 */
export async function loadOrResolveDiveBundle(
  mode: SessionMode,
  seed: number,
): Promise<ModeSlots> {
  try {
    const raw = await readKv(NAMESPACE, cacheKey(mode, seed));
    if (raw) {
      const parsed = JSON.parse(raw) as StoredBundle;
      if (
        parsed.version === BUNDLE_VERSION &&
        parsed.mode === mode &&
        parsed.seed === seed
      ) {
        return parsed.slots;
      }
    }
  } catch (error) {
    console.warn("[seed-bundle] cache read failed; recomputing", error);
  }

  const slots = resolveModeSlots(mode, seed);
  // Best-effort write — if persistence fails, the gameplay still works,
  // it just won't get the cache speedup next time.
  try {
    const stored: StoredBundle = { version: BUNDLE_VERSION, mode, seed, slots };
    await writeKv(NAMESPACE, cacheKey(mode, seed), JSON.stringify(stored));
  } catch (error) {
    console.warn("[seed-bundle] cache write failed", error);
  }
  return slots;
}

/**
 * Sync alternative for callers that aren't async-friendly (the dive
 * loop, telemetry hot path, etc.). Skips the SQLite cache — used after
 * `loadOrResolveDiveBundle` has already populated the trait so the
 * cache is only consulted at dive-start. Safe to call from any layer.
 */
export function resolveDiveBundleSync(mode: SessionMode, seed: number): ModeSlots {
  return resolveModeSlots(mode, seed);
}
