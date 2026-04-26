// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => {
  return {
    haptics: {
      impact: vi.fn(async () => undefined),
      notification: vi.fn(async () => undefined),
      vibrate: vi.fn(async () => undefined),
    },
    nativeFlag: { isNative: true },
  };
});

vi.mock("@capacitor/haptics", () => ({
  Haptics: mocks.haptics,
  ImpactStyle: { Light: "LIGHT", Medium: "MEDIUM", Heavy: "HEAVY" },
  NotificationType: {
    Success: "SUCCESS",
    Warning: "WARNING",
    Error: "ERROR",
  },
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => mocks.nativeFlag.isNative,
  },
}));

const haptics = mocks.haptics;

import {
  hapticAdrenaline,
  hapticCollect,
  hapticGameOver,
  hapticImpact,
  hapticOxygenTick,
  hapticPickup,
  hapticPredatorKill,
  isHapticsMuted,
  onHapticsMuteChange,
  setHapticsMuted,
  toggleHapticsMuted,
} from "./haptics";

const flushMicrotasks = async () => {
  // Two ticks: one to drain queued microtasks (the Promise.resolve in
  // scheduleDrain), one for the awaited Haptics call inside drain.
  await Promise.resolve();
  await Promise.resolve();
};

beforeEach(() => {
  haptics.impact.mockClear();
  haptics.notification.mockClear();
  haptics.vibrate.mockClear();
  setHapticsMuted(false);
  localStorage.clear();
  mocks.nativeFlag.isNative = true;
});

afterEach(() => {
  setHapticsMuted(false);
});

describe("haptics — native dispatch", () => {
  test("collect → light impact", async () => {
    hapticCollect();
    await flushMicrotasks();
    expect(haptics.impact).toHaveBeenCalledWith({ style: "LIGHT" });
  });

  test("pickup → medium impact", async () => {
    hapticPickup();
    await flushMicrotasks();
    expect(haptics.impact).toHaveBeenCalledWith({ style: "MEDIUM" });
  });

  test("impact → heavy impact", async () => {
    hapticImpact();
    await flushMicrotasks();
    expect(haptics.impact).toHaveBeenCalledWith({ style: "HEAVY" });
  });

  test("predator-kill → medium impact", async () => {
    hapticPredatorKill();
    await flushMicrotasks();
    expect(haptics.impact).toHaveBeenCalledWith({ style: "MEDIUM" });
  });

  test("oxygen-tick → light impact", async () => {
    hapticOxygenTick();
    await flushMicrotasks();
    expect(haptics.impact).toHaveBeenCalledWith({ style: "LIGHT" });
  });

  test("adrenaline → success notification", async () => {
    hapticAdrenaline();
    await flushMicrotasks();
    expect(haptics.notification).toHaveBeenCalledWith({ type: "SUCCESS" });
  });

  test("game-over → error notification", async () => {
    hapticGameOver();
    await flushMicrotasks();
    expect(haptics.notification).toHaveBeenCalledWith({ type: "ERROR" });
  });
});

describe("haptics — coalescing", () => {
  test("multiple impact requests in same frame coalesce to highest intensity", async () => {
    hapticCollect();
    hapticImpact();
    hapticPickup();
    await flushMicrotasks();
    // Impact (heavy) outranks pickup (medium) outranks collect (light)
    expect(haptics.impact).toHaveBeenCalledTimes(1);
    expect(haptics.impact).toHaveBeenCalledWith({ style: "HEAVY" });
  });

  test("impact and notification fire independently", async () => {
    hapticImpact();
    hapticAdrenaline();
    await flushMicrotasks();
    expect(haptics.impact).toHaveBeenCalledWith({ style: "HEAVY" });
    expect(haptics.notification).toHaveBeenCalledWith({ type: "SUCCESS" });
  });
});

describe("haptics — mute", () => {
  test("muted suppresses native dispatch", async () => {
    setHapticsMuted(true);
    hapticImpact();
    await flushMicrotasks();
    expect(haptics.impact).not.toHaveBeenCalled();
  });

  test("toggle returns the new state", () => {
    expect(toggleHapticsMuted()).toBe(true);
    expect(isHapticsMuted()).toBe(true);
    expect(toggleHapticsMuted()).toBe(false);
    expect(isHapticsMuted()).toBe(false);
  });

  test("mute persists in localStorage", () => {
    setHapticsMuted(true);
    expect(localStorage.getItem("bs.haptics.muted")).toBe("1");
    setHapticsMuted(false);
    expect(localStorage.getItem("bs.haptics.muted")).toBe(null);
  });

  test("listeners fire on change", () => {
    const listener = vi.fn();
    const unsubscribe = onHapticsMuteChange(listener);
    setHapticsMuted(true);
    expect(listener).toHaveBeenCalledWith(true);
    setHapticsMuted(false);
    expect(listener).toHaveBeenCalledWith(false);
    unsubscribe();
    setHapticsMuted(true);
    // Listener was called only twice; unsubscribe stopped it.
    expect(listener).toHaveBeenCalledTimes(2);
  });

  test("setting same value is a no-op (no listener fire)", () => {
    const listener = vi.fn();
    onHapticsMuteChange(listener);
    setHapticsMuted(false); // already false
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("haptics — web fallback", () => {
  beforeEach(() => {
    mocks.nativeFlag.isNative = false;
  });

  test("light impact → 7ms vibration", async () => {
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, "vibrate", {
      configurable: true,
      writable: true,
      value: vibrate,
    });
    hapticCollect();
    await flushMicrotasks();
    expect(vibrate).toHaveBeenCalledWith(7);
  });

  test("heavy impact → 28ms vibration", async () => {
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, "vibrate", {
      configurable: true,
      writable: true,
      value: vibrate,
    });
    hapticImpact();
    await flushMicrotasks();
    expect(vibrate).toHaveBeenCalledWith(28);
  });

  test("game-over → error pattern", async () => {
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, "vibrate", {
      configurable: true,
      writable: true,
      value: vibrate,
    });
    hapticGameOver();
    await flushMicrotasks();
    expect(vibrate).toHaveBeenCalledWith([24, 18, 24]);
  });

  test("muted suppresses web vibrate", async () => {
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, "vibrate", {
      configurable: true,
      writable: true,
      value: vibrate,
    });
    setHapticsMuted(true);
    hapticImpact();
    await flushMicrotasks();
    expect(vibrate).not.toHaveBeenCalled();
  });
});
