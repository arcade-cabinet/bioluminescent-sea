import { describe, expect, test } from "vitest";
import { perceives, type PerceptionContext, type PerceiverProfile } from "../perception";

/**
 * Perception matrix tests — radius → cone → LoS, in that order.
 *
 * Per the simplified contract: a single free function `perceives(context,
 * perceiver, profile, target): boolean`. No factory, no second method,
 * no `hasHeading` flag. Omnidirectional perception is signalled by
 * `coneHalfAngleRad >= Math.PI`.
 *
 * Self-occlusion is handled at occluder-collection time:
 * `collectOccluders(scene, dimensions, perceiverEntityId?)` excludes
 * the perceiver's own leviathan entry. The perception module itself
 * trusts the occluder list it's given.
 */

const EMPTY_CONTEXT: PerceptionContext = { occluders: [] };

const FORWARD_CONE: PerceiverProfile = {
  radiusPx: 200,
  coneHalfAngleRad: Math.PI / 4, // 45°
};

const OMNI: PerceiverProfile = {
  radiusPx: 200,
  coneHalfAngleRad: Math.PI, // omnidirectional
};

describe("perceives — radius cull", () => {
  test("target at distance 0 is perceived", () => {
    expect(
      perceives(EMPTY_CONTEXT, { x: 0, y: 0, headingRad: 0 }, OMNI, { x: 0, y: 0 }),
    ).toBe(true);
  });

  test("target inside radius is perceived", () => {
    expect(
      perceives(EMPTY_CONTEXT, { x: 0, y: 0, headingRad: 0 }, OMNI, { x: 100, y: 0 }),
    ).toBe(true);
  });

  test("target on radius boundary is perceived", () => {
    expect(
      perceives(EMPTY_CONTEXT, { x: 0, y: 0, headingRad: 0 }, OMNI, { x: 200, y: 0 }),
    ).toBe(true);
  });

  test("target outside radius is not perceived", () => {
    expect(
      perceives(EMPTY_CONTEXT, { x: 0, y: 0, headingRad: 0 }, OMNI, { x: 201, y: 0 }),
    ).toBe(false);
  });

  test("radius is symmetric around perceiver position", () => {
    expect(
      perceives(EMPTY_CONTEXT, { x: 100, y: 100, headingRad: 0 }, OMNI, { x: 0, y: 0 }),
    ).toBe(true);
  });
});

describe("perceives — cone cull", () => {
  // perceiver at origin facing +X (headingRad = 0)
  test("target directly forward is perceived", () => {
    expect(
      perceives(EMPTY_CONTEXT, { x: 0, y: 0, headingRad: 0 }, FORWARD_CONE, { x: 100, y: 0 }),
    ).toBe(true);
  });

  test("target inside half-angle boundary is perceived", () => {
    // 44° from forward — clearly inside the 45° cone, no float ambiguity.
    const angle = Math.PI / 4 - 0.02;
    expect(
      perceives(
        EMPTY_CONTEXT,
        { x: 0, y: 0, headingRad: 0 },
        FORWARD_CONE,
        { x: Math.cos(angle) * 100, y: Math.sin(angle) * 100 },
      ),
    ).toBe(true);
  });

  test("target just past cone half-angle is NOT perceived", () => {
    // 50° beyond forward heading
    const angle = (Math.PI / 4) + 0.1;
    expect(
      perceives(
        EMPTY_CONTEXT,
        { x: 0, y: 0, headingRad: 0 },
        FORWARD_CONE,
        { x: Math.cos(angle) * 100, y: Math.sin(angle) * 100 },
      ),
    ).toBe(false);
  });

  test("target directly behind perceiver is NOT perceived (forward cone)", () => {
    expect(
      perceives(
        EMPTY_CONTEXT,
        { x: 0, y: 0, headingRad: 0 },
        FORWARD_CONE,
        { x: -100, y: 0 },
      ),
    ).toBe(false);
  });

  test("omnidirectional profile perceives target behind perceiver", () => {
    expect(
      perceives(EMPTY_CONTEXT, { x: 0, y: 0, headingRad: 0 }, OMNI, { x: -100, y: 0 }),
    ).toBe(true);
  });

  test("rotating perceiver heading rotates the cone", () => {
    // Heading π/2 = facing +Y. Target at +X is now 90° to the right
    // → outside a 45° forward cone.
    expect(
      perceives(
        EMPTY_CONTEXT,
        { x: 0, y: 0, headingRad: Math.PI / 2 },
        FORWARD_CONE,
        { x: 100, y: 0 },
      ),
    ).toBe(false);
    // Target at +Y is now directly forward → perceived.
    expect(
      perceives(
        EMPTY_CONTEXT,
        { x: 0, y: 0, headingRad: Math.PI / 2 },
        FORWARD_CONE,
        { x: 0, y: 100 },
      ),
    ).toBe(true);
  });
});

