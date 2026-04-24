import seedrandom from "seedrandom";

/**
 * Seedable PRNG for reproducible dives.
 * `seedrandom` is the single active random source for runtime and sim code.
 * Any direct `Math.random()` call in src/ is a bug — CI will block it.
 */

export interface Rng {
  /** Returns [0, 1) like Math.random(). */
  next(): number;
  /** Returns integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** Returns float in [min, max). */
  range(min: number, max: number): number;
  /** Pick a random element from a non-empty array. Throws on empty. */
  pick<T>(arr: readonly T[]): T;
  /** Fisher-Yates shuffle in place, returning the same array for chaining. */
  shuffle<T>(arr: T[]): T[];
  /** Gaussian-ish (sum-of-four) in [-1, 1]; cheap, good enough for placement jitter. */
  gaussian(): number;
  /** Starting seed (for logging, replay, debugging). */
  readonly seed: number;
}

export function createRng(seed: number): Rng {
  const startSeed = seed >>> 0;
  const generator = seedrandom(String(startSeed));

  const next = (): number => generator.quick();

  const shuffle = <T>(arr: T[]): T[] => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  return {
    next,
    int(min: number, max: number): number {
      return min + Math.floor(next() * (max - min + 1));
    },
    range(min: number, max: number): number {
      return min + next() * (max - min);
    },
    pick<T>(arr: readonly T[]): T {
      if (arr.length === 0) {
        throw new Error("rng.pick: cannot pick from an empty array");
      }
      return arr[Math.floor(next() * arr.length)];
    },
    shuffle,
    gaussian(): number {
      return (next() + next() + next() + next() - 2) / 2;
    },
    get seed() {
      return startSeed;
    },
  };
}

export function randomSeed(): number {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return 1 + (values[0] % 2147483646);
}

export function hashSeed(...inputs: number[]): number {
  let h = 0x811c9dc5;
  for (const input of inputs) {
    const n = Math.trunc(input) >>> 0;
    for (let shift = 0; shift < 32; shift += 8) {
      h ^= (n >>> shift) & 0xff;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  }
  return h >>> 0;
}
