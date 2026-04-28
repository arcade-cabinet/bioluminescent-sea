import { test } from "@playwright/test";

/**
 * Iteration-2 capture spec.
 *
 * Drives the dev preview through the static surfaces that changed
 * during the iteration-1 polish loop and writes pngs into
 * `docs/screenshots/iteration-2/`. Subsequent autopilot iterations
 * pick up the captures and write `ASSESSMENT.md` against them.
 *
 * Conventions
 * -----------
 * - **No assertions.** This file is for capture only — assertions
 *   live in golden-path / identity / journey specs. A capture failure
 *   never blocks CI; the capture suite isn't in the default test
 *   project list.
 * - File names embed both project (viewport) + scene so a single dir
 *   carries every device's view of every scene without collisions.
 * - Run only against `desktop` + `mobile-portrait` for now to keep
 *   the manifest reviewable. Other projects skip via a guard.
 * - Captures land at the head of the dir (Playwright project
 *   parallelism interleaves writes; pngs are independent).
 *
 * Manual run:
 *
 *     pnpm exec playwright test e2e/capture-iteration-2.spec.ts \
 *       --project desktop --project mobile-portrait
 */

// Path relative to playwright's cwd (the repo root) so we don't
// reach for node:path / __dirname — keeps the spec free of node
// imports that confuse non-playwright type checkers.
const OUT_DIR = "docs/screenshots/iteration-2";

const ALLOWED_PROJECTS = new Set(["desktop", "mobile-portrait"]);

// Serial mode — Playwright's default parallelism (3-4 workers
// per project) made captures flake by sharing canvas/GPU
// resources; running each test in sequence inside its own
// browser context is fast enough (~30s desktop+mobile) and
// fully deterministic.
test.describe.configure({ mode: "serial" });

test.describe("iteration-2 — capture", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      !ALLOWED_PROJECTS.has(testInfo.project.name),
      `capture spec only runs against desktop + mobile-portrait (skipping ${testInfo.project.name})`,
    );
    // Reduced-motion short-circuits the LandingHero's fluidic
    // canvas (it bails to a static frame when the media query
    // matches) and tells framer-motion to skip hover springs.
    // Together with `animations: "disabled"` on each screenshot,
    // this is what makes the capture deterministic — without it
    // the perpetual canvas paint loop kept Chromium's screenshot
    // pipeline waiting on a stable frame.
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  // `animations: "disabled"` freezes CSS + framer-motion + Web
  // Animations API during capture so the LandingHero canvas /
  // mode-card hover springs don't keep `document.fonts.ready`
  // racing against perpetual paints — without it the capture
  // suite was flaky (~25 % timeout rate).
  const SHOT_OPTS = { animations: "disabled" as const, timeout: 30_000 };

  test("01 landing — full viewport", async ({ page }, testInfo) => {
    await page.goto("/");
    // Wait for the title to paint so we don't capture mid-fade-in.
    await page.getByRole("heading", { name: /bioluminescent sea/i }).waitFor();
    await page.screenshot({
      ...SHOT_OPTS,
      path: `${OUT_DIR}/01-landing-${testInfo.project.name}.png`,
      fullPage: false,
    });
  });

  test("02 mode carousel — exploration card centred", async ({ page }, testInfo) => {
    await page.goto("/");
    await page.getByTestId("mode-card-exploration").waitFor();
    await page.screenshot({
      ...SHOT_OPTS,
      path: `${OUT_DIR}/02-carousel-exploration-${testInfo.project.name}.png`,
      fullPage: false,
    });
  });

  test("03 mode carousel — descent card centred (after one next)", async ({
    page,
  }, testInfo) => {
    await page.goto("/");
    await page.getByTestId("carousel-next").click();
    await page.getByTestId("mode-card-descent").waitFor();
    // Spring transition takes ~0.3s; wait a beat so the slide settles
    // before capture instead of catching mid-translate.
    await page.waitForTimeout(450);
    await page.screenshot({
      ...SHOT_OPTS,
      path: `${OUT_DIR}/03-carousel-descent-${testInfo.project.name}.png`,
      fullPage: false,
    });
  });

  test("04 seed picker — today's chart active", async ({ page }, testInfo) => {
    await page.goto("/");
    await page.getByTestId("mode-card-exploration").click();
    await page.getByTestId("seed-picker-overlay").waitFor();
    // Initial state defaults to today's seed via dailySeed() so the
    // Today's-Chart pill should already be in its active (filled
    // check + ring) state.
    await page.getByTestId("seed-daily-button").click();
    await page.waitForTimeout(120);
    await page.screenshot({
      ...SHOT_OPTS,
      path: `${OUT_DIR}/04-seedpicker-today-${testInfo.project.name}.png`,
      fullPage: false,
    });
  });

  test("05 seed picker — after reroll (today inactive)", async ({
    page,
  }, testInfo) => {
    await page.goto("/");
    await page.getByTestId("mode-card-descent").click();
    await page.getByTestId("seed-picker-overlay").waitFor();
    await page.getByTestId("seed-reroll-button").click();
    await page.waitForTimeout(120);
    await page.screenshot({
      ...SHOT_OPTS,
      path: `${OUT_DIR}/05-seedpicker-rerolled-${testInfo.project.name}.png`,
      fullPage: false,
    });
  });

  test("06 drydock — empty state", async ({ page }, testInfo) => {
    await page.goto("/");
    await page.getByTestId("drydock-chip").click();
    await page.getByTestId("drydock-screen").waitFor();
    // Allow the drydock's mount animation to settle.
    await page.waitForTimeout(300);
    await page.screenshot({
      ...SHOT_OPTS,
      path: `${OUT_DIR}/06-drydock-${testInfo.project.name}.png`,
      fullPage: true,
    });
  });
});
