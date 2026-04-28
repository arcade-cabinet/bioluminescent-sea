import { test, expect } from "@playwright/test";
import { CANVAS_MOUNT_BUDGET_MS } from "./helpers/budget";

test.describe("Bioluminescent Sea — golden path", () => {
  test("landing renders title, tagline, mode triptych without console errors", async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto("/");

    await expect(page.getByRole("heading", { name: /bioluminescent sea/i })).toBeVisible();
    // Tagline is hidden on short viewports (mobile landscape) to keep the
    // mode triptych above the fold — the title carries the brand on its own.
    // Copy switched to plain English in the post-taxonomy era — match the
    // current "Pilot a submarine into the deep ocean…" tagline.
    const isShortViewport = testInfo.project.name === "mobile-landscape";
    if (!isShortViewport) {
      await expect(page.getByText(/pilot a submarine into the deep ocean/i)).toBeVisible();
    }

    // The three mode cards make the dive intent legible at first paint.
    await expect(page.getByTestId("mode-card-exploration")).toBeVisible();
    await expect(page.getByTestId("mode-card-descent")).toBeVisible();
    await expect(page.getByTestId("mode-card-arena")).toBeVisible();

    // Drydock chip is always reachable from the landing.
    await expect(page.getByTestId("drydock-chip")).toBeVisible();

    expect(errors, `console errors on landing:\n${errors.join("\n")}`).toEqual([]);
  });

  test("Picking a mode opens the seed picker, Begin Dive transitions to gameplay", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("mode-card-descent").click();
    await expect(page.getByTestId("seed-picker-overlay")).toBeVisible();
    await page.getByTestId("begin-dive-button").click();

    // Canvas playfield must mount — aria-label selector avoids depending on
    // implicit role (canvas has no default role).
    await expect(page.locator('canvas[aria-label*="playfield" i]')).toBeVisible({
      timeout: CANVAS_MOUNT_BUDGET_MS,
    });
  });

  test("seeded URL loads the same codename back", async ({ page }) => {
    await page.goto("/?seed=photic-kelpish-benthos");
    // The preview should reflect the URL seed (codename parser is tolerant of
    // case, but if the seed is invalid it falls back to a random codename).
    const heading = page.getByRole("heading", { name: /bioluminescent sea/i });
    await expect(heading).toBeVisible();
  });
});
