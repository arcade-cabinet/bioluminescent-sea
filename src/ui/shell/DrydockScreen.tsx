import { motion } from "framer-motion";
import type { SubUpgrades } from "@/sim/meta/upgrades";
import { getUpgradeCost, MAX_UPGRADE_LEVEL } from "@/sim/meta/upgrades";
import { OverlayButton } from "./OverlayButton";

interface DrydockScreenProps {
  currency: number;
  upgrades: SubUpgrades;
  onBuy: (type: keyof SubUpgrades) => void;
  onBack: () => void;
}

export function DrydockScreen({ currency, upgrades, onBuy, onBack }: DrydockScreenProps) {
  const renderUpgrade = (type: keyof SubUpgrades, label: string, desc: string) => {
    const level = upgrades[type];
    const isMax = level >= MAX_UPGRADE_LEVEL;
    const cost = getUpgradeCost(level);
    const canAfford = !isMax && currency >= cost;

    return (
      <div style={{
        background: "rgba(10, 26, 46, 0.6)",
        border: "1px solid var(--color-deep)",
        padding: "1rem",
        borderRadius: "0.5rem",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "1rem"
      }}>
        <div style={{ textAlign: "left" }}>
          <h3 style={{ margin: "0 0 0.25rem", color: "var(--color-glow)" }}>{label} (Lvl {level})</h3>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--color-fg-muted)" }}>{desc}</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
          <span style={{ fontSize: "0.85rem", color: isMax ? "var(--color-fg-muted)" : canAfford ? "var(--color-glow)" : "#ff6b6b", marginBottom: "0.5rem" }}>
            {isMax ? "MAX" : `Cost: ${cost} Lux`}
          </span>
          <OverlayButton
            variant={canAfford ? "primary" : "ghost"}
            onClick={() => onBuy(type)}
          >
            Upgrade
          </OverlayButton>
        </div>
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "absolute",
        inset: 0,
        background: "var(--color-abyss)",
        color: "var(--color-fg)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "2rem",
        overflowY: "auto",
      }}
    >
      <div style={{ width: "100%", maxWidth: 600 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
          <h2 className="bs-display" style={{ color: "var(--color-glow)", margin: 0, fontSize: "2.5rem" }}>Drydock</h2>
          <div style={{ background: "rgba(107, 230, 193, 0.15)", padding: "0.5rem 1rem", borderRadius: "1rem", color: "var(--color-glow)", fontWeight: "bold" }}>
            {currency} Lux
          </div>
        </div>

        {renderUpgrade("hull", "Hull Plating", "Reduces oxygen lost during collisions.")}
        {renderUpgrade("battery", "Battery Capacity", "Extends base dive duration.")}
        {renderUpgrade("motor", "Engine Thrusters", "Increases lateral movement speed.")}
        {renderUpgrade("lamp", "Halogen Lamp", "Widens and lengthens the front light cone.")}

        <div style={{ marginTop: "3rem", textAlign: "center" }}>
          <OverlayButton variant="ghost" onClick={onBack}>Return to Surface</OverlayButton>
        </div>
      </div>
    </motion.div>
  );
}
