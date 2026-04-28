import type { BiomeId } from "@/sim/factories/region";

export function describeDiveObjective(
  remainingCreatures: number,
  timeLeft: number,
  nearestThreatDistance: number,
  nearestBeaconDistance = Number.POSITIVE_INFINITY,
  biome: BiomeId = "photic-gate"
): string {
  // Urgent banners come first — plain language, no lore jargon.
  if (remainingCreatures === 0) return "Every creature collected. Surface to finish the dive.";
  if (nearestThreatDistance < 120) return "Predator nearby. Move away.";
  if (nearestBeaconDistance < 95) return "Glowing creature close. Touch it to collect.";
  if (nearestBeaconDistance < 180) return "Glowing creature ahead — head toward it.";
  if (timeLeft <= 15) return "Oxygen low. Surface soon or grab a glowing creature for a refill.";

  // Ambient biome banners — these name the current depth zone in
  // plain English. The deepest tier is open-ended: descent has no
  // floor, so the copy never promises one. Past the named zones the
  // ocean keeps going and the score keeps climbing.
  switch (biome) {
    case "photic-gate":
      return "Sunlit shallows. Plenty of oxygen up here — get a feel for the controls.";
    case "twilight-shelf":
      return "The light is fading. Predators hunt in the dim layers — keep moving.";
    case "midnight-column":
      return "True dark now. Watch for shapes between the glow trails.";
    case "abyssal-trench":
      return "Deep water. Oxygen burns faster down here. Every collect helps.";
    case "stygian-abyss":
    default:
      return "Uncharted depths. The ocean keeps going — so does your score.";
  }
}

export function getPressureLabel(oxygenRatio: number, nearestThreatDistance: number): string {
  if (nearestThreatDistance < 85) return "Critical";
  if (oxygenRatio < 0.25) return "Low oxygen";
  if (nearestThreatDistance < 160) return "Predator near";

  return "Calm";
}
