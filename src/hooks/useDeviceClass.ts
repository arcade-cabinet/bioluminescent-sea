import { useEffect, useState } from "react";

/**
 * Device classes the UI layouts treat distinctly. Driven entirely by
 * viewport dimensions and a Capacitor-native flag — we never sniff
 * userAgent.
 *
 * - `phone-portrait`: small width, taller than wide. Hamburger HUD,
 *   only oxygen + score visible inline; everything else slides in.
 * - `phone-landscape`: small height, wider than tall (e.g. 844x390).
 *   Hamburger HUD on the side; immersion-first.
 * - `tablet`: ≥600px on the short edge. Full HUD inline; mode triptych
 *   3-column already. Same on portrait or landscape — tablet has the
 *   real estate for it.
 * - `desktop`: ≥1024px wide. Same as tablet but with hover affordances.
 *
 * Foldables unfolded read as `tablet` because their short edge clears
 * 600px once opened.
 */
export type DeviceClass = "phone-portrait" | "phone-landscape" | "tablet" | "desktop";

export interface DeviceClassInfo {
  /** Canonical class — drives layout decisions. */
  klass: DeviceClass;
  /** True when running inside a Capacitor (native) shell. */
  isNative: boolean;
  /** True for any "phone" variant — i.e. compact HUD + hamburger. */
  isCompact: boolean;
  /** True when portrait: height > width. Useful for tablet layouts
   * that need to branch on orientation independent of klass. */
  isPortrait: boolean;
}

function detectIsNative(): boolean {
  if (typeof window === "undefined") return false;
  // Capacitor exposes window.Capacitor.isNativePlatform() on iOS/Android
  // wrappers. We deliberately don't import @capacitor/core here so the
  // web bundle has no dependency on it.
  // biome-ignore lint/suspicious/noExplicitAny: dynamic native check
  const cap = (window as any).Capacitor;
  return Boolean(cap?.isNativePlatform?.() ?? cap?.isNative);
}

function classify(width: number, height: number): DeviceClass {
  // Short-edge breakpoints. Foldables unfolded ~720x870, treated as tablet.
  // Desktop is gated on `width >= 1024` so portrait tablets (e.g.
  // 768×1024) stay classified as "tablet" — `longEdge` would otherwise
  // misroute them into the desktop layout.
  const shortEdge = Math.min(width, height);
  if (shortEdge >= 600) {
    return width >= 1024 ? "desktop" : "tablet";
  }
  // Phone — orientation matters for HUD placement.
  return width > height ? "phone-landscape" : "phone-portrait";
}

export function useDeviceClass(): DeviceClassInfo {
  const [info, setInfo] = useState<DeviceClassInfo>(() => readInfo());
  useEffect(() => {
    const onResize = () => setInfo(readInfo());
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);
  return info;
}

function readInfo(): DeviceClassInfo {
  if (typeof window === "undefined") {
    return { klass: "desktop", isNative: false, isCompact: false, isPortrait: false };
  }
  const klass = classify(window.innerWidth, window.innerHeight);
  const isNative = detectIsNative();
  const isCompact = klass === "phone-portrait" || klass === "phone-landscape";
  const isPortrait = window.innerHeight > window.innerWidth;
  return { klass, isNative, isCompact, isPortrait };
}
