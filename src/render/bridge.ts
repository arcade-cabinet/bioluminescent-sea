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
import { mountAmbient, type AmbientController } from "./layers/ambient";
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
  /**
   * Positions where the lamp cone is currently hitting a predator.
   * The FX layer reads these as ephemeral spark-scatter sources so
   * the player sees their lamp burning predators every frame the
   * cone overlaps, not just on the 1.2s damage tick.
   */
  lampScatterPoints?: readonly { x: number; y: number }[];
  /**
   * Active threat bearings for the sonar-ring warning arcs.
   */
  threatBearings?: readonly {
    bearing: number;
    intensity: number;
    nearness: number;
  }[];
  /**
   * Position of a predator-collision impact this frame, or null.
   * The FX layer pushes it into a short ring buffer and decays
   * each entry as an expanding shockwave.
   */
  impactRippleAt?: { x: number; y: number } | null;
  /**
   * 0..1 leviathan proximity. Drives a subtle screen-edge vignette
   * pulse so the player feels something massive nearby even when
   * the silhouette is hidden in the abyss tint.
   */
  leviathanProximity?: number;
  /**
   * Active flank broadcast pairs — engager → packmate line
   * endpoints with age. The FX layer renders fading arcs.
   */
  flankBroadcasts?: readonly {
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    age: number;
    lifetime: number;
  }[];
  /**
   * True when adrenaline is active. Drives a chromatic-pulse
   * vignette in the FX layer so the slow-mo is visually obvious
   * (in addition to the deltaTime scaling).
   */
  adrenalineActive?: boolean;
  /**
   * 0..1 adrenaline readiness — 1 means the burst is armed and
   * could trigger on the next saturation. The FX layer renders a
   * thin mint pulse ring around the player that brightens with
   * readiness so the player can see when the safety net is armed.
   */
  adrenalineReadiness?: number;
  /**
   * 0..1 oxygen ratio. The FX layer reads this to intensify a
   * critical-low vignette: deep-red screen edges pulse harder as
   * the player approaches 0. Visible only below 0.18 so calm
   * play doesn't drown in red.
   */
  oxygenRatio?: number;
  /**
   * Anomaly pickups *this frame*. Each entry seeds an expanding
   * pickup ring at the location, color-keyed to the type. Edge-
   * detected by the sim (only present on the frame the pickup
   * happens) so the FX layer can push them onto its own age list.
   */
  anomalyPickups?: readonly {
    x: number;
    y: number;
    type: "repel" | "overdrive" | "lure" | "lamp-flare" | "breath";
  }[];
  /**
   * True for exactly one frame at the moment the biome changes.
   * The FX layer reads this to start a 1.4 s sweep cinematic in
   * the new biome's tint. Edge-detection is performed by the
   * caller (DiveScreen) — the FX layer just consumes the trigger.
   */
  biomeTransitionTriggered?: boolean;
  /**
   * Score popups *this frame*. Each entry seeds a "+N" text that
   * floats up and fades. The FX layer pools Text instances since
   * Text is heavyweight to instantiate per-frame. `multiplier` is
   * passed-through so the fill color can ramp with chain depth.
   */
  scorePopups?: readonly { x: number; y: number; amount: number; multiplier: number }[];
  /**
   * Bearing (radians, world-space) toward the nearest scoring
   * beacon, or null if no beacon. The FX layer paints a soft
   * mint chevron orbiting the player at this bearing so the
   * player can read direction-to-target without a full HUD chip.
   */
  beaconBearingRadians?: number | null;
  /**
   * Distance to the nearest scoring beacon in world-units. The FX
   * layer reads it to make the bearing chevron pulse faster + tint
   * warmer as the player approaches the beacon.
   */
  beaconDistance?: number;
}

