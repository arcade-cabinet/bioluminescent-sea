export const GAME_DURATION = 600;
export const MAX_CHAIN_MULTIPLIER = 5;
export const STREAK_WINDOW_SECONDS = 2;

/**
 * Passive descent speed in world-meters per second. The sub drifts
 * downward continuously; the player does not drive descent manually.
 * Tuned so a full 600s dive from surface reaches roughly the abyssal
 * floor (~3200m): 3200 / 600 ≈ 5.3 m/s. Rounded up to 6 m/s so the
 * column feels committed without outrunning the content window.
 */
export const DESCENT_SPEED_METERS_PER_SECOND = 6;

/**
 * Target trench floor. A dive that reaches this depth completes the
 * Living Map (ties to `getDiveCompletionCelebration`). The content
 * pipeline's abyssal-trench biome ends here.
 */
export const TRENCH_FLOOR_METERS = 3200;
