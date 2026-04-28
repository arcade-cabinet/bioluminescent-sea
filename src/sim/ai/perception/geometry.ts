/**
 * Geometry primitives for line-of-sight occlusion.
 *
 * Pure float math, no allocations. Both functions return false when
 * any input is non-finite (NaN/Infinity) so a degenerate scene state
 * cannot produce a spurious "yes" through the perception layer.
 */

function isFinite4(a: number, b: number, c: number, d: number): boolean {
  return Number.isFinite(a) && Number.isFinite(b) && Number.isFinite(c) && Number.isFinite(d);
}

/**
 * True when the segment (x1,y1)-(x2,y2) intersects (or is contained
 * within) the circle centered at (cx,cy) with radius r.
 *
 * Algorithm: closest point on segment to circle center, compare
 * squared distance against r². Zero-length segments degrade to a
 * point-in-circle test.
 */
export function segmentIntersectsCircle(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  cx: number,
  cy: number,
  r: number,
): boolean {
  if (!isFinite4(x1, y1, x2, y2)) return false;
  if (!Number.isFinite(cx) || !Number.isFinite(cy) || !Number.isFinite(r) || r < 0) return false;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;

  // Closest point on the segment to the circle center.
  let cpx: number;
  let cpy: number;
  if (lenSq === 0) {
    cpx = x1;
    cpy = y1;
  } else {
    const t = Math.max(0, Math.min(1, ((cx - x1) * dx + (cy - y1) * dy) / lenSq));
    cpx = x1 + t * dx;
    cpy = y1 + t * dy;
  }

  const ex = cpx - cx;
  const ey = cpy - cy;
  return ex * ex + ey * ey <= r * r;
}

/**
 * True when the segment (x1,y1)-(x2,y2) intersects (or is contained
 * within) the axis-aligned rect (rx1,ry1)-(rx2,ry2). Caller passes
 * the rect with rx1<=rx2 and ry1<=ry2.
 *
 * Algorithm: clip-by-Cohen-Sutherland is overkill; cheaper to test
 * "either endpoint inside rect" first, then segment vs each of the
 * four edges (segment-segment intersection).
 */
export function segmentIntersectsRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rx1: number,
  ry1: number,
  rx2: number,
  ry2: number,
): boolean {
  if (!isFinite4(x1, y1, x2, y2)) return false;
  if (!isFinite4(rx1, ry1, rx2, ry2)) return false;

  // Either endpoint inside the rect → intersect.
  if (x1 >= rx1 && x1 <= rx2 && y1 >= ry1 && y1 <= ry2) return true;
  if (x2 >= rx1 && x2 <= rx2 && y2 >= ry1 && y2 <= ry2) return true;

  // Segment vs each of the 4 rect edges.
  return (
    segmentsIntersect(x1, y1, x2, y2, rx1, ry1, rx2, ry1) || // top
    segmentsIntersect(x1, y1, x2, y2, rx2, ry1, rx2, ry2) || // right
    segmentsIntersect(x1, y1, x2, y2, rx1, ry2, rx2, ry2) || // bottom
    segmentsIntersect(x1, y1, x2, y2, rx1, ry1, rx1, ry2)    // left
  );
}

/**
 * Standard segment-segment intersection. Uses parametric form;
 * collinear-overlap returns true when the bounding boxes overlap on
 * the line, false otherwise.
 */
function segmentsIntersect(
  ax1: number, ay1: number, ax2: number, ay2: number,
  bx1: number, by1: number, bx2: number, by2: number,
): boolean {
  const dax = ax2 - ax1;
  const day = ay2 - ay1;
  const dbx = bx2 - bx1;
  const dby = by2 - by1;
  const denom = dax * dby - day * dbx;

  if (denom === 0) {
    // Parallel. Only collinear segments can overlap — check via cross
    // product of A's direction with the A→B1 vector. Non-zero means
    // parallel-but-offset (no intersection possible).
    const cross = dax * (by1 - ay1) - day * (bx1 - ax1);
    if (cross !== 0) return false;
    // Collinear: check endpoint overlap in both directions so the
    // A⊂B case (A fully inside B) is also covered.
    const minAx = Math.min(ax1, ax2);
    const maxAx = Math.max(ax1, ax2);
    const minAy = Math.min(ay1, ay2);
    const maxAy = Math.max(ay1, ay2);
    const onA1 = bx1 >= minAx && bx1 <= maxAx && by1 >= minAy && by1 <= maxAy;
    const onA2 = bx2 >= minAx && bx2 <= maxAx && by2 >= minAy && by2 <= maxAy;
    const minBx = Math.min(bx1, bx2);
    const maxBx = Math.max(bx1, bx2);
    const minBy = Math.min(by1, by2);
    const maxBy = Math.max(by1, by2);
    const onB1 = ax1 >= minBx && ax1 <= maxBx && ay1 >= minBy && ay1 <= maxBy;
    const onB2 = ax2 >= minBx && ax2 <= maxBx && ay2 >= minBy && ay2 <= maxBy;
    return onA1 || onA2 || onB1 || onB2;
  }

  const tNum = (bx1 - ax1) * dby - (by1 - ay1) * dbx;
  const uNum = (bx1 - ax1) * day - (by1 - ay1) * dax;
  const t = tNum / denom;
  const u = uNum / denom;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}
