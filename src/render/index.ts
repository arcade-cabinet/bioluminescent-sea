/**
 * PixiJS scene graph.
 *
 * Layer order (back to front):
 *   far      — abyss backdrop, depth fog, biome tint
 *   mid      — parallax particle bands, distant silhouettes
 *   near     — entities (creatures, predators, pirates, player)
 *   fx       — sonar pulses, lamp cones, impact flashes
 *   ui-world — world-space objective pin, landmark markers
 *
 * Responsibilities:
 * - Own the pixi.js `Application` and its ticker.
 * - Subscribe to Koota queries; imperatively sync sprite state.
 * - Never touch React. The React layer only mounts/unmounts the
 *   canvas element; everything inside is pixi.
 *
 * Filled in by PR C (renderer swap).
 */
export {};
