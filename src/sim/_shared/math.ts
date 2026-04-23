/**
 * Private math helpers shared across src/sim/*. Not part of any module
 * barrel — callers import from here directly so the scope is visible.
 */

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function round(value: number, precision = 2): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export function wrapCoordinate(value: number, max: number, padding: number): number {
  if (value < -padding) return max + padding;
  if (value > max + padding) return -padding;
  return value;
}

export function interpolateAngle(current: number, target: number, amount: number): number {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * clamp(amount, 0, 1);
}

export function normalizedHash(index: number, step: number, modulo: number): number {
  return ((index * step + step * 0.5) % modulo) / modulo;
}

/** Scales a per-frame value so behavior is frame-rate independent. */
export function getFrameScale(deltaTime: number): number {
  return clamp(deltaTime * 60, 0, 3);
}
