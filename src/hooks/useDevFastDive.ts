import { useEffect, useState } from "react";

/**
 * Test/dev flag. When `?devFastDive=1` is present in the URL, the dive
 * loop applies an oxygen-burn multiplier so a 600s budget elapses in
 * a few seconds wall-clock. Used by the Playwright oxygen-depletion
 * spec to drive a dive to the gameover screen without waiting 10
 * minutes. Has no effect in production builds (the URL never carries
 * the flag).
 *
 * Returns `1` for normal pace, `> 1` for accelerated burn. The dive
 * loop multiplies its `deltaTime` by this value for the oxygen
 * countdown only — entity sim continues at real time.
 */
export function useDevFastDive(): number {
  const [scale, setScale] = useState<number>(() => readFromUrl());
  useEffect(() => {
    const onPop = () => setScale(readFromUrl());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  return scale;
}

function readFromUrl(): number {
  if (typeof window === "undefined") return 1;
  try {
    const url = new URL(window.location.href);
    const flag = url.searchParams.get("devFastDive");
    if (flag === "1") return 80; // 80× pace — 600s budget burns in ~7.5s.
    if (flag && /^\d+$/.test(flag)) {
      const n = Number.parseInt(flag, 10);
      return n > 0 && n < 1000 ? n : 1;
    }
  } catch {
    // ignore — fall through to default
  }
  return 1;
}
