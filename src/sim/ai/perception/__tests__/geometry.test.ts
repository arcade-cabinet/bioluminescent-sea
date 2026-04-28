import { describe, expect, test } from "vitest";
import {
  segmentIntersectsCircle,
  segmentIntersectsRect,
} from "../geometry";

/**
 * Geometry primitives that LoS occlusion stands on.
 *
 * Both functions are pure float math. The contract that matters:
 * deterministic across runs and across the range of inputs the
 * sim actually feeds them. Degenerate cases (zero-length segment,
 * exactly-tangent ray) must produce a stable answer, not depend on
 * the exact bit-pattern of the float subtraction.
 */
describe("segmentIntersectsCircle", () => {
  test("segment fully outside circle does not intersect", () => {
    expect(segmentIntersectsCircle(0, 0, 10, 0, 100, 100, 5)).toBe(false);
  });

  test("segment crossing circle center intersects", () => {
    expect(segmentIntersectsCircle(0, 50, 100, 50, 50, 50, 10)).toBe(true);
  });

  test("segment passing tangent to circle counts as intersect", () => {
    expect(segmentIntersectsCircle(-10, 5, 10, 5, 0, 0, 5)).toBe(true);
  });

  test("segment near-tangent but just outside does not intersect", () => {
    expect(segmentIntersectsCircle(-10, 5.01, 10, 5.01, 0, 0, 5)).toBe(false);
  });

  test("segment fully inside circle counts as intersect", () => {
    expect(segmentIntersectsCircle(1, 1, 2, 2, 0, 0, 10)).toBe(true);
  });

  test("zero-length segment outside circle does not intersect", () => {
    expect(segmentIntersectsCircle(100, 100, 100, 100, 0, 0, 5)).toBe(false);
  });

  test("zero-length segment on circle boundary intersects", () => {
    expect(segmentIntersectsCircle(5, 0, 5, 0, 0, 0, 5)).toBe(true);
  });

  test("zero-length segment inside circle intersects", () => {
    expect(segmentIntersectsCircle(2, 2, 2, 2, 0, 0, 5)).toBe(true);
  });

  test("NaN coordinates do not produce a spurious hit (security guard)", () => {
    // perceives() guards NaN inputs; geometry primitives must not
    // silently say "yes" on degenerate floats either. Either return
    // false consistently or a NaN-result the caller's guard rejects.
    const r = segmentIntersectsCircle(NaN, 0, 10, 0, 5, 0, 3);
    expect(r === false || Number.isNaN(r as unknown as number)).toBe(true);
  });
});

describe("segmentIntersectsRect", () => {
  // axis-aligned rectangle (x1,y1)-(x2,y2) with x1<x2, y1<y2
  const rect = { x1: 100, y1: 100, x2: 200, y2: 200 };

  test("segment fully outside rect does not intersect", () => {
    expect(
      segmentIntersectsRect(0, 0, 50, 50, rect.x1, rect.y1, rect.x2, rect.y2),
    ).toBe(false);
  });

  test("segment crossing rect intersects", () => {
    expect(
      segmentIntersectsRect(0, 150, 300, 150, rect.x1, rect.y1, rect.x2, rect.y2),
    ).toBe(true);
  });

  test("segment with one endpoint inside rect intersects", () => {
    expect(
      segmentIntersectsRect(150, 150, 300, 300, rect.x1, rect.y1, rect.x2, rect.y2),
    ).toBe(true);
  });

  test("segment fully inside rect intersects", () => {
    expect(
      segmentIntersectsRect(120, 120, 180, 180, rect.x1, rect.y1, rect.x2, rect.y2),
    ).toBe(true);
  });

  test("segment touching corner intersects", () => {
    expect(
      segmentIntersectsRect(50, 50, 100, 100, rect.x1, rect.y1, rect.x2, rect.y2),
    ).toBe(true);
  });

  test("segment parallel to edge but offset does not intersect", () => {
    expect(
      segmentIntersectsRect(0, 50, 300, 50, rect.x1, rect.y1, rect.x2, rect.y2),
    ).toBe(false);
  });
});
