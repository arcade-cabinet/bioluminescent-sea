import { motion } from "framer-motion";
import { Anchor, BatteryCharging, Lightbulb, Wrench } from "lucide-react";
import type { ComponentType } from "react";
import { getUpgradeCost, MAX_UPGRADE_LEVEL, type SubUpgrades } from "@/sim/meta/upgrades";
import { Button, Card, CardCorners } from "@/ui/primitives";

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

export function DrydockScreen({ currency, upgrades, onBuy, onBack }: DrydockScreenProps) {
  return (
    <motion.div
      data-testid="drydock-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="absolute inset-0 overflow-y-auto bg-abyss text-fg"
    >
      <div
        className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 pb-10"
        style={{ paddingTop: "max(env(safe-area-inset-top), 1.5rem)" }}
      >
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.18em] text-fg-muted">
              Surface workshop
            </p>
            <h2 className="bs-display m-0 text-4xl font-medium text-glow">Drydock</h2>
          </div>
          <div className="rounded-full border border-glow/40 bg-glow/15 px-4 py-1.5 font-body text-sm font-semibold text-glow tabular-nums">
            {currency} Lux
          </div>
        </header>

        <div className="flex flex-col gap-3">
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

        <div className="mt-2 flex justify-center">
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
    <Card
      className="relative flex flex-col items-start gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"
      data-testid={`upgrade-row-${def.id}`}
    >
      <CardCorners />
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-deep/80 bg-bg/40 text-glow">
          <Icon className="size-5" />
        </div>
        <div>
          <h3 className="m-0 text-base font-semibold text-fg">
            {def.label}
            <span
              data-testid={`upgrade-level-${def.id}`}
              className="ml-2 text-[0.7rem] font-normal uppercase tracking-[0.14em] text-fg-muted"
            >
              Lvl {level} / {MAX_UPGRADE_LEVEL}
            </span>
          </h3>
          <p className="m-0 mt-0.5 text-sm leading-relaxed text-fg-muted">{def.description}</p>
        </div>
      </div>
      <div className="flex w-full shrink-0 items-center justify-between gap-3 sm:w-auto sm:justify-end">
        <span
          className={`text-xs uppercase tracking-[0.12em] tabular-nums ${
            isMax ? "text-fg-muted" : canAfford ? "text-glow" : "text-warn"
          }`}
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
    </Card>
  );
}
