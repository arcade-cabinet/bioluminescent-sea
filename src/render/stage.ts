import { Application, Container } from "pixi.js";
import { applyFilterResolutionPatch } from "./filterResolutionPatch";

/**
 * PixiJS stage lifecycle + layer ordering.
 *
 * Layers, back to front:
 *   far       — abyss gradient, distant silhouettes
 *   water     — god-ray shafts + procedural caustics (fluidic layer)
 *   mid       — parallax marine snow, ridges
 *   near      — entities (creatures, predators, pirates, player)
 *   fx        — sonar ping, collection bursts, impact flashes, lamp cones
 *   overlay   — depth vignette, biome tint (above entities, below UI)
 *
 * React mounts the pixi canvas; everything else happens imperatively
 * inside pixi. `destroy()` tears down deterministically so React
 * Strict Mode double-mount doesn't leak WebGL contexts.
 */

export interface StageLayers {
  far: Container;
  water: Container;
  mid: Container;
  near: Container;
  fx: Container;
  overlay: Container;
}

export interface PixiStage {
  app: Application;
  layers: StageLayers;
  resize(widthPx: number, heightPx: number): void;
  destroy(): void;
}

export async function createStage(canvas: HTMLCanvasElement): Promise<PixiStage> {
  // Workaround for pixijs/pixijs#11467 — filters at default
  // resolution=1 render at lower res than a retina renderer,
  // producing a quadrant-clipping artifact. Apply once before any
  // app.init so the patched FilterSystem is in place when filters
  // first push.
  applyFilterResolutionPatch();

  const app = new Application();
  await app.init({
    canvas,
    resizeTo: canvas.parentElement ?? undefined,
    antialias: true,
    autoDensity: true,
    resolution: window.devicePixelRatio || 1,
    backgroundColor: 0x050a14,
    preference: "webgl",
  });

  const far = new Container();
  const water = new Container();
  const mid = new Container();
  const near = new Container();
  const fx = new Container();
  const overlay = new Container();

  far.label = "layer:far";
  water.label = "layer:water";
  mid.label = "layer:mid";
  near.label = "layer:near";
  fx.label = "layer:fx";
  overlay.label = "layer:overlay";

  app.stage.addChild(far, water, mid, near, fx, overlay);

  return {
    app,
    layers: { far, water, mid, near, fx, overlay },
    resize(widthPx, heightPx) {
      app.renderer.resize(widthPx, heightPx);
    },
    destroy() {
      app.destroy(false, { children: true, texture: true });
    },
  };
}
