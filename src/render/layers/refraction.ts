import {
  Container,
  DisplacementFilter,
  Sprite,
  Texture,
} from "pixi.js";

/**
 * Subtle refraction wobble applied to the scene's mid + near containers,
 * so entities and marine snow feel like they're being observed through
 * moving water. Backdrop and fluidic water layer are intentionally
 * excluded — only the *scene* needs to wobble, the water doesn't wobble
 * itself.
 *
 * The displacement source is a small noise canvas generated once, then
 * scrolled slowly across the two target containers. Amplitude is kept
 * tiny (2-4px) — more than that reads as vertigo instead of refraction.
 *
 * The noise canvas is procedurally painted; no external texture
 * fetch, no bundler weirdness.
 */

export interface RefractionController {
  /** Advance the displacement-map scroll. Call once per render frame. */
  tick(totalTime: number): void;
  /**
   * Pin every target's filterArea to the current viewport. Must be
   * called whenever the canvas resizes — otherwise pixi falls back to
   * each target's content bounds, which causes the displacement filter
   * to clip to e.g. the bounding box of the marine-snow cloud,
   * leaving a visible rectangle of "wobbled" pixels surrounded by
   * un-filtered ones.
   */
  resize(widthPx: number, heightPx: number): void;
  destroy(): void;
}

const NOISE_SIZE = 256;

function generateNoiseCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = NOISE_SIZE;
  canvas.height = NOISE_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  // Soft Perlin-ish noise via overlapping low-frequency sinusoids. Good
  // enough for a displacement source — DisplacementFilter cares about
  // the red/green channels encoding offsets, not photographic fidelity.
  const img = ctx.createImageData(NOISE_SIZE, NOISE_SIZE);
  for (let y = 0; y < NOISE_SIZE; y++) {
    for (let x = 0; x < NOISE_SIZE; x++) {
      const r = Math.sin(x * 0.04) + Math.cos(y * 0.037) + Math.sin((x + y) * 0.025);
      const g = Math.cos(x * 0.031) + Math.sin(y * 0.043) + Math.cos((x - y) * 0.022);
      const i = (y * NOISE_SIZE + x) * 4;
      img.data[i] = 128 + (r / 3) * 64;
      img.data[i + 1] = 128 + (g / 3) * 64;
      img.data[i + 2] = 128;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/**
 * Mount refraction across one-to-many target containers. Each gets its
 * own `DisplacementFilter` instance (they can't share if we want the
 * filter's input texture to remain per-container).
 */
export function mountRefraction(
  targets: readonly Container[],
  stage: Container,
): RefractionController {
  const canvas = generateNoiseCanvas();
  const texture = Texture.from(canvas);
  const displacementSprite = new Sprite(texture);
  displacementSprite.label = "refraction:source";
  // The sprite must exist in the scene graph for the filter to sample
  // it; hide it off-screen with zero scale so it never renders.
  displacementSprite.alpha = 0;
  stage.addChild(displacementSprite);

  const filters = targets.map(() => {
    const f = new DisplacementFilter({
      sprite: displacementSprite,
      scale: { x: 3.5, y: 3.5 },
    });
    f.resolution = "inherit";
    return f;
  });

  targets.forEach((t, i) => {
    const existing = Array.isArray(t.filters)
      ? t.filters
      : t.filters
        ? [t.filters]
        : [];
    t.filters = [...existing, filters[i]];
  });

  return {
    tick(totalTime) {
      // Scroll the sprite slowly on two axes so the wobble field is
      // neither stationary nor obviously periodic.
      displacementSprite.x = (Math.sin(totalTime * 0.3) * 12) % NOISE_SIZE;
      displacementSprite.y = (totalTime * 8) % NOISE_SIZE;
    },
    resize() {
      // No-op: filterArea is auto-computed from each target
      // container's content bounds. The mid + near layers carry
      // entities that span the viewport so the union is correct.
    },
    destroy() {
      // Detach the dead filters from each target before destroying them,
      // otherwise pixi tries to use freed GL resources on the next frame.
      targets.forEach((t, i) => {
        const list = Array.isArray(t.filters) ? t.filters : t.filters ? [t.filters] : [];
        t.filters = list.filter((f) => f !== filters[i]);
      });
      for (const f of filters) f.destroy?.();
      displacementSprite.destroy();
      texture.destroy();
    },
  };
}
