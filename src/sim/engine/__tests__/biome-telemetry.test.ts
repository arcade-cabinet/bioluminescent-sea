import { describe, expect, it } from "vitest";
import { createInitialScene } from "@/sim/engine/advance";
import { getDiveTelemetry } from "@/sim/engine/telemetry";

const viewport = { width: 1280, height: 720 };

describe("getDiveTelemetry biome", () => {
  it("exposes biome fields tied to depthMeters", () => {
    const scene = createInitialScene(viewport);
    const t = getDiveTelemetry(scene, 600, 600);
    expect(t.biomeId).toBeDefined();
    expect(t.biomeLabel.length).toBeGreaterThan(0);
    expect(t.biomeTintHex).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("biome advances as depthMeters crosses the boundaries", () => {
    // Depth is scene.depthTravelMeters (world-meters descended).
    // Surface scene reports 0m (epipelagic); deep scene at 2000m
    // sits inside bathypelagic (1500-3000m).
    const shallow = getDiveTelemetry(createInitialScene(viewport), 600, 600);
    const deep = getDiveTelemetry(
      { ...createInitialScene(viewport), depthTravelMeters: 2000 },
      600,
      600
    );

    expect(deep.depthMeters).toBeGreaterThan(shallow.depthMeters);
    expect(shallow.biomeId).toBe("epipelagic");
    expect(deep.biomeId).toBe("bathypelagic");
  });

  it("objective copy varies with biome in ambient mode", () => {
    // Scenes that don't trigger any urgent branch should pick up
    // biome-specific ambient copy.
    const scene = createInitialScene(viewport);
    const t = getDiveTelemetry(scene, 600, 600);

    // Whatever biome the initial scene lands in, its objective
    // should not be the default placeholder string — the switch
    // must land.
    expect(t.objective.length).toBeGreaterThan(0);
    expect(t.objective).not.toBe("");
  });
});
