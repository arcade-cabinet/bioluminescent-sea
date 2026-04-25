import { expect, test } from "@playwright/test";
import { budget, CANVAS_MOUNT_BUDGET_MS } from "./helpers/budget";

/**
 * Oxygen-depletion smoke. With `?devFastDive=80` the dive's oxygen
 * budget burns 80× faster, so a 600s-default dive ends in ~7.5s wall
 * clock. Drives the dive to oxygen-zero and asserts the gameover screen
 * appears.
 *
 * The seed is pinned via `?seed=` so the test is deterministic.
 */

test.describe("Oxygen depletion", () => {
  test("?devFastDive=80 drives a dive to gameover within a few seconds", async ({ page }) => {
    await page.goto("/?seed=photic-kelpish-benthos&devFastDive=80");
    // Land + open seed picker via the Descent mode card (idempotent).
    await page.getByTestId("mode-card-descent").click();
    await expect(page.getByTestId("seed-picker-overlay")).toBeVisible();
    await page.getByTestId("begin-dive-button").click();

    await expect(page.locator('canvas[aria-label*="playfield" i]')).toBeVisible({
      timeout: CANVAS_MOUNT_BUDGET_MS,
    });

    // With 80× burn, the dive's seed-resolved oxygen budget (Descent
    // ranges 600–780s) drains in 7.5–9.75s wall clock. Local runs stay
    // tight at 20s; CI doubles via the budget helper to absorb slow
    // tablet-portrait containers + the per-frame Yuka brain tick added
    // in PR #134 (StateMachine + MemorySystem + FuzzyModule per
    // predator) which adds noticeable per-tick CPU on slow runners.
    // Bumped from 15s after that PR's first run flaked at ~18s on
    // tablet-portrait.
    await expect(page.getByTestId("gameover-screen")).toBeVisible({ timeout: budget(20_000) });

    // Final score + stats grid should be present on the surfaced screen.
    await expect(page.getByTestId("gameover-stats")).toBeVisible();
  });
});
