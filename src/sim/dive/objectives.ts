export function describeDiveObjective(
  remainingCreatures: number,
  timeLeft: number,
  nearestThreatDistance: number,
  nearestBeaconDistance = Number.POSITIVE_INFINITY
): string {
  if (remainingCreatures === 0) return "All beacons charted. Surface with the living map.";
  if (nearestThreatDistance < 120) return "Predator silhouette closing. Glide out of its cone.";
  if (nearestBeaconDistance < 95) return "Sonar ping is tight. Sweep the lamp through this bloom.";
  if (nearestBeaconDistance < 180) return "Route marker ahead. Follow the beacon chain deeper.";
  if (timeLeft <= 15) return "Oxygen low. Chain the brightest beacons before ascent.";

  return "Collect luminous life while reading silhouettes at the edge of the light.";
}

export function getPressureLabel(oxygenRatio: number, nearestThreatDistance: number): string {
  if (nearestThreatDistance < 85) return "Critical";
  if (oxygenRatio < 0.25) return "Ascent";
  if (nearestThreatDistance < 160) return "Hunted";

  return "Calm";
}
