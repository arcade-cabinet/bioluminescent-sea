import type { BiomeId } from "@/sim/factories/region";

export function describeDiveObjective(
  remainingCreatures: number,
  timeLeft: number,
  nearestThreatDistance: number,
  nearestBeaconDistance = Number.POSITIVE_INFINITY,
  biome: BiomeId = "photic-gate"
): string {
  if (remainingCreatures === 0) return "All beacons charted. Surface with the living map.";
  if (nearestThreatDistance < 120) return "Predator silhouette closing. Glide out of its cone.";
  if (nearestBeaconDistance < 95) return "Sonar ping is tight. Sweep the lamp through this bloom.";
  if (nearestBeaconDistance < 180) return "Route marker ahead. Follow the beacon chain deeper.";
  if (timeLeft <= 15) return "Oxygen low. Chain the brightest beacons before ascent.";

  // Biome-specific ambient objective when nothing more urgent is true.
  switch (biome) {
    case "photic-gate":
      return "Drift through the plankton gate. Let the light teach you the current.";
    case "twilight-shelf":
      return "The shelf is listening. Cross its lantern shadows without making a wake.";
    case "midnight-column":
      return "Read the column by its blooms. Anglers wait in the quiet between them.";
    case "abyssal-trench":
      return "You are in the Living Map. Follow the whalefall before the lanterns find you.";
    case "stygian-abyss":
    default:
      return "You have gone too far. There is only the abyss.";
  }
}

export function getPressureLabel(oxygenRatio: number, nearestThreatDistance: number): string {
  if (nearestThreatDistance < 85) return "Critical";
  if (oxygenRatio < 0.25) return "Ascent";
  if (nearestThreatDistance < 160) return "Hunted";

  return "Calm";
}
