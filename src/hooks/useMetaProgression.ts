import { useState, useEffect } from "react";
import { DEFAULT_UPGRADES, type SubUpgrades, getUpgradeCost, MAX_UPGRADE_LEVEL } from "@/sim/meta/upgrades";

const STORAGE_KEY_CURRENCY = "bs_currency";
const STORAGE_KEY_UPGRADES = "bs_upgrades";

export function useMetaProgression() {
  const [currency, setCurrency] = useState<number>(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY_CURRENCY);
      return stored ? parseInt(stored, 10) : 0;
    } catch {
      return 0;
    }
  });

  const [upgrades, setUpgrades] = useState<SubUpgrades>(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY_UPGRADES);
      return stored ? JSON.parse(stored) : DEFAULT_UPGRADES;
    } catch {
      return DEFAULT_UPGRADES;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY_CURRENCY, currency.toString());
    } catch (e) {
      console.warn("Failed to save currency", e);
    }
  }, [currency]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY_UPGRADES, JSON.stringify(upgrades));
    } catch (e) {
      console.warn("Failed to save upgrades", e);
    }
  }, [upgrades]);

  const addCurrency = (amount: number) => {
    setCurrency((prev) => prev + amount);
  };

  const buyUpgrade = (type: keyof SubUpgrades) => {
    const currentLevel = upgrades[type];
    if (currentLevel >= MAX_UPGRADE_LEVEL) return false;
    
    const cost = getUpgradeCost(currentLevel);
    if (currency >= cost) {
      setCurrency((prev) => prev - cost);
      setUpgrades((prev) => ({
        ...prev,
        [type]: prev[type] + 1,
      }));
      return true;
    }
    return false;
  };

  return {
    currency,
    upgrades,
    addCurrency,
    buyUpgrade,
  };
}
