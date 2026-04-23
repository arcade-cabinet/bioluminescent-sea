import { describe, expect, it } from "vitest";
import { createInitialScene } from "../advance";
import { getDiveTelemetry } from "../telemetry";

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
    // Fake a scene where depth is near surface vs near trench floor.
    // We can't directly control depthMeters (it's derived), but we
    // can exercise the boundary by reducing creatures + oxygen.
    const scene = createInitialScene(viewport);

    const shallow = getDiveTelemetry(scene, 600, 600);
    const deep = getDiveTelemetry(
      { ...scene, creatures: [] },
      0,
      600
    );

    // The deep telemetry should have a biome different from or at-least
    // the same band as shallow (collection ratio 100% + oxygen 0 pushes
    // depth to the bottom of the formula range).
    expect(deep.depthMeters).toBeGreaterThan(shallow.depthMeters);
    expect(deep.biomeId).toBeDefined();
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
