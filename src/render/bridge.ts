import {
  AnomalyEntity,
  CreatureEntity,
  DiveRoot,
  ParticleEntity,
  PirateEntity,
  PlayerAvatar,
  PredatorEntity,
  type DiveWorld,
} from "@/ecs";
import type { Creature, Particle, Pirate, Predator } from "@/sim/entities/types";
import { createCamera, type Camera } from "./camera";
import type { CollectionBurstView } from "./layers/fx";
import { mountBackdrop, type BackdropController } from "./layers/backdrop";
import { mountEntities, type EntityController } from "./layers/entities";
import { mountFx, type FxController } from "./layers/fx";
import { mountParallax, type ParallaxController } from "./layers/parallax";
import { mountPlayer, type PlayerController } from "./layers/player";
import { mountRefraction, type RefractionController } from "./layers/refraction";
import { mountWater, type WaterController } from "./layers/water";
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
  /**
   * The live camera. Layers can read `camera.project(world)` or
   * `camera.scrollMeters` to translate world-space coordinates to
   * screen pixels. The bridge keeps the camera's scroll in sync with
   * the sim's `DiveRoot.depthTravelMeters` on every frame.
   */
  readonly camera: Camera;
}

export interface RenderFrameInput {
  world: DiveWorld;
  bursts: readonly CollectionBurstView[];
  viewportScale: number;
  /**
   * Current biome tint (hex like `#0c3a48`). The backdrop layer uses
   * this to tint the abyss gradient on top of the palette so biome
   * transitions are visible without overwhelming the identity.
   */
  biomeTintHex?: string;
}

export async function createRenderBridge(canvas: HTMLCanvasElement): Promise<RenderBridge> {
  const stage: PixiStage = await createStage(canvas);
  const backdrop: BackdropController = mountBackdrop(stage.layers.far);
  const water: WaterController = mountWater(stage.layers.water);
  const parallax: ParallaxController = mountParallax(stage.layers.mid);
  const entities: EntityController = mountEntities(stage.layers.near);
  const player: PlayerController = mountPlayer(stage.layers.near);
  const fx: FxController = mountFx(stage.layers.fx);
  // Refraction wobble: targets the mid + near containers so marine snow
  // and entities feel observed through moving water. Backdrop, water,
  // FX, and overlay stay sharp on purpose.
  const refraction: RefractionController = mountRefraction(
    [stage.layers.mid, stage.layers.near],
    stage.app.stage,
  );

  // Scratch buffers — reused each frame so the render bridge allocates
  // zero intermediate arrays during steady-state play. Holes from
  // missing traits are skipped in place (length tracked explicitly).
  const anomaliesBuf: import("@/sim/entities/types").Anomaly[] = [];
  const creatureBuf: Creature[] = [];
  const predatorBuf: Predator[] = [];
  const pirateBuf: Pirate[] = [];
  const particleBuf: Particle[] = [];

  const viewport = () => ({
    widthPx: stage.app.renderer.width / stage.app.renderer.resolution,
    heightPx: stage.app.renderer.height / stage.app.renderer.resolution,
  });
  const camera: Camera = createCamera(viewport());

  return {
    camera,
    renderFrame({ world, bursts, viewportScale, biomeTintHex }) {
      const v = viewport();

      // Keep the camera's viewport + scroll in sync with the sim.
      // Layers don't read this yet, but the infra is live so F.4's
      // layer cut-over is a pure consumer change.
      camera.setViewport(v.widthPx, v.heightPx);

      const root = world.rootEntity.get(DiveRoot);
      const totalTime = root?.totalTime ?? 0;
      const threatFlashAlpha = root?.threatFlashAlpha ?? 0;
      camera.setScrollMeters(root?.depthTravelMeters ?? 0);

      const playerValue = world.playerEntity.get(PlayerAvatar)?.value;
      if (!playerValue) return;

      const anomalies = collectTraitValues(
        world.anomalyEntities,
        AnomalyEntity,
        anomaliesBuf
      );
      const creatures = collectTraitValues(
        world.creatureEntities,
        CreatureEntity,
        creatureBuf,
      );
      const predators = collectTraitValues(
        world.predatorEntities,
        PredatorEntity,
        predatorBuf,
      );
      const pirates = collectTraitValues(
        world.pirateEntities,
        PirateEntity,
        pirateBuf,
      );
      const particles = collectTraitValues(
        world.particleEntities,
        ParticleEntity,
        particleBuf,
      );

      backdrop.draw({
        widthPx: v.widthPx,
        heightPx: v.heightPx,
        totalTime,
        biomeTintHex,
        depthMeters: root?.depthTravelMeters ?? 0,
      });
      water.draw({
        widthPx: v.widthPx,
        heightPx: v.heightPx,
        totalTime,
        depthMeters: root?.depthTravelMeters ?? 0,
        biomeTintHex,
      });
      refraction.tick(totalTime);
      parallax.draw({
        particles,
        heightPx: v.heightPx,
        depthMeters: root?.depthTravelMeters ?? 0,
        pxPerMeter: camera.pxPerMeter,
      });
      entities.sync({ anomalies, creatures, predators, pirates, totalTime, camera });
      player.sync(playerValue, viewportScale, totalTime);
      fx.sync({
        player: playerValue,
        totalTime,
        bursts,
        threatFlashAlpha,
        viewport: v,
      });

      // Apply camera shake to the entire stage based on threatFlashAlpha
      if (threatFlashAlpha > 0) {
        const intensity = threatFlashAlpha * 12; // max shake pixels
        const shakeX = (Math.random() - 0.5) * intensity;
        const shakeY = (Math.random() - 0.5) * intensity;
        stage.app.stage.position.set(shakeX, shakeY);
      } else {
        stage.app.stage.position.set(0, 0);
      }
    },
    resize(widthPx, heightPx) {
      stage.resize(widthPx, heightPx);
      water.resize(widthPx, heightPx);
    },
    destroy() {
      refraction.destroy();
      fx.destroy();
      player.destroy();
      entities.destroy();
      parallax.destroy();
      water.destroy();
      backdrop.destroy();
      stage.destroy();
    },
  };
}

// biome-ignore lint/suspicious/noExplicitAny: Koota trait tokens vary per trait; values are homogeneous.
function collectTraitValues<T>(entities: readonly { get(trait: any): { value: T } | undefined }[], trait: any, buf: T[]): readonly T[] {
  let write = 0;
  for (let i = 0; i < entities.length; i++) {
    const t = entities[i].get(trait);
    if (t === undefined) continue;
    buf[write++] = t.value;
  }
  if (buf.length > write) buf.length = write;
  return buf;
}
