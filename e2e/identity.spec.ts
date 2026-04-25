import { test, expect } from "@playwright/test";

/**
 * Identity contract tests.
 *
 * These exist because human visual QA missed real regressions in
 * earlier passes. Every assertion here corresponds to a thing the
 * brand-identity overhaul promised: typography lives, the carousel
 * scales, no boxy chip pills survive on the player journey.
 *
 * Each project (mobile-portrait, mobile-landscape, tablet-portrait,
 * desktop) runs the same checks because the regressions historically
 * hit specific viewports.
 */

test.describe("Bioluminescent Sea — identity contract", () => {
  test("the carousel renders on every viewport (no fixed grid)", async ({
    page,
  }) => {
    await page.goto("/");
    // Mode carousel is the universal picker — no 3-up grid lives
    // anywhere. The data-testid must be present on every device.
    await expect(page.getByTestId("mode-carousel")).toBeVisible();

    // Page-dot tabs must exist for every SESSION_MODE so the
    // carousel can scale to N modes (the whole reason it replaced
    // the 3-up grid).
    await expect(page.getByTestId("mode-dot-exploration")).toBeAttached();
    await expect(page.getByTestId("mode-dot-descent")).toBeAttached();
    await expect(page.getByTestId("mode-dot-arena")).toBeAttached();
  });

  test("all three mode cards are reachable from the carousel", async ({
    page,
  }) => {
    await page.goto("/");
    // Each mode-card button must be in the DOM — Playwright's
    // auto-scroll handles bringing fractional/peeked cards into view
    // before clicking. This is the contract that lets the same
    // testids work on phones (one card per page) and desktop (peek).
    await expect(page.getByTestId("mode-card-exploration")).toBeAttached();
    await expect(page.getByTestId("mode-card-descent")).toBeAttached();
    await expect(page.getByTestId("mode-card-arena")).toBeAttached();
  });

  test("the title is set in Cinzel (display) — not Cormorant", async ({
    page,
  }) => {
    await page.goto("/");
    const heading = page.getByRole("heading", { name: /bioluminescent sea/i });
    await expect(heading).toBeVisible();
    // The webfont takes a moment to load; wait for fonts to settle
    // before reading computed style.
    await page.evaluate(() => document.fonts.ready);
    const family = await heading.evaluate(
      (el) => window.getComputedStyle(el).fontFamily,
    );
    // Cinzel must be the *first* family the browser tried. If the
    // identity ever regresses to Cormorant the assertion fires.
    expect(family).toMatch(/^['"]?Cinzel['"]?/);
  });

  test("the body type is Spectral (literary serif) — not Inter", async ({
    page,
  }) => {
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    // The body font is set on <body>. If Inter ever creeps back
    // (or any sans-serif), the family chain won't lead with
    // Spectral.
    const bodyFamily = await page.evaluate(
      () => window.getComputedStyle(document.body).fontFamily,
    );
    expect(bodyFamily).toMatch(/^['"]?Spectral['"]?/);
  });

  test("EmbossFilters SVG mounts on the landing", async ({ page }) => {
    await page.goto("/");
    // The three filter ids must exist in the DOM — every screen
    // that uses the bs-emboss-glow / bs-soft-glow / bs-warm-glow
    // text-shadows depends on this primitive being mounted.
    const ids = await page.evaluate(() =>
      Array.from(document.querySelectorAll("filter")).map((f) => f.id),
    );
    expect(ids).toContain("bs-emboss-glow");
    expect(ids).toContain("bs-soft-glow");
    expect(ids).toContain("bs-warm-glow");
  });

  test("mode cards do NOT use the old boxy abyss tile background", async ({
    page,
  }) => {
    // Identity rule: no rectangular bg-abyss tile under the mode
    // labels. The cards use a radial mint wash with no border.
    // Asserting *visible* style: a solid abyss bg would compute as
    // rgb(10, 26, 46). If any card regresses to that, fire.
    await page.goto("/");
    await expect(page.getByTestId("mode-card-exploration")).toBeAttached();
    const bgColors = await page.evaluate(() => {
      const cards = Array.from(
        document.querySelectorAll('[data-testid^="mode-card-"]'),
      );
      return cards.map((c) => window.getComputedStyle(c).backgroundColor);
    });
    // Each card's computed bg-color must NOT be the abyss tile.
    // (The radial wash uses background-image, not background-color.)
    for (const bg of bgColors) {
      expect(bg).not.toBe("rgb(10, 26, 46)");
      // And not pure abyss-bg either.
      expect(bg).not.toBe("rgb(5, 10, 20)");
    }
  });

  test("the in-dive HUD does NOT use the old boxy chip pill background", async ({
    page,
  }) => {
    // Walk into a dive, then check whichever HUD variant the device
    // class renders. On tablet/desktop the full HUD is inline so we
    // look at hud-stat-score; on phones the compact primary cluster
    // (hud-compact-oxygen) carries the always-visible readouts.
    // Either variant must be transparent — the boxy chip pill is gone.
    await page.goto("/");
    await page.getByTestId("mode-card-descent").click();
    await page.getByTestId("begin-dive-button").click();
    // Wait for either readout to mount.
    const fullScore = page.getByTestId("hud-stat-score");
    const compactOxygen = page.getByTestId("hud-compact-oxygen");
    await expect(fullScore.or(compactOxygen)).toBeVisible({ timeout: 10_000 });
    // Inspect whichever rendered.
    const target = (await fullScore.isVisible().catch(() => false))
      ? fullScore
      : compactOxygen;
    const bg = await target.evaluate(
      (el) => window.getComputedStyle(el).backgroundColor,
    );
    // Computed bg must be transparent — the pill cluster is gone.
    expect(bg === "rgba(0, 0, 0, 0)" || bg === "transparent").toBeTruthy();
  });

  test("carousel shows ONE card at a time, not a static 3-up row", async ({
    page,
  }) => {
    // Regression: the homegrown carousel was rendering all 3 cards
    // side-by-side on desktop because slide widths were 34% (so all
    // 3 fit). The contract is one centred card per page; only the
    // active card should be in the visible viewport rect of the
    // carousel container. Off-page neighbours sit outside `overflow:
    // hidden` and can still be queried in DOM, but their boundingRect
    // must not overlap the carousel's visible width.
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    const carousel = page.getByTestId("mode-carousel");
    await expect(carousel).toBeVisible();

    const visibleCards = await page.evaluate(() => {
      const carouselEl = document.querySelector('[data-testid="mode-carousel"]');
      if (!carouselEl) return -1;
      const cRect = carouselEl.getBoundingClientRect();
      const cards = Array.from(
        document.querySelectorAll('[data-testid^="mode-card-"]'),
      );
      // A card is "visibly inside the carousel viewport" if its rect
      // overlaps the carousel's rect by more than 50% of its own width.
      return cards.filter((card) => {
        const r = card.getBoundingClientRect();
        const overlapL = Math.max(r.left, cRect.left);
        const overlapR = Math.min(r.right, cRect.right);
        const overlap = Math.max(0, overlapR - overlapL);
        return overlap > r.width * 0.5;
      }).length;
    });
    expect(visibleCards).toBe(1);
  });

  test("the dive playfield is not permanently washed red", async ({ page }) => {
    // Regression: a 'threatAlert' radial gradient was painting the
    // whole canvas warm-red whenever any predator was within 180px.
    // With the new AI patrolling at 380px the wash was effectively
    // always on. Identity rule: warm red is reserved for actual
    // close-contact (<90px) AND must not bleach the playfield.
    await page.goto("/");
    await page.getByTestId("mode-card-descent").click();
    await page.getByTestId("begin-dive-button").click();
    // Let the dive run a few seconds so any threat-flash overlay
    // would have stuck on by now.
    await page.waitForTimeout(4000);

    // Check ALL warn-red radial overlays sized to the canvas. None
    // should be active at typical play distances; if a predator is
    // truly close (<90px) the overlay is allowed but its alpha is
    // capped at <= 0.32. We assert that no red-tinted overlay has
    // computed opacity * gradient-alpha >= 0.40.
    const tooBleached = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll("*"));
      for (const el of all) {
        const cs = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const isFullScreen =
          rect.width >= window.innerWidth * 0.9 &&
          rect.height >= window.innerHeight * 0.9;
        if (!isFullScreen) continue;
        const bgi = cs.backgroundImage || "";
        // Match red-ish RGB in gradient stops.
        const m = bgi.match(/rgba?\(\s*255[^)]*?(?:107|0)[^)]*?(?:107|0)[^)]*?(?:,\s*([0-9.]+))?\s*\)/i);
        if (!m) continue;
        const stopAlpha = m[1] ? Number.parseFloat(m[1]) : 1;
        const elementOpacity = Number.parseFloat(cs.opacity || "1");
        if (stopAlpha * elementOpacity >= 0.4) {
          return {
            bgi: bgi.slice(0, 200),
            opacity: cs.opacity,
            tag: el.tagName,
          };
        }
      }
      return null;
    });
    expect(tooBleached).toBeNull();
  });

  test("the dive objective banner is not a bordered chip pill", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByTestId("mode-card-descent").click();
    await page.getByTestId("begin-dive-button").click();
    const banner = page.getByTestId("objective-banner");
    await expect(banner).toBeVisible({ timeout: 10_000 });
    const styles = await banner.evaluate((el) => {
      const cs = window.getComputedStyle(el);
      return { bg: cs.backgroundColor, border: cs.borderTopWidth };
    });
    // Identity: no chip background, no border.
    expect(styles.bg).toBe("rgba(0, 0, 0, 0)");
    expect(styles.border).toBe("0px");
  });

  test("the seed picker dialog has no opaque abyss tile", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("mode-card-descent").click();
    const overlay = page.getByTestId("seed-picker-overlay");
    await expect(overlay).toBeVisible();
    // Dialog uses a radial wash via background-image, not a flat
    // abyss tile. backgroundImage must contain a gradient string,
    // not the literal "none".
    const bgImage = await overlay.evaluate(
      (el) => window.getComputedStyle(el).backgroundImage,
    );
    expect(bgImage).toMatch(/gradient/i);
  });
});
