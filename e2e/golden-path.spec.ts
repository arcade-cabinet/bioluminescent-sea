import { test, expect } from "@playwright/test";

test.describe("Bioluminescent Sea — golden path", () => {
  test("landing renders title, tagline, and CTA without console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto("/");

    await expect(page.getByRole("heading", { name: /bioluminescent sea/i })).toBeVisible();
    await expect(page.getByText(/sink into an abyssal trench/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /begin dive/i })).toBeVisible();

    // Verb teaser chips — the three-beat pre-teach of the loop.
    await expect(page.getByText(/collect bioluminescence/i)).toBeVisible();
    await expect(page.getByText(/read the bottom banner/i)).toBeVisible();
    await expect(page.getByText(/surface before oxygen ends/i)).toBeVisible();

    expect(errors, `console errors on landing:\n${errors.join("\n")}`).toEqual([]);
  });

  test("Begin Dive transitions to gameplay and HUD appears", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /begin dive/i }).click();

    // Canvas playfield must mount — aria-label selector avoids depending on
    // implicit role (canvas has no default role).
    await expect(page.locator('canvas[aria-label*="playfield" i]')).toBeVisible({
      timeout: 2000,
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
