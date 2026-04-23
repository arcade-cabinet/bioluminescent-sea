import { describe, expect, test } from "vitest";
import { fbm, noise2D, noise3D } from "./perlin";

describe("perlin noise helpers", () => {
  test("noise2D is the z=0 projection of noise3D", () => {
    expect(noise2D(3.25, 9.5)).toBe(noise3D(3.25, 9.5, 0));
  });

  test("returns deterministic bounded values for repeated samples", () => {
    const samples = [noise2D(0.125, 0.25), noise2D(8.5, 2.75), fbm(1.2, 4.8, 5)];

    expect(samples).toEqual([noise2D(0.125, 0.25), noise2D(8.5, 2.75), fbm(1.2, 4.8, 5)]);
    for (const sample of samples) {
      expect(sample).toBeGreaterThanOrEqual(-1);
      expect(sample).toBeLessThanOrEqual(1);
    }
  });
});
