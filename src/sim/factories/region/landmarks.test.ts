import { describe, expect, test } from "vitest";
import { LANDMARKS, lastPassedLandmark, nextLandmarkAtDepth } from "./landmarks";

describe("authored landmarks", () => {
  test("compiled landmark list is sorted shallow → deep", () => {
    for (let i = 1; i < LANDMARKS.length; i++) {
      expect(LANDMARKS[i].depthMeters).toBeGreaterThanOrEqual(
        LANDMARKS[i - 1].depthMeters,
      );
    }
  });

  test("every landmark names a real biome, has flavor copy, and a positive depth", () => {
    for (const lm of LANDMARKS) {
      expect(lm.id.length).toBeGreaterThan(0);
      expect(lm.label.length).toBeGreaterThan(0);
      expect(lm.flavor.length).toBeGreaterThan(0);
      expect(lm.depthMeters).toBeGreaterThan(0);
      expect([
        "epipelagic",
        "mesopelagic",
        "bathypelagic",
        "abyssopelagic",
        "hadopelagic",
      ]).toContain(lm.biome);
    }
  });

  test("nextLandmarkAtDepth returns the first landmark deeper than the sub", () => {
    // First authored landmark sits in the upper epipelagic.
    expect(nextLandmarkAtDepth(0)?.id).toBe(LANDMARKS[0].id);
    // Past every authored landmark falls through.
    expect(nextLandmarkAtDepth(50_000)).toBeNull();
    // Deterministic: each call returns a strictly-deeper landmark.
    for (const lm of LANDMARKS) {
      const next = nextLandmarkAtDepth(lm.depthMeters);
      if (next) expect(next.depthMeters).toBeGreaterThan(lm.depthMeters);
    }
  });

  test("lastPassedLandmark returns the deepest landmark already passed", () => {
    expect(lastPassedLandmark(0)).toBeNull();
    // Just past the first landmark — last-passed is exactly that one.
    const first = LANDMARKS[0];
    expect(lastPassedLandmark(first.depthMeters + 1)?.id).toBe(first.id);
    // Past everything — last-passed is the deepest authored landmark.
    expect(lastPassedLandmark(50_000)?.id).toBe(LANDMARKS[LANDMARKS.length - 1].id);
  });
});
