/**
 * Lateral play band — the world in x is wider than the viewport.
 *
 * Before this module the viewport was the world: player, creatures,
 * predators, pirates all clamped to [0, width]. That made the
 * playable space feel like a sealed box. Now x lives in the
 * play-band `[-PLAY_BAND_PAD_FACTOR*width, (1+PLAY_BAND_PAD_FACTOR)*width]`
 * — i.e. the viewport is centered inside a band that extends 0.7×
 * viewport-widths to either side, for a total play band of 2.4×
 * viewport width. The camera follows the player laterally with a
 * dead-zone so small motions don't swing the frame, but walking to
 * the edge reveals creatures you couldn't see from the default
 * vantage.
 *
 * All sim functions keep operating in pixel units; this module just
 * tells them *which* pixels are legal.
 */

/** The viewport-pad factor on each side. 0.7 → 2.4× viewport total. */
export const PLAY_BAND_PAD_FACTOR = 0.7;

/** Left edge of the band in pixel-x. */
export function playBandMinX(width: number): number {
  return -width * PLAY_BAND_PAD_FACTOR;
}

/** Right edge of the band in pixel-x. */
export function playBandMaxX(width: number): number {
  return width * (1 + PLAY_BAND_PAD_FACTOR);
}

/** Clamp a pixel-x to the lateral play band. */
export function clampToPlayBand(x: number, width: number): number {
  const min = playBandMinX(width);
  const max = playBandMaxX(width);
  return x < min ? min : x > max ? max : x;
}

/** Full width of the play band in pixels. */
export function playBandWidth(width: number): number {
  return playBandMaxX(width) - playBandMinX(width);
}

/**
 * Wrap a pixel-x around the play band — like `wrapCoordinate` but
 * operating on [playBandMinX - padding, playBandMaxX + padding]
 * rather than [0, width]. Creatures that drift off the band's right
 * edge re-enter from the left instead of disappearing.
 */
export function wrapAroundPlayBand(
  x: number,
  width: number,
  padding: number,
): number {
  const min = playBandMinX(width) - padding;
  const max = playBandMaxX(width) + padding;
  if (x < min) return max;
  if (x > max) return min;
  return x;
}
