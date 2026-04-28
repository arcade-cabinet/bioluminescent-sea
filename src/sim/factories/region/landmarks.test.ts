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
    expect(nextLandmarkAtDepth(0)?.id).toBe("kelp-forest");
    // Kelp forest is at 200m; just past it the next is the marine
    // snow column at 700m.
    expect(nextLandmarkAtDepth(201)?.id).toBe("marine-snow-column");
    expect(nextLandmarkAtDepth(50_000)).toBeNull();
  });

  test("lastPassedLandmark returns the deepest landmark already passed", () => {
    expect(lastPassedLandmark(0)).toBeNull();
    expect(lastPassedLandmark(250)?.id).toBe("kelp-forest");
    expect(lastPassedLandmark(50_000)?.id).toBe("hydrothermal-vent");
  });
});
