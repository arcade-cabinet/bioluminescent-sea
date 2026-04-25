import { expect, test } from "@playwright/test";

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
      timeout: 4000,
    });

    // With 80× burn, the dive's 600s of oxygen drains in roughly 7.5s.
    // Allow a 15s budget for the gameover transition.
    await expect(page.getByTestId("gameover-screen")).toBeVisible({ timeout: 15_000 });

    // Final score + stats grid should be present on the surfaced screen.
    await expect(page.getByTestId("gameover-stats")).toBeVisible();
  });
});
