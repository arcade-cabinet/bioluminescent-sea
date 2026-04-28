import { describe, expect, test } from "vitest";
import { isInScoop } from "@/sim/engine/collection";

/**
 * Scoop arc geometry — the front-mounted collection sector.
 *
 * Per the simplified contract folded from the simplifier review:
 *  - isInScoop is a free function exported from collection.ts (no
 *    separate scoop.ts file, no ScoopGeometry interface, no
 *    DEFAULT_SCOOP exported constant).
 *  - Signature: isInScoop(player, target, reachPx, halfAngleRad).
 *  - The renderer derives snap events from
 *    SceneAdvanceResult.collection.collected[] + the player trait
 *    snapshot it already reads — no new ScoopSnapEvent type, no new
 *    scoopSnaps[] field on SceneAdvanceResult.
 *
 * Geometry contract:
 *  - Apex at player(x,y), centerline at player.angle.
 *  - Half-angle on each side; reachPx as the radius.
 *  - Closed boundary: target at exactly reach AND/OR exactly halfAngle is IN
 *    (modulo float epsilon — see security MED finding for note).
 *  - Target at zero distance from player → IN regardless of heading.
 *  - NaN coords on player or target → false.
 */

const REACH = 60;
const HALF_ANGLE = Math.PI / 3; // 60° each side, 120° total

const PLAYER_FACING_RIGHT = { x: 0, y: 0, angle: 0 };

describe("isInScoop — radius cases", () => {
  test("target directly forward at half-reach is IN", () => {
    expect(isInScoop(PLAYER_FACING_RIGHT, { x: 30, y: 0 }, REACH, HALF_ANGLE)).toBe(true);
  });

  test("target directly forward at exact reach is IN (closed boundary)", () => {
    expect(isInScoop(PLAYER_FACING_RIGHT, { x: REACH, y: 0 }, REACH, HALF_ANGLE)).toBe(true);
  });

  test("target just past reach is OUT", () => {
    expect(isInScoop(PLAYER_FACING_RIGHT, { x: REACH + 1, y: 0 }, REACH, HALF_ANGLE)).toBe(false);
  });

  test("target at zero distance is IN regardless of heading", () => {
    expect(isInScoop(PLAYER_FACING_RIGHT, { x: 0, y: 0 }, REACH, HALF_ANGLE)).toBe(true);
    expect(
      isInScoop({ x: 0, y: 0, angle: Math.PI }, { x: 0, y: 0 }, REACH, HALF_ANGLE),
    ).toBe(true);
  });
});

describe("isInScoop — angle cases (player faces +X / angle=0)", () => {
  test("target inside half-angle is IN", () => {
    const angle = Math.PI / 6; // 30°
    expect(
      isInScoop(
        PLAYER_FACING_RIGHT,
        { x: Math.cos(angle) * 40, y: Math.sin(angle) * 40 },
        REACH,
        HALF_ANGLE,
      ),
    ).toBe(true);
  });

  test("target just past half-angle is OUT", () => {
    const angle = HALF_ANGLE + 0.05;
    expect(
      isInScoop(
        PLAYER_FACING_RIGHT,
        { x: Math.cos(angle) * 40, y: Math.sin(angle) * 40 },
        REACH,
        HALF_ANGLE,
      ),
    ).toBe(false);
  });

  test("target directly behind the sub is OUT regardless of distance", () => {
    expect(isInScoop(PLAYER_FACING_RIGHT, { x: -20, y: 0 }, REACH, HALF_ANGLE)).toBe(false);
    expect(isInScoop(PLAYER_FACING_RIGHT, { x: -50, y: 0 }, REACH, HALF_ANGLE)).toBe(false);
  });

  test("target perpendicular to heading is OUT (90° > 60° halfAngle)", () => {
    expect(isInScoop(PLAYER_FACING_RIGHT, { x: 0, y: 30 }, REACH, HALF_ANGLE)).toBe(false);
    expect(isInScoop(PLAYER_FACING_RIGHT, { x: 0, y: -30 }, REACH, HALF_ANGLE)).toBe(false);
  });
});

describe("isInScoop — heading rotation", () => {
  test("rotating heading rotates the cone", () => {
    const facingUp = { x: 0, y: 0, angle: Math.PI / 2 };
    expect(isInScoop(facingUp, { x: 0, y: 30 }, REACH, HALF_ANGLE)).toBe(true);
    expect(isInScoop(facingUp, { x: 30, y: 0 }, REACH, HALF_ANGLE)).toBe(false);
  });

  test("heading is normalised across the 2π boundary", () => {
    const facingRightTwoPi = { x: 0, y: 0, angle: Math.PI * 2 };
    expect(isInScoop(facingRightTwoPi, { x: 30, y: 0 }, REACH, HALF_ANGLE)).toBe(true);
  });

  test("negative angle is equivalent to its positive counterpart", () => {
    const facingDown = { x: 0, y: 0, angle: -Math.PI / 2 };
    expect(isInScoop(facingDown, { x: 0, y: -30 }, REACH, HALF_ANGLE)).toBe(true);
    expect(isInScoop(facingDown, { x: 0, y: 30 }, REACH, HALF_ANGLE)).toBe(false);
  });
});

describe("isInScoop — NaN guards", () => {
  test("NaN player x → false", () => {
    expect(isInScoop({ x: NaN, y: 0, angle: 0 }, { x: 30, y: 0 }, REACH, HALF_ANGLE)).toBe(false);
  });

  test("NaN player angle → false", () => {
    expect(isInScoop({ x: 0, y: 0, angle: NaN }, { x: 30, y: 0 }, REACH, HALF_ANGLE)).toBe(false);
  });

  test("NaN target → false", () => {
    expect(isInScoop(PLAYER_FACING_RIGHT, { x: NaN, y: 0 }, REACH, HALF_ANGLE)).toBe(false);
  });

  test("Infinity coords → false", () => {
    expect(
      isInScoop(PLAYER_FACING_RIGHT, { x: Infinity, y: 0 }, REACH, HALF_ANGLE),
    ).toBe(false);
  });
});
