import type { BiomeId } from "@/sim/factories/region";

export function describeDiveObjective(
  remainingCreatures: number,
  timeLeft: number,
  nearestThreatDistance: number,
  nearestBeaconDistance = Number.POSITIVE_INFINITY,
  biome: BiomeId = "epipelagic",
  atSeafloor = false
): string {
  // Urgent banners come first — plain language, no lore jargon.
  if (remainingCreatures === 0) return "Every creature collected. Surface to finish the dive.";
  if (nearestThreatDistance < 120) return "Predator nearby. Move away.";
  if (nearestBeaconDistance < 95) return "Glowing creature close. Touch it to collect.";
  if (nearestBeaconDistance < 180) return "Glowing creature ahead — head toward it.";
  if (timeLeft <= 15) return "Oxygen low. Surface soon or grab a glowing creature for a refill.";
  // Seafloor symmetry: at the deepest authored zone the depth counter
  // is pinned and the player is free-roaming the floor — mirror the
  // surface in language, not just in mechanics.
  if (atSeafloor) return "The seafloor. As far down as you can go. Roam free, keep collecting.";

  // Ambient biome banners — names each pelagic depth zone in plain
  // English using its real ecology as the hook. The deepest tier is
  // open-ended (the hadal extends past every known dive); the copy
  // never promises a floor, the score keeps climbing as you descend.
  switch (biome) {
    case "epipelagic":
      return "Sunlight zone. Kelp drifts above, plankton clouds the water — plenty of oxygen up here.";
    case "mesopelagic":
      return "Twilight zone. Sunlight is fading — most of the glow you see now is alive.";
    case "bathypelagic":
      return "Midnight zone. Pure dark. Anglerfish hold their lures still in the column.";
    case "abyssopelagic":
      return "The abyss. Almost nothing lives down here — and what does, has come for a reason.";
    case "hadopelagic":
    default:
      return "The hadal. Pressure crushes most submarines this deep. Vent-glow stabs up from below.";
  }
}

export function getPressureLabel(oxygenRatio: number, nearestThreatDistance: number): string {
  if (nearestThreatDistance < 85) return "Critical";
  if (oxygenRatio < 0.25) return "Low oxygen";
  if (nearestThreatDistance < 160) return "Predator near";

  return "Calm";
}