describe("perceives — line-of-sight cull (debris occluder)", () => {
  const debrisBetween: PerceptionContext = {
    occluders: [{ kind: "debris", x: 50, y: 0, radius: 10 }],
  };

  test("target on far side of debris circle is NOT perceived", () => {
    expect(
      perceives(debrisBetween, { x: 0, y: 0, headingRad: 0 }, OMNI, { x: 100, y: 0 }),
    ).toBe(false);
  });

  test("target on near side of debris circle is perceived", () => {
    expect(
      perceives(debrisBetween, { x: 0, y: 0, headingRad: 0 }, OMNI, { x: 30, y: 0 }),
    ).toBe(true);
  });

  test("target offset above debris is perceived (line goes around)", () => {
    expect(
      perceives(debrisBetween, { x: 0, y: 0, headingRad: 0 }, OMNI, { x: 100, y: 50 }),
    ).toBe(true);
  });
});

describe("perceives — line-of-sight cull (leviathan occluder)", () => {
  const leviathanBetween: PerceptionContext = {
    occluders: [{ kind: "leviathan", x: 50, y: 0, radius: 30 }],
  };

  test("target on far side of leviathan is NOT perceived", () => {
    expect(
      perceives(leviathanBetween, { x: 0, y: 0, headingRad: 0 }, OMNI, { x: 100, y: 0 }),
    ).toBe(false);
  });

  test("target far above leviathan silhouette is perceived", () => {
    expect(
      perceives(leviathanBetween, { x: 0, y: 0, headingRad: 0 }, OMNI, { x: 100, y: 80 }),
    ).toBe(true);
  });
});

describe("perceives — line-of-sight cull (wall occluders)", () => {
  // Locked-room walls: 4 segments framing a (50,50)-(150,150) viewport.
  const walledRoom: PerceptionContext = {
    occluders: [
      { kind: "wall", x1: 50, y1: 50, x2: 150, y2: 50 },   // top
      { kind: "wall", x1: 150, y1: 50, x2: 150, y2: 150 }, // right
      { kind: "wall", x1: 50, y1: 150, x2: 150, y2: 150 }, // bottom
      { kind: "wall", x1: 50, y1: 50, x2: 50, y2: 150 },   // left
    ],
  };

  test("perceiver inside, target inside — perceived", () => {
    expect(
      perceives(walledRoom, { x: 100, y: 100, headingRad: 0 }, OMNI, { x: 120, y: 120 }),
    ).toBe(true);
  });

  test("perceiver inside, target outside — NOT perceived", () => {
    expect(
      perceives(walledRoom, { x: 100, y: 100, headingRad: 0 }, OMNI, { x: 200, y: 200 }),
    ).toBe(false);
  });

  test("perceiver outside, target outside (no walls between) — perceived", () => {
    expect(
      perceives(walledRoom, { x: 0, y: 0, headingRad: 0 }, OMNI, { x: 0, y: 200 }),
    ).toBe(true);
  });
});