export async function createRenderBridge(canvas: HTMLCanvasElement): Promise<RenderBridge> {
  const stage: PixiStage = await createStage(canvas);
  // All Pixi filters created from now on inherit the renderer's
  // resolution because `Filter.defaultOptions.resolution = "inherit"`
  // is set at module load in src/render/stage.ts. This is the
  // upstream-recommended fix for pixijs/pixijs#11467 — without it,
  // filters at default resolution=1 render to half-size textures on
  // a DPR=2 canvas and composite into the upper-left quadrant.
  const backdrop: BackdropController = mountBackdrop(stage.layers.far);
  const ambient: AmbientController = mountAmbient(stage.layers.ambient);
  const water: WaterController = mountWater(stage.layers.water);
  const parallax: ParallaxController = mountParallax(stage.layers.mid);
  const entities: EntityController = mountEntities(stage.layers.near);
  // The player sub used to live on the `near` layer, but that layer
  // also carries the refraction `DisplacementFilter`. Mounting on
  // `fx` instead keeps the sub above entities, avoids the
  // displacement filter, and shares its transform with the sonar
  // circle so they always render at the same player coordinates.
  const player: PlayerController = mountPlayer(stage.layers.fx);
  const fx: FxController = mountFx(stage.layers.fx);
  // Refraction wobble: targets the mid + near containers.
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

  // In Pixi v8 with autoDensity:true, `renderer.width/height` are
  // already in CSS pixels. The previous code divided by resolution,
  // which produced HALF-viewport bounds (640×400 instead of 1280×800
  // on a DPR=2 display) — this is what caused the upper-left
  // quadrant artifact: every layer drew its content rect to half the
  // viewport, so the godrays / caustics / depth-tint applied to only
  // the upper-left quadrant. The `clientWidth/Height` route gives the
  // CSS-pixel viewport reliably regardless of resolution config.
  const viewport = () => ({
    widthPx: stage.app.renderer.canvas.clientWidth || stage.app.renderer.width,
    heightPx: stage.app.renderer.canvas.clientHeight || stage.app.renderer.height,
  });
  const camera: Camera = createCamera(viewport());
  // Pin refraction's filterArea to the viewport from frame 0. Without
  // this initial sync the displacement filter falls back to the
  // mid/near container's content bounds, which produces a visible
  // rectangle in the upper-left while only marine snow has spawned.
  {
    const v = viewport();
    refraction.resize(v.widthPx, v.heightPx);
  }

  // Debug-only: expose the pixi app + stage layers on window so a
  // browser dev console can inspect filter state. The hook is harmless
  // in prod (no listeners react to it) and pixi devtools auto-pick it
  // up.
  if (typeof window !== "undefined") {
    (window as unknown as { __PIXI_APP__: unknown }).__PIXI_APP__ = stage.app;
  }

  return {
    camera,
    renderFrame({ world, bursts, viewportScale, biomeTintHex, lampScatterPoints, threatBearings, impactRippleAt, leviathanProximity, flankBroadcasts, adrenalineActive, adrenalineReadiness, oxygenRatio, anomalyPickups, biomeTransitionTriggered, scorePopups, beaconBearingRadians, beaconDistance }) {
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

      // Lateral follow-cam. The sim lives on a wider-than-viewport play
      // band (see sim/_shared/playBand) so the viewport can scroll
      // laterally without running out of world. By default the camera
      // centers on the player's world-x; when the active chunk's
      // archetype is locked-room the camera clamps to the chunk's
      // horizontal bounds so a shoal-press pocket doesn't let the
      // player swim away from the encounter.
      const targetScrollX = playerValue.x - v.widthPx * 0.5;
      const cameraTravel = root?.cameraTravel ?? "open";
      const lateralCameraLocked = root?.lateralCameraLocked ?? false;
      let nextScrollX = targetScrollX;
      // Mode-level camera pin (Descent). Holds scroll-x at zero so
      // the world doesn't pan with the player even though the player
      // can wiggle inside the visible viewport. Wins over chunk-
      // level travel because Descent's lateral lock is a stronger
      // claim than any per-chunk policy.
      if (lateralCameraLocked) {
        nextScrollX = 0;
      } else if (cameraTravel === "locked-room" && root) {
        const minScrollX = root.activeChunkBoundsLeftPx;
        const maxScrollX = root.activeChunkBoundsRightPx - v.widthPx;
        nextScrollX = Math.max(minScrollX, Math.min(maxScrollX, targetScrollX));
      } else if (cameraTravel === "corridor" && root) {
        // Corridor narrows lateral motion to a band centered on the
        // chunk's mid-x rather than the player's current x. The
        // chunk bounds define the world extent of the corridor; the
        // camera tracks the player inside it but can't wander past
        // 40% of the corridor width either side of the corridor
        // center, so you get the forward-pointing "glide down the
        // channel" feel without losing contact with the chunk edges.
        const corridorCenterX =
          (root.activeChunkBoundsLeftPx + root.activeChunkBoundsRightPx) * 0.5 -
          v.widthPx * 0.5;
        const corridorHalfWidth = v.widthPx * 0.4;
        const minScrollX = corridorCenterX - corridorHalfWidth;
        const maxScrollX = corridorCenterX + corridorHalfWidth;
        nextScrollX = Math.max(minScrollX, Math.min(maxScrollX, targetScrollX));
      }
      // Ease toward the target so the camera glides instead of
      // snapping when the player changes direction.
      const easedScrollX = camera.scrollXPx + (nextScrollX - camera.scrollXPx) * 0.18;
      camera.setScrollXPx(easedScrollX);

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
      ambient.draw({
        widthPx: v.widthPx,
        heightPx: v.heightPx,
        totalTime,
        depthMeters: root?.depthTravelMeters ?? 0,
        diveSeed: world.masterSeed,
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
        widthPx: v.widthPx,
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
        lampScatterPoints: lampScatterPoints ?? [],
        threatBearings: threatBearings ?? [],
        impactRippleAt: impactRippleAt ?? null,
        leviathanProximity: leviathanProximity ?? 0,
        flankBroadcasts: flankBroadcasts ?? [],
        adrenalineActive: adrenalineActive ?? false,
        adrenalineReadiness: adrenalineReadiness ?? 0,
        oxygenRatio: oxygenRatio ?? 1,
        anomalyPickups: anomalyPickups ?? [],
        biomeTransitionTriggered: biomeTransitionTriggered ?? false,
        biomeTintHex,
        scorePopups: scorePopups ?? [],
        beaconBearingRadians: beaconBearingRadians ?? null,
        beaconDistance: beaconDistance ?? Number.POSITIVE_INFINITY,
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
      refraction.resize(widthPx, heightPx);
    },
    destroy() {
      refraction.destroy();
      fx.destroy();
      player.destroy();
      entities.destroy();
      parallax.destroy();
      water.destroy();
      ambient.destroy();
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
