import type { SceneState } from "@/sim/dive/types";
import type { CollectionBurstView } from "./layers/fx";
import { mountBackdrop, type BackdropController } from "./layers/backdrop";
import { mountEntities, type EntityController } from "./layers/entities";
import { mountFx, type FxController } from "./layers/fx";
import { mountParallax, type ParallaxController } from "./layers/parallax";
import { mountPlayer, type PlayerController } from "./layers/player";
import { createStage, type PixiStage } from "./stage";

/**
 * The renderer bridge.
 *
 * Owns the pixi `Application`, mounts all layer controllers, and
 * exposes a single `renderFrame(scene, time, bursts, …)` entry point
 * the React layer calls from its RAF hook.
 *
 * In PR D the frame-state argument will be swapped for Koota queries.
 * The layer controllers stay unchanged.
 */

export interface RenderBridge {
  renderFrame(args: RenderFrameInput): void;
  resize(widthPx: number, heightPx: number): void;
  destroy(): void;
}

export interface RenderFrameInput {
  scene: SceneState;
  totalTime: number;
  bursts: readonly CollectionBurstView[];
  threatFlashAlpha: number;
  viewportScale: number;
}

export async function createRenderBridge(canvas: HTMLCanvasElement): Promise<RenderBridge> {
  const stage: PixiStage = await createStage(canvas);
  const backdrop: BackdropController = mountBackdrop(stage.layers.far);
  const parallax: ParallaxController = mountParallax(stage.layers.mid);
  const entities: EntityController = mountEntities(stage.layers.near);
  const player: PlayerController = mountPlayer(stage.layers.near);
  const fx: FxController = mountFx(stage.layers.fx);

  const viewport = () => ({
    widthPx: stage.app.renderer.width / stage.app.renderer.resolution,
    heightPx: stage.app.renderer.height / stage.app.renderer.resolution,
  });

  return {
    renderFrame({ scene, totalTime, bursts, threatFlashAlpha, viewportScale }) {
      const v = viewport();
      backdrop.draw(v.widthPx, v.heightPx, totalTime);
      parallax.draw(scene.particles);
      entities.sync({
        creatures: scene.creatures,
        predators: scene.predators,
        pirates: scene.pirates,
        totalTime,
      });
      player.sync(scene.player, viewportScale, totalTime);
      fx.sync({
        player: scene.player,
        totalTime,
        bursts,
        threatFlashAlpha,
        viewport: v,
      });
    },
    resize(widthPx, heightPx) {
      stage.resize(widthPx, heightPx);
    },
    destroy() {
      fx.destroy();
      player.destroy();
      entities.destroy();
      parallax.destroy();
      backdrop.destroy();
      stage.destroy();
    },
  };
}
