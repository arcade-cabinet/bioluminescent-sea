import { AnimatePresence, motion } from "framer-motion";
import { Anchor, BatteryCharging, Lightbulb, RotateCcw, Wrench } from "lucide-react";
import { useEffect, useRef, useState, type ComponentType } from "react";
import type { SessionMode } from "@/sim";
import { getUpgradeCost, MAX_UPGRADE_LEVEL, type SubUpgrades } from "@/sim/meta/upgrades";
import { codenameFromSeed } from "@/sim/rng";
import { getPersonalBests } from "@/lib/personalBests";
import {
  getAchievementProgress,
  listAchievementsWithUnlockState,
} from "@/lib/achievements";
import {
  formatElapsed,
  formatRelativeTime,
  getDiveHistory,
} from "@/lib/diveHistory";
import {
  computeAggregateStats,
  computeScoreTrendSeries,
  projectTrendPoint,
} from "@/lib/diveAnalytics";
import { Button, EmbossFilters } from "@/ui/primitives";
import { LandingHero } from "@/ui/shell/LandingHero";

interface DrydockScreenProps {
  currency: number;
  upgrades: SubUpgrades;
  onBuy: (type: keyof SubUpgrades) => void;
  onBack: () => void;
  /**
   * Replay a logged dive on the same seed + mode. Optional: when
   * absent, history rows render as static log entries (no replay
   * affordance). Wired up in production from Game.tsx.
   */
  onReplayDive?: (seed: number, mode: SessionMode) => void;
}

interface UpgradeRowDef {
  id: keyof SubUpgrades;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}

const UPGRADE_ROWS: UpgradeRowDef[] = [
  {
    id: "hull",
    label: "Hull plating",
    description: "Reduces oxygen lost during collisions.",
    icon: Anchor,
  },
  {
    id: "battery",
    label: "Battery capacity",
    description: "Extends base dive duration.",
    icon: BatteryCharging,
  },
  {
    id: "motor",
    label: "Engine thrusters",
    description: "Increases lateral movement speed.",
    icon: Wrench,
  },
  {
    id: "lamp",
    label: "Halogen lamp",
    description: "Widens and lengthens the front light cone.",
    icon: Lightbulb,
  },
];

/**
 * Drydock — surface workshop. Shares the same aquatic backdrop as
 * the landing (the player's still in the water; the dock is just the
 * surface end of the dive). Upgrades read as ink-on-water rows, no
 * boxy cards.
 */
