import { motion } from "framer-motion";
import { Anchor, BatteryCharging, Lightbulb, Wrench } from "lucide-react";
import type { ComponentType } from "react";
import { getUpgradeCost, MAX_UPGRADE_LEVEL, type SubUpgrades } from "@/sim/meta/upgrades";
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
          <div
            className="bs-numeral text-glow"
            style={{
              fontSize: "1.25rem",
              filter: "url(#bs-soft-glow)",
              textShadow: "0 0 14px rgba(107,230,193,0.45)",
            }}
          >
            {currency}{" "}
            <span
              className="bs-label text-[0.62rem] text-fg-muted"
              style={{ marginLeft: "0.25rem" }}
            >
              Lux
            </span>
          </div>
        </header>

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

function UpgradeRow({ def, level, currency, onBuy }: UpgradeRowProps) {
  const isMax = level >= MAX_UPGRADE_LEVEL;
  const cost = getUpgradeCost(level);
  const canAfford = !isMax && currency >= cost;
  const Icon = def.icon;

  return (
    <div
      className="relative flex flex-col items-start gap-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      data-testid={`upgrade-row-${def.id}`}
      style={{
        // Single hairline beneath each row — chart entry, not card.
        borderBottom: "1px solid color-mix(in srgb, var(--color-glow) 12%, transparent)",
      }}
    >
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
            <span
              data-testid={`upgrade-level-${def.id}`}
              className="bs-label ml-3 text-[0.6rem] text-fg-muted"
              style={{ filter: "url(#bs-soft-glow)" }}
            >
              Lvl {level} / {MAX_UPGRADE_LEVEL}
            </span>
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
