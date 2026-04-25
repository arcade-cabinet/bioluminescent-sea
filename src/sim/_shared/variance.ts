import { createRng, hashSeed } from "@/sim/rng";

/**
 * `Numeric` is the type every gameplay knob in the codebase uses for
 * its authored value. A plain `number` is a load-bearing constant whose
 * value defines a mode's *contract* (e.g. Arena's `impactGrace = 0` —
 * any other value would change what Arena means). A `[min, max]` tuple
 * is a knob whose specific value is a *challenge variant* — every
 * dive's seed picks a different concrete value from the range, so two
 * dives in the same mode feel like different runs without changing
 * what the mode is.
 *
 * Resolution is stable: the same `(template, seed, tag)` triple always
 * resolves to the same number. Tags namespace each knob's RNG draw so
 * widening one knob's range (e.g. bumping `targetDepthMeters`'s upper
 * bound) doesn't perturb any other knob's resolved value for the same
 * seed — the codename `Ember Hyacinth Halocline` keeps its predator
 * speed even if you edit the depth range tomorrow.
 */
export type Numeric = number | readonly [number, number];

/**
 * Hash a string tag into a 32-bit subseed of the dive seed. Each
 * gameplay knob gets a distinct tag, which gives every knob an
 * independent random stream rooted in the dive seed.
 */
export function subseed(seed: number, tag: string): number {
  let h = 0;
  for (let i = 0; i < tag.length; i++) {
    h = Math.imul(h ^ tag.charCodeAt(i), 16777619) >>> 0;
  }
  return hashSeed(seed, h);
}

/**
 * Resolve a `Numeric` template into a concrete number for a specific
 * dive seed. `integer: true` returns an inclusive integer; otherwise
 * returns a float in `[min, max)`.
 *
 * Fixed numbers pass through unchanged — if a value is intentionally
 * load-bearing for the mode's contract, authoring it as a plain number
 * makes that intention explicit.
 */
export function resolveNumeric(
  template: Numeric,
  seed: number,
  tag: string,
  integer = false,
): number {
  if (typeof template === "number") return template;
  const [min, max] = template;
  const rng = createRng(subseed(seed, tag));
  return integer ? rng.int(min, max) : rng.range(min, max);
}

/**
 * Pick one element from a list using a tagged subseed. Used for
 * categorical-but-variable knobs where the choice is one of N
 * authored options (e.g. school formation: "ribbon" | "sphere" |
 * "scattered") and the dive seed picks which one.
 */
export function resolvePick<T>(options: readonly T[], seed: number, tag: string): T {
  if (options.length === 0) {
    throw new Error("variance.resolvePick: cannot pick from an empty list");
  }
  const rng = createRng(subseed(seed, tag));
  return rng.pick(options);
}
