import { AnimatePresence, motion } from "framer-motion";
import { Anchor, BatteryCharging, Lightbulb, Wrench } from "lucide-react";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { getUpgradeCost, MAX_UPGRADE_LEVEL, type SubUpgrades } from "@/sim/meta/upgrades";
import { getPersonalBests } from "@/lib/personalBests";
import { Button, EmbossFilters } from "@/ui/primitives";
import { LandingHero } from "@/ui/shell/LandingHero";

interface DrydockScreenProps {
  currency: number;
  upgrades: SubUpgrades;
  onBuy: (type: keyof SubUpgrades) => void;
  onBack: () => void;
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
export function DrydockScreen({ currency, upgrades, onBuy, onBack }: DrydockScreenProps) {
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