export function DrydockScreen({
  currency,
  upgrades,
  onBuy,
  onBack,
  onReplayDive,
}: DrydockScreenProps) {
  return (
    <motion.div
      data-testid="drydock-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45 }}
      className="absolute inset-0 overflow-hidden bg-bg text-fg"
    >
      <EmbossFilters />
      <LandingHero />

      <div
        className="relative mx-auto flex h-full w-full max-w-2xl flex-col gap-7 overflow-y-auto px-6 pb-10"
        style={{ paddingTop: "max(env(safe-area-inset-top), 1.75rem)" }}
      >
        <header className="flex items-center justify-between gap-4">
          <div>
            <p
              className="bs-label text-[0.62rem] text-fg-muted"
              style={{ filter: "url(#bs-soft-glow)" }}
            >
              Surface workshop
            </p>
            <h2
              className="bs-display m-0 mt-1 text-4xl font-medium text-glow"
              style={{
                letterSpacing: "0.10em",
                filter: "url(#bs-emboss-glow)",
                textShadow:
                  "0 0 18px rgba(107,230,193,0.5), 0 0 36px rgba(107,230,193,0.22)",
              }}
            >
              Drydock
            </h2>
          </div>
          <CurrencyTally currency={currency} />
        </header>

        <LifetimeBand />

        <div className="flex flex-col gap-5">
          {UPGRADE_ROWS.map((row) => (
            <UpgradeRow
              key={row.id}
              def={row}
              level={upgrades[row.id]}
              currency={currency}
              onBuy={() => onBuy(row.id)}
            />
          ))}
        </div>

        <AchievementsPanel />

        <DiveAnalyticsPanel />

        <DiveHistoryPanel onReplay={onReplayDive} />

        <div className="mt-4 flex justify-center">
          <Button variant="ghost" onClick={onBack} data-testid="drydock-back-button">
            Return to surface
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

interface UpgradeRowProps {
  def: UpgradeRowDef;
  level: number;
  currency: number;
  onBuy: () => void;
}

/**
 * Header currency readout. When `currency` changes:
 * - Increase → a floating "+N" mint chip rises and fades
 * - Decrease → a floating "−N" warn chip falls and fades
 * The base value pulses scale 1.18× → 1× regardless of direction
 * so the change is always legible.
 */
function CurrencyTally({ currency }: { currency: number }) {
  const lastValueRef = useRef(currency);
  const [delta, setDelta] = useState<{ amount: number; key: number } | null>(null);
  useEffect(() => {
    const diff = currency - lastValueRef.current;
    if (diff !== 0) {
      setDelta({ amount: diff, key: Date.now() });
      const timeout = window.setTimeout(() => setDelta(null), 900);
      lastValueRef.current = currency;
      return () => window.clearTimeout(timeout);
    }
    lastValueRef.current = currency;
  }, [currency]);

  return (
    <div
      className="bs-numeral text-glow relative"
      style={{
        fontSize: "1.25rem",
        filter: "url(#bs-soft-glow)",
        textShadow: "0 0 14px rgba(107,230,193,0.45)",
      }}
    >
      <motion.span
        key={currency}
        initial={{ scale: 1.18 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        style={{ display: "inline-block" }}
      >
        {currency}
      </motion.span>{" "}
      <span
        className="bs-label text-[0.62rem] text-fg-muted"
        style={{ marginLeft: "0.25rem" }}
      >
        Lux
      </span>
      <AnimatePresence>
        {delta && (
          <motion.span
            key={delta.key}
            aria-hidden="true"
            initial={{ opacity: 0, y: 0, scale: 0.92 }}
            animate={{ opacity: 1, y: delta.amount > 0 ? -22 : 22, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.85, ease: "easeOut" }}
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              fontSize: "0.85rem",
              color: delta.amount > 0 ? "var(--color-glow)" : "var(--color-warn)",
              textShadow:
                delta.amount > 0
                  ? "0 0 10px rgba(107,230,193,0.55)"
                  : "0 0 10px rgba(255,107,107,0.55)",
              pointerEvents: "none",
            }}
          >
            {delta.amount > 0 ? `+${delta.amount}` : delta.amount}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Compact lifetime-stats band beneath the Drydock header. Reads from
 * personalBests on mount and stays stable for the life of the panel
 * (the band re-mounts on next Drydock visit, so a dive completed in
 * between will show the latest values without ad-hoc refresh logic).
 *
 * Values are subdued — readouts, not headline tiles. The drydock's
 * narrative focus is *spending* the Lux on upgrades; the band exists
 * so a returning player can see "what I've done so far" without
 * navigating away.
 */
function LifetimeBand() {
  const bests = getPersonalBests();
  if (bests.divesLogged === 0) return null;

  const cells: { label: string; value: string }[] = [
    { label: "Dives", value: String(bests.divesLogged) },
    { label: "Lifetime Lux", value: String(bests.lifetimeScore) },
    { label: "Best score", value: String(bests.score) },
    { label: "Deepest", value: `${bests.depthMeters}m` },
  ];
  if (bests.maxChain >= 3) {
    cells.push({ label: "Peak chain", value: `×${bests.maxChain}` });
  }
  if (bests.predatorsKilled > 0) {
    cells.push({
      label: "Predators broken",
      value: String(bests.predatorsKilled),
    });
  }

  return (
    <div
      data-testid="drydock-lifetime-band"
      className="flex flex-wrap gap-x-6 gap-y-2 border-y py-3"
      style={{
        borderColor: "color-mix(in srgb, var(--color-glow) 8%, transparent)",
      }}
    >
      {cells.map((c) => (
        <div key={c.label} className="flex flex-col">
          <span
            className="bs-label text-[0.55rem] text-fg-muted"
            style={{ filter: "url(#bs-soft-glow)" }}
          >
            {c.label}
          </span>
          <span
            className="bs-numeral text-base text-fg"
            style={{
              fontFamily: "var(--font-body)",
              textShadow: "0 0 10px rgba(2,6,17,0.85)",
            }}
          >
            {c.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Achievements browser. Reads the catalog + the player's persisted
 * unlock set on mount; lists each achievement with locked/unlocked
 * styling. Locked entries are dimmed but still readable so players
 * can use the panel as a goal list, not just a trophy case.
 *
 * The header summarizes "Unlocked X / Y" so progression is glanceable
 * without scanning the list. Hidden when zero achievements exist
 * (defensive — currently the catalog is non-empty).
 */
function AchievementsPanel() {
  const progress = getAchievementProgress();
  if (progress.total === 0) return null;
  const list = listAchievementsWithUnlockState();
  return (
    <section data-testid="drydock-achievements" className="flex flex-col gap-3">
      <header className="flex items-baseline justify-between">
        <h3
          className="bs-display m-0 text-xl font-medium text-fg"
          style={{
            letterSpacing: "0.08em",
            filter: "url(#bs-soft-glow)",
            textShadow: "0 0 14px rgba(107,230,193,0.32)",
          }}
        >
          Achievements
        </h3>
        <span
          className="bs-numeral text-sm text-fg-muted"
          style={{ filter: "url(#bs-soft-glow)" }}
        >
          {progress.unlocked} / {progress.total}
        </span>
      </header>
      <ul className="flex flex-col gap-1">
        {list.map(({ def, unlocked }) => (
          <li
            key={def.id}
            data-testid={`achievement-row-${def.id}`}
            data-unlocked={unlocked}
            className="flex items-baseline gap-3 py-1"
            style={{
              opacity: unlocked ? 1 : 0.45,
            }}
          >
            <span
              aria-hidden="true"
              className="select-none text-base"
              style={{
                color: unlocked ? "#fef9c3" : "var(--color-fg-muted)",
                filter: unlocked ? "url(#bs-warm-glow)" : undefined,
                width: "1.2rem",
              }}
            >
              {unlocked ? "★" : "☆"}
            </span>
            <div className="flex flex-col">
              <span
                className="text-sm font-medium"
                style={{
                  fontFamily: "var(--font-body)",
                  color: unlocked ? "var(--color-fg)" : "var(--color-fg-muted)",
                }}
              >
                {def.title}
              </span>
              <span
                className="text-xs italic text-fg-muted"
                style={{ fontFamily: "var(--font-body)" }}
              >
                {def.description}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Recent-dive log on the Drydock. Shows the latest 10 dives with
 * mode, score, depth, and any achievement/best badges. Hidden on a
 * fresh install (no entries yet).
 *
 * The list is intentionally compact — players use it to spot
 * patterns ("I keep dying in the midnight zone") not to study
 * each row in detail. Tap-to-replay-seed is reserved for a future
 * iteration.
 */
/**
 * Aggregate stats + sparkline trend for the player's recent dives.
 * Pulls from getDiveHistory() so it always reflects the latest run.
 *
 * The sparkline is a small inline SVG — no chart library, so the
 * bundle stays slim. Points are projected via projectTrendPoint
 * which handles the all-equal-scores edge case.
 *
 * Hidden when fewer than 2 dives exist (a single-point trend isn't
 * meaningful, and the LifetimeBand already covers the "first dive"
 * read).
 */
function DiveAnalyticsPanel() {
  const entries = getDiveHistory();
  if (entries.length < 2) return null;

  const stats = computeAggregateStats(entries);
  const trend = computeScoreTrendSeries(entries);

  const chartW = 180;
  const chartH = 36;
  const projected = trend.points.map((p) =>
    projectTrendPoint(p, trend, chartW, chartH),
  );
  const pathD = projected
    .map((pt, i) => `${i === 0 ? "M" : "L"}${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
    .join(" ");

  return (
    <section data-testid="drydock-analytics" className="flex flex-col gap-3">
      <header className="flex items-baseline justify-between">
        <h3
          className="bs-display m-0 text-xl font-medium text-fg"
          style={{
            letterSpacing: "0.08em",
            filter: "url(#bs-soft-glow)",
            textShadow: "0 0 14px rgba(107,230,193,0.32)",
          }}
        >
          Trend
        </h3>
        <span
          className="bs-numeral text-sm text-fg-muted"
          style={{ filter: "url(#bs-soft-glow)" }}
        >
          {stats.divesCounted} dives
        </span>
      </header>

      <div
        className="flex flex-wrap items-center gap-x-6 gap-y-3"
        data-testid="drydock-analytics-cells"
      >
        <AnalyticsCell label="Mean score" value={String(stats.meanScore)} />
        <AnalyticsCell
          label="Best · worst"
          value={`${stats.bestScore} · ${stats.worstScore}`}
        />
        <AnalyticsCell
          label="Completion"
          value={`${Math.round(stats.completionRate * 100)}%`}
        />
        <AnalyticsCell
          label="Avg duration"
          value={formatElapsed(stats.meanElapsedSeconds)}
        />
        <svg
          role="img"
          aria-label="Score trend over recent dives"
          viewBox={`0 0 ${chartW} ${chartH}`}
          width={chartW}
          height={chartH}
          data-testid="drydock-analytics-sparkline"
          style={{ display: "block" }}
        >
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke="var(--color-glow)"
              strokeWidth={1.4}
              opacity={0.85}
              style={{ filter: "url(#bs-soft-glow)" }}
            />
          )}
          {projected.map((pt, i) => (
            <circle
              key={i}
              cx={pt.x}
              cy={pt.y}
              r={trend.points[i].completed ? 1.8 : 1.2}
              fill={
                trend.points[i].completed
                  ? "var(--color-glow)"
                  : "var(--color-fg-muted)"
              }
              opacity={0.9}
            />
          ))}
        </svg>
      </div>
    </section>
  );
}

function AnalyticsCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span
        className="bs-label text-[0.55rem] text-fg-muted"
        style={{ filter: "url(#bs-soft-glow)" }}
      >
        {label}
      </span>
      <span
        className="bs-numeral text-sm text-fg"
        style={{
          fontFamily: "var(--font-body)",
          textShadow: "0 0 10px rgba(2,6,17,0.85)",
        }}
      >
        {value}
      </span>
    </div>
  );
}

interface DiveHistoryPanelProps {
  onReplay?: (seed: number, mode: SessionMode) => void;
}

function DiveHistoryPanel({ onReplay }: DiveHistoryPanelProps) {
  const entries = getDiveHistory().slice(0, 10);
  if (entries.length === 0) return null;
  const now = Date.now();

  return (
    <section data-testid="drydock-history" className="flex flex-col gap-3">
      <header className="flex items-baseline justify-between">
        <h3
          className="bs-display m-0 text-xl font-medium text-fg"
          style={{
            letterSpacing: "0.08em",
            filter: "url(#bs-soft-glow)",
            textShadow: "0 0 14px rgba(107,230,193,0.32)",
          }}
        >
          Recent Dives
        </h3>
        <span
          className="bs-numeral text-sm text-fg-muted"
          style={{ filter: "url(#bs-soft-glow)" }}
        >
          {onReplay ? "tap to replay · " : ""}last {entries.length}
        </span>
      </header>
      <ul className="flex flex-col gap-1">
        {entries.map((entry, idx) => (
          <DiveHistoryRow
            key={`${entry.recordedAt}-${idx}`}
            entry={entry}
            idx={idx}
            now={now}
            onReplay={onReplay}
          />
        ))}
      </ul>
    </section>
  );
}

interface DiveHistoryRowProps {
  entry: ReturnType<typeof getDiveHistory>[number];
  idx: number;
  now: number;
  onReplay?: (seed: number, mode: SessionMode) => void;
}

/**
 * Single Drydock history row. Renders as a `<button>` when `onReplay`
 * is wired so the row carries the replay affordance directly — tap
 * the row → start a new dive on the same seed + mode. Falls back to
 * a static `<li>` when no replay handler is provided (preserves the
 * test-only render path that just exercises the panel layout).
 */
function DiveHistoryRow({ entry, idx, now, onReplay }: DiveHistoryRowProps) {
  const tone = entry.completed ? "#6be6c1" : "var(--color-fg-muted)";
  const codename = codenameFromSeed(entry.seed);

  const meta = (
    <>
      <span
        aria-hidden="true"
        className="select-none text-base"
        style={{ color: tone, width: "1.2rem" }}
      >
        {entry.completed ? "◆" : "◇"}
      </span>
      <div className="flex flex-1 flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <span
          className="text-sm font-medium"
          style={{
            fontFamily: "var(--font-body)",
            color: tone,
          }}
        >
          {entry.score}
        </span>
        <span
          className="text-xs text-fg-muted"
          style={{ fontFamily: "var(--font-body)" }}
        >
          {entry.depthMeters}m · {formatElapsed(entry.elapsedSeconds)}
        </span>
        <span
          className="bs-label text-[0.55rem] tracking-[0.16em] text-fg-muted"
        >
          {entry.mode.toUpperCase()}
        </span>
        <span
          data-testid={`history-codename-${idx}`}
          className="bs-display text-[0.7rem] italic text-glow/80"
          style={{
            fontFamily: "var(--font-display)",
            letterSpacing: "0.04em",
          }}
        >
          {codename}
        </span>
        {entry.bestsSet.length > 0 && (
          <span
            aria-label="new best"
            className="bs-label text-[0.55rem] font-semibold tracking-[0.16em]"
            style={{
              color: "#fef9c3",
              filter: "url(#bs-warm-glow)",
            }}
          >
            NEW BEST
          </span>
        )}
        {entry.achievementsUnlocked.length > 0 && (
          <span
            aria-label="achievements unlocked"
            className="text-[0.7rem]"
            style={{ color: "#fef9c3", filter: "url(#bs-warm-glow)" }}
          >
            {"★".repeat(Math.min(entry.achievementsUnlocked.length, 3))}
            {entry.achievementsUnlocked.length > 3
              ? `+${entry.achievementsUnlocked.length - 3}`
              : ""}
          </span>
        )}
      </div>
      <span
        className="text-[0.65rem] text-fg-muted"
        style={{ fontFamily: "var(--font-body)" }}
      >
        {formatRelativeTime(entry.recordedAt, now)}
      </span>
    </>
  );

  if (!onReplay) {
    return (
      <li
        data-testid={`history-row-${idx}`}
        data-completed={entry.completed}
        className="flex items-baseline gap-3 py-1"
      >
        {meta}
      </li>
    );
  }

  return (
    <li
      data-testid={`history-row-${idx}`}
      data-completed={entry.completed}
      className="flex"
    >
      <button
        type="button"
        data-testid={`history-replay-${idx}`}
        onClick={() => onReplay(entry.seed, entry.mode as SessionMode)}
        aria-label={`Replay ${codename} (${entry.mode})`}
        className="group flex w-full items-baseline gap-3 rounded-sm py-1.5 px-2 -mx-2 text-left transition-colors duration-150 hover:bg-glow/5 focus-visible:bg-glow/10 focus-visible:outline-none"
      >
        {meta}
        <RotateCcw
          aria-hidden="true"
          className="h-3.5 w-3.5 shrink-0 self-center text-fg-muted transition-colors duration-150 group-hover:text-glow group-focus-visible:text-glow"
        />
      </button>
    </li>
  );
}

function UpgradeRow({ def, level, currency, onBuy }: UpgradeRowProps) {
  const isMax = level >= MAX_UPGRADE_LEVEL;
  const cost = getUpgradeCost(level);
  const canAfford = !isMax && currency >= cost;
  const Icon = def.icon;

  // Local flash state — set true on level change, cleared after a
  // short timeout. Drives a brief mint wash + level chip pulse so
  // the purchase feels like a moment.
  const [flashing, setFlashing] = useState(false);
  const lastLevelRef = useRef(level);
  useEffect(() => {
    if (level > lastLevelRef.current) {
      setFlashing(true);
      const timeout = window.setTimeout(() => setFlashing(false), 700);
      lastLevelRef.current = level;
      return () => window.clearTimeout(timeout);
    }
    lastLevelRef.current = level;
  }, [level]);

  return (
    <div
      className="relative flex flex-col items-start gap-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      data-testid={`upgrade-row-${def.id}`}
      style={{
        // Single hairline beneath each row — chart entry, not card.
        borderBottom: "1px solid color-mix(in srgb, var(--color-glow) 12%, transparent)",
      }}
    >
      <AnimatePresence>
        {flashing && (
          <motion.div
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-none absolute inset-x-0 inset-y-0 -mx-2"
            style={{
              background:
                "radial-gradient(80% 100% at 30% 50%, rgba(107,230,193,0.18) 0%, transparent 75%)",
            }}
          />
        )}
      </AnimatePresence>
      <div className="flex items-start gap-3">
        <div
          className="flex size-10 shrink-0 items-center justify-center text-glow"
          style={{ filter: "url(#bs-soft-glow)" }}
        >
          <Icon className="size-5" />
        </div>
        <div>
          <h3
            className="m-0 font-medium text-fg"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "1rem",
              letterSpacing: "0.02em",
            }}
          >
            {def.label}
            <motion.span
              data-testid={`upgrade-level-${def.id}`}
              className="bs-label ml-3 text-[0.6rem]"
              style={{ filter: "url(#bs-soft-glow)" }}
              key={level}
              initial={{ scale: 1.4, color: "var(--color-glow)" }}
              animate={{ scale: 1, color: "var(--color-fg-muted)" }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              Lvl {level} / {MAX_UPGRADE_LEVEL}
            </motion.span>
          </h3>
          <p
            className="m-0 mt-1 text-sm italic leading-relaxed text-fg-muted"
            style={{ fontFamily: "var(--font-body)", fontWeight: 300 }}
          >
            {def.description}
          </p>
        </div>
      </div>
      <div className="flex w-full shrink-0 items-center justify-between gap-3 sm:w-auto sm:justify-end">
        <span
          className={`bs-numeral text-sm ${
            isMax ? "text-fg-muted" : canAfford ? "text-glow" : "text-warn"
          }`}
          style={{
            filter: canAfford
              ? "url(#bs-soft-glow)"
              : isMax
                ? undefined
                : "url(#bs-warm-glow)",
          }}
        >
          {isMax ? "Max" : `${cost} Lux`}
        </span>
        <Button
          variant={canAfford ? "primary" : "outline"}
          size="sm"
          disabled={!canAfford}
          onClick={onBuy}
          data-testid={`upgrade-${def.id}`}
        >
          Upgrade
        </Button>
      </div>
    </div>
  );
}
