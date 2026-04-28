export const GAME_DURATION = 600;
export const MAX_CHAIN_MULTIPLIER = 6;
// Chain decay window. Was 2s — too tight; casual play hovered at ×1
// because the next beacon was rarely close enough to get to inside
// 2s. Widened to 3.5s so a moderate pace sustains ×3-4, expert play
// pushes to ×6 max.
export const STREAK_WINDOW_SECONDS = 3.5;

/**
 * Passive descent speed in world-meters per second. The sub drifts
 * downward continuously; the player does not drive descent manually.
 * Tuned so a full 600s dive from surface reaches roughly the legacy
 * trench-floor depth (~6400m, mid-hadopelagic): 6400 / 600 ≈ 10.6
 * m/s. Rounded to 11 m/s. Free-roam modes continue past this point
 * until the seafloor at OCEAN_FLOOR_METERS.
 */
export const DESCENT_SPEED_METERS_PER_SECOND = 11;

/**
 * Legacy "trench floor" — kept as the depth-goal cap for any mode
 * that doesn't supply its own `targetDepthMeters`. Sits inside the
 * hadopelagic zone, well above the deepest authored point. The
 * Living Map celebration also ties to this depth via
 * `getDiveCompletionCelebration`.
 */
export const TRENCH_FLOOR_METERS = 6400;

/**
 * The deepest authored point in the world — end of the hadopelagic
 * zone, ~Challenger Deep. In infinite modes this is the floor: the
 * depth counter clamps here and the player keeps moving laterally
 * (mirrors the surface). Descent ends on its own `targetDepthMeters`
 * before reaching this — the floor only matters for free-roam modes.
 */
export const OCEAN_FLOOR_METERS = 11000;
