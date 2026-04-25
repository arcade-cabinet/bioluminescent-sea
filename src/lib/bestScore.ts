export const BEST_SCORE_KEY = "bioluminescent-sea:v1:best-score";

export function getBestScore(): number {
  if (typeof localStorage === "undefined") return 0;
  try {
    const raw = localStorage.getItem(BEST_SCORE_KEY);
    const parsed = raw ? Number(raw) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    // localStorage access can throw in Safari private mode and in
    // sandboxed iframes — the saver path already swallows write errors,
    // the reader has to match.
    return 0;
  }
}

export function recordScoreIfBest(score: number): number {
  const best = getBestScore();
  if (score > best) {
    try {
      localStorage.setItem(BEST_SCORE_KEY, String(score));
    } catch {
      // ignore
    }
    return score;
  }
  return best;
}
