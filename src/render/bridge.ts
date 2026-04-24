import {
  CreatureEntity,
  DiveRoot,
  ParticleEntity,
  PirateEntity,
  PlayerAvatar,
  PredatorEntity,
  type DiveWorld,
} from "@/ecs";
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
 * exposes `renderFrame(world, bursts, viewportScale)`. The bridge
 * reads entities via Koota queries and hands typed arrays to the
 * layer controllers — the ECS is the source of truth, the sim is the
 * mutator, and the renderer is a pure consumer.
 */

export interface RenderBridge {
  renderFrame(args: RenderFrameInput): void;
  resize(widthPx: number, heightPx: number): void;
  destroy(): void;
}

export interface RenderFrameInput {
  world: DiveWorld;
  bursts: readonly CollectionBurstView[];
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
    renderFrame({ world, bursts, viewportScale }) {
      const v = viewport();

      const root = world.rootEntity.get(DiveRoot);
      const totalTime = root?.totalTime ?? 0;
      const threatFlashAlpha = root?.threatFlashAlpha ?? 0;

      const playerValue = world.playerEntity.get(PlayerAvatar)?.value;
      if (!playerValue) return;

      const creatures = world.creatureEntities.map((e) => {
        const t = e.get(CreatureEntity);
        return t?.value;
      }).filter((c): c is NonNullable<typeof c> => c !== undefined);

      const predators = world.predatorEntities.map((e) => {
        const t = e.get(PredatorEntity);
        return t?.value;
      }).filter((p): p is NonNullable<typeof p> => p !== undefined);

      const pirates = world.pirateEntities.map((e) => {
        const t = e.get(PirateEntity);
        return t?.value;
      }).filter((p): p is NonNullable<typeof p> => p !== undefined);

      const particles = world.particleEntities.map((e) => {
        const t = e.get(ParticleEntity);
        return t?.value;
      }).filter((p): p is NonNullable<typeof p> => p !== undefined);

      backdrop.draw(v.widthPx, v.heightPx, totalTime);
      parallax.draw(particles);
      entities.sync({ creatures, predators, pirates, totalTime });
      player.sync(playerValue, viewportScale, totalTime);
      fx.sync({
        player: playerValue,
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
