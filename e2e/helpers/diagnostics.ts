import type { Page, TestInfo } from "@playwright/test";

export interface ConsoleMessage {
  type: string;
  text: string;
  location?: { url: string; lineNumber: number };
}

export interface NetworkFailure {
  url: string;
  failure: string;
  method: string;
}

export interface DiagnosticCollector {
  consoleMessages: ConsoleMessage[];
  networkFailures: NetworkFailure[];
  pageErrors: string[];
}

/**
 * Attach listeners that quietly record every console message, page
 * error, and failed network request for the life of the page. The
 * returned collector can be dumped at any beat.
 */
export function attachCollector(page: Page): DiagnosticCollector {
  const collector: DiagnosticCollector = {
    consoleMessages: [],
    networkFailures: [],
    pageErrors: [],
  };

  page.on("console", (msg) => {
    const loc = msg.location();
    collector.consoleMessages.push({
      type: msg.type(),
      text: msg.text(),
      location: loc ? { url: loc.url, lineNumber: loc.lineNumber } : undefined,
    });
  });

  page.on("pageerror", (err) => {
    collector.pageErrors.push(err.stack ?? err.message);
  });

  page.on("requestfailed", (req) => {
    const failure = req.failure();
    collector.networkFailures.push({
      url: req.url(),
      failure: failure?.errorText ?? "unknown",
      method: req.method(),
    });
  });

  return collector;
}

interface ElementProbeResult {
  selector: string;
  count: number;
  elements: Array<{
    rect: { x: number; y: number; width: number; height: number };
    visibleInViewport: boolean;
    clippedEdges: string[];
    text: string;
  }>;
}

/**
 * For each selector, dump bounding rects and whether they are fully
 * inside the current viewport. Anything with a non-empty
 * clippedEdges array is off-screen or clipped — exactly the class of
 * bug that browser testing should expose.
 */
export async function probeElements(
  page: Page,
  selectors: readonly string[]
): Promise<ElementProbeResult[]> {
  return page.evaluate((sels) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // 1px tolerance covers sub-pixel DPR rounding (e.g. a canvas
    // sized 390.094 on a 390-wide viewport). Without this every
    // retina canvas reads as "clipped right" and buries real bugs.
    const EDGE_TOLERANCE = 1;
    // Elements positioned far off-screen (sr-only, hidden capture
    // helpers) use negative coordinates deliberately; treat those
    // as intentional and not a clipping bug.
    const FAR_OFFSCREEN = -200;

    return sels.map((selector) => {
      const nodes = Array.from(document.querySelectorAll(selector));
      return {
        selector,
        count: nodes.length,
        elements: nodes.map((node) => {
          const rect = node.getBoundingClientRect();
          const style = window.getComputedStyle(node);
          const intentionallyHidden =
            style.visibility === "hidden" ||
            style.display === "none" ||
            rect.left < FAR_OFFSCREEN ||
            rect.top < FAR_OFFSCREEN ||
            rect.width === 0 ||
            rect.height === 0;

          const clipped: string[] = [];
          if (!intentionallyHidden) {
            if (rect.left < -EDGE_TOLERANCE) clipped.push("left");
            if (rect.top < -EDGE_TOLERANCE) clipped.push("top");
            if (rect.right > vw + EDGE_TOLERANCE) clipped.push("right");
            if (rect.bottom > vh + EDGE_TOLERANCE) clipped.push("bottom");
          }

          return {
            rect: {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
            },
            visibleInViewport:
              clipped.length === 0 && rect.width > 0 && rect.height > 0 && !intentionallyHidden,
            clippedEdges: clipped,
            text: (node.textContent ?? "").trim().slice(0, 120),
          };
        }),
      };
    });
  }, selectors);
}

export interface BeatDump {
  beat: string;
  viewport: { width: number; height: number };
  url: string;
  timestamp: string;
  probes: ElementProbeResult[];
  collector: {
    newErrors: string[];
    newWarnings: string[];
    pageErrors: string[];
    networkFailures: NetworkFailure[];
  };
}

/**
 * Capture a screenshot + diagnostics snapshot for a named beat of
 * the journey. Attaches to the test report so the html reporter
 * shows them inline.
 *
 * Only surfaces errors/warnings observed since the previous beat to
 * keep diffs readable across a long journey.
 */
export async function dumpBeat(
  page: Page,
  testInfo: TestInfo,
  beat: string,
  collector: DiagnosticCollector,
  probeSelectors: readonly string[],
  seenIndex: { console: number }
): Promise<BeatDump> {
  const viewport = page.viewportSize() ?? { width: 0, height: 0 };
  const probes = await probeElements(page, probeSelectors);

  const freshMessages = collector.consoleMessages.slice(seenIndex.console);
  seenIndex.console = collector.consoleMessages.length;
  const newErrors = freshMessages.filter((m) => m.type === "error").map((m) => m.text);
  const newWarnings = freshMessages.filter((m) => m.type === "warning").map((m) => m.text);

  const slug = beat.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const project = testInfo.project.name;
  const png = testInfo.outputPath(`${project}-${slug}.png`);
  const json = testInfo.outputPath(`${project}-${slug}.json`);

  await page.screenshot({ path: png, fullPage: false, animations: "disabled", timeout: 5000 }).catch(e => {
    console.warn(`[diagnostics] screenshot timed out for ${beat}: ${e}`);
  });

  const dump: BeatDump = {
    beat,
    viewport,
    url: page.url(),
    timestamp: new Date().toISOString(),
    probes,
    collector: {
      newErrors,
      newWarnings,
      pageErrors: [...collector.pageErrors],
      networkFailures: [...collector.networkFailures],
    },
  };

  const fs = await import("node:fs/promises");
  await fs.writeFile(json, JSON.stringify(dump, null, 2));

  await testInfo.attach(`${beat} screenshot`, { path: png, contentType: "image/png" });
  await testInfo.attach(`${beat} diagnostics`, {
    path: json,
    contentType: "application/json",
  });

  return dump;
}

export function summarizeClipping(dump: BeatDump): string[] {
  const issues: string[] = [];
  for (const probe of dump.probes) {
    for (const [index, el] of probe.elements.entries()) {
      if (el.clippedEdges.length > 0) {
        issues.push(
          `${probe.selector}[${index}] clipped on ${el.clippedEdges.join("+")} (rect=${el.rect.x.toFixed(0)},${el.rect.y.toFixed(0)} ${el.rect.width.toFixed(0)}x${el.rect.height.toFixed(0)}, text="${el.text.slice(0, 40)}")`
        );
      }
    }
  }
  return issues;
}
