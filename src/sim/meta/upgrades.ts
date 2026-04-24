export interface SubUpgrades {
  hull: number;     // Reduces impact penalty
  battery: number;  // Increases oxygen duration
  motor: number;    // Increases lateral speed
  lamp: number;     // Increases light cone radius
}

export const MAX_UPGRADE_LEVEL = 5;

export const UPGRADE_COSTS = [
  0,      // Level 0 -> 1
  500,    // Level 1 -> 2
  1200,   // Level 2 -> 3
  2500,   // Level 3 -> 4
  5000,   // Level 4 -> 5
  10000,  // Max level cost (not really used if capped)
];

export const DEFAULT_UPGRADES: SubUpgrades = {
  hull: 0,
  battery: 0,
  motor: 0,
  lamp: 0,
};

export function getUpgradeCost(currentLevel: number): number {
  if (currentLevel >= MAX_UPGRADE_LEVEL) return Number.POSITIVE_INFINITY;
  return UPGRADE_COSTS[currentLevel + 1] ?? Number.POSITIVE_INFINITY;
}
