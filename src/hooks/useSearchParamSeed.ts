import { useEffect, useState } from "react";
import { codenameFromSeed, seedFromCodename } from "@/sim/rng";

/**
 * Read `?seed=<codename>` from the URL and return the resolved seed.
 * Returns null if the param is absent or the codename is unknown.
 *
 * The hook re-reads on popstate so navigating browser history
 * between shared-dive URLs works without a hard reload.
 */
export function useSearchParamSeed(): number | null {
  const [seed, setSeed] = useState<number | null>(() => readSeed());

  useEffect(() => {
    const handle = () => setSeed(readSeed());
    window.addEventListener("popstate", handle);
    return () => window.removeEventListener("popstate", handle);
  }, []);

  return seed;
}

/**
 * Push a `?seed=<codename>` URL for the given seed without navigating.
 * Used when a dive is started so the URL matches the active trench.
 */
export function pushSeedToUrl(seed: number): void {
  if (typeof window === "undefined") return;
  const codename = codenameFromSeed(seed);
  const slug = codename.toLowerCase().replace(/ /g, "-");
  const url = new URL(window.location.href);
  url.searchParams.set("seed", slug);
  window.history.replaceState(null, "", url.toString());
}

function readSeed(): number | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("seed");
  if (!raw) return null;
  return seedFromCodename(raw);
}
