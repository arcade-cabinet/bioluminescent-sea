import { useEffect, useRef } from "react";

/**
 * Landing backdrop — abyssal water, full submerged, no horizon.
 *
 * Identity rule: this canvas IS the trench. Not a surface scene with
 * waves, not a generic-game-startup gradient. Players landing here
 * should feel they're already underwater, the sub somewhere far above
 * them and the deep ahead.
 *
 * Layers, back to front:
 *   1. Vertical depth gradient — abyss-navy at the bottom, slightly
 *      lifted near the top (light still penetrates a little).
 *   2. Slow leviathan shadow — a huge silhouette gliding very slowly
 *      across the deep band. Periodic; mostly hidden, occasionally
 *      revealed by caustics.
 *   3. God-ray curtains pouring straight down from the unseen surface.
 *      Wider, slower, more diffuse than the gameplay rays.
 *   4. Procedural caustic shimmer — sparse bright peaks drifting on a
 *      curl-noise field.
 *   5. Kelp silhouettes — dark fronds at the left and right edges,
 *      swaying on a sinusoid. Reads as "edge of the reef."
 *   6. Marine snow — slow downward drift with horizontal sway.
 *   7. Vignette — pulls focus to the center where the title lives.
 *
 * No submersible — the player IS the sub; they shouldn't see another
 * one floating in the chrome.
 */
const PALETTE = {
  surface: "#072033", // very top, the only light
  midwater: "#0a1a2e",
  deepwater: "#050a14",
  abyss: "#020611",
  kelp: "#031218",
  glowMint: "#6be6c1",
  snowMint: "#9fc8c0",
};

interface SnowParticle {
  baseX: number;
  baseY: number;
  yOffset: number;
  speed: number;
  swayAmp: number;
  swayPhase: number;
  size: number;
  alpha: number;
}

interface KelpFrond {
  rootX: number;
  height: number;
  width: number;
  swayPhase: number;
  swaySpeed: number;
  swayAmp: number;
  segments: number;
}

export function LandingHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const reducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let snow: SnowParticle[] = [];
    let kelpLeft: KelpFrond[] = [];
    let kelpRight: KelpFrond[] = [];

    function resize() {
      if (!canvas || !ctx) return;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Re-seed particles + kelp to viewport — keeps them deterministic
      // per-resize so a new tab opens to the same arrangement, but a
      // resize re-fills the new dimensions.
      snow = seedSnow(rect.width, rect.height);
      kelpLeft = seedKelp(rect.width, rect.height, "left");
      kelpRight = seedKelp(rect.width, rect.height, "right");
    }
    resize();

    let t0 = performance.now();

    function frame(now: number) {
      if (!canvas || !ctx) return;
      const dt = (now - t0) / 1000;
      t0 = now;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      if (!Number.isFinite(w) || !Number.isFinite(h) || w < 1 || h < 1) {
        rafRef.current = requestAnimationFrame(frame);
        return;
      }

      // ---- 1. Depth gradient ------------------------------------------------
      const depth = ctx.createLinearGradient(0, 0, 0, h);
      depth.addColorStop(0, PALETTE.surface);
      depth.addColorStop(0.35, PALETTE.midwater);
      depth.addColorStop(0.75, PALETTE.deepwater);
      depth.addColorStop(1, PALETTE.abyss);
      ctx.fillStyle = depth;
      ctx.fillRect(0, 0, w, h);

      // ---- 2. Leviathan shadow ---------------------------------------------
      // Phase 0..1, takes ~45s to traverse. The silhouette is a big
      // soft ellipse with a tail; alpha pulses so it sometimes
      // disappears entirely — the abyss IS alive, but you don't always
      // see what's down there.
      const leviPhase = ((now * 0.0001) % 1 + 1) % 1;
      const leviX = -w * 0.4 + leviPhase * (w * 1.8);
      const leviY = h * 0.78 + Math.sin(now * 0.0002) * h * 0.04;
      // Reveal alpha ramps up in the middle of the pass and fades at edges.
      const reveal = Math.sin(leviPhase * Math.PI);
      const leviAlpha = 0.18 * reveal * reveal;
      if (leviAlpha > 0.01) {
        const lw = w * 0.45;
        const lh = h * 0.18;
        const grad = ctx.createRadialGradient(leviX, leviY, 0, leviX, leviY, Math.max(lw, lh));
        grad.addColorStop(0, `rgba(2, 6, 17, ${leviAlpha * 1.2})`);
        grad.addColorStop(0.6, `rgba(2, 6, 17, ${leviAlpha * 0.4})`);
        grad.addColorStop(1, "rgba(2, 6, 17, 0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(leviX, leviY, lw, lh, 0, 0, Math.PI * 2);
        ctx.fill();
        // Tail tendril — a softer ellipse stretched behind the head.
        const tailX = leviX - lw * 0.85 * Math.sign(0.5 - leviPhase + 0.001);
        const tg = ctx.createRadialGradient(tailX, leviY, 0, tailX, leviY, lw * 0.5);
        tg.addColorStop(0, `rgba(2, 6, 17, ${leviAlpha * 0.7})`);
        tg.addColorStop(1, "rgba(2, 6, 17, 0)");
        ctx.fillStyle = tg;
        ctx.beginPath();
        ctx.ellipse(tailX, leviY, lw * 0.5, lh * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // ---- 3. God-ray curtains ---------------------------------------------
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const beamCount = 4;
      for (let i = 0; i < beamCount; i++) {
        const phase = (i + 0.5) / beamCount;
        const sway = Math.sin(now * 0.0003 + i * 1.7) * w * 0.08;
        const x = phase * w + sway;
        const angle = Math.sin(now * 0.0002 + i) * 0.08; // Slight tilt
        const halfWidthTop = w * 0.06;
        const halfWidthBottom = w * 0.14;
        const grad = ctx.createLinearGradient(x, 0, x, h * 0.72);
        grad.addColorStop(0, "rgba(155, 220, 200, 0.10)");
        grad.addColorStop(0.4, "rgba(107, 230, 193, 0.04)");
        grad.addColorStop(1, "rgba(107, 230, 193, 0)");
        ctx.beginPath();
        ctx.moveTo(x - halfWidthTop, 0);
        ctx.lineTo(x + halfWidthTop, 0);
        ctx.lineTo(x + halfWidthBottom + Math.sin(angle) * h * 0.72, h * 0.72);
        ctx.lineTo(x - halfWidthBottom + Math.sin(angle) * h * 0.72, h * 0.72);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
      }
      ctx.restore();

      // ---- 4. Caustic shimmer ----------------------------------------------
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const causticCount = 30;
      for (let i = 0; i < causticCount; i++) {
        // Each caustic point drifts on its own slow loop in x and y.
        const baseX = (i * 137) % w;
        const baseY = ((i * 73) % (h * 0.55)) + h * 0.05;
        const drift =
          Math.sin(now * 0.0006 + i * 0.4) +
          Math.cos(now * 0.0009 + i * 0.7);
        if (drift <= 0.4) continue;
        const intensity = (drift - 0.4) / 1.6;
        const r = 6 + intensity * 14;
        const cx = baseX + Math.cos(now * 0.0004 + i) * 12;
        const cy = baseY + Math.sin(now * 0.0005 + i) * 8;
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grad.addColorStop(0, `rgba(107, 230, 193, ${0.22 * intensity})`);
        grad.addColorStop(1, "rgba(107, 230, 193, 0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // ---- 5. Kelp fronds at the edges -------------------------------------
      drawKelpStand(ctx, kelpLeft, h, now, "left");
      drawKelpStand(ctx, kelpRight, h, now, "right");

      // ---- 6. Marine snow --------------------------------------------------
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const p of snow) {
        if (!reducedMotion) {
          p.yOffset += p.speed * dt * 14;
        }
        const sway = Math.sin(now * 0.0008 + p.swayPhase) * p.swayAmp;
        const x = p.baseX + sway;
        let y = p.baseY + p.yOffset;
        // Wrap vertically once a particle drifts past the bottom.
        if (y > h + 10) {
          p.yOffset = -h - 10 + (p.yOffset - h);
          y = p.baseY + p.yOffset;
        }
        ctx.fillStyle = `rgba(159, 200, 192, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // ---- 7. Vignette -----------------------------------------------------
      const vig = ctx.createRadialGradient(
        w * 0.5,
        h * 0.5,
        Math.min(w, h) * 0.25,
        w * 0.5,
        h * 0.55,
        Math.max(w, h) * 0.85,
      );
      vig.addColorStop(0, "rgba(5, 10, 20, 0)");
      vig.addColorStop(1, "rgba(2, 6, 17, 0.85)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, w, h);

      rafRef.current = requestAnimationFrame(frame);
    }

    const onResize = () => {
      resize();
      if (reducedMotion) frame(performance.now());
    };
    window.addEventListener("resize", onResize);

    if (reducedMotion) {
      frame(performance.now());
    } else {
      rafRef.current = requestAnimationFrame(frame);
    }

    return () => {
      window.removeEventListener("resize", onResize);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        display: "block",
        pointerEvents: "none",
      }}
    />
  );
}

function seedSnow(w: number, h: number): SnowParticle[] {
  const count = Math.round(Math.min(220, (w * h) / 7000));
  const out: SnowParticle[] = [];
  for (let i = 0; i < count; i++) {
    const r = pseudoRand(i * 7 + 1);
    out.push({
      baseX: pseudoRand(i * 11) * w,
      baseY: pseudoRand(i * 13) * h,
      yOffset: 0,
      speed: 0.4 + pseudoRand(i * 19) * 0.9,
      swayAmp: 4 + pseudoRand(i * 23) * 14,
      swayPhase: pseudoRand(i * 29) * Math.PI * 2,
      size: 0.8 + r * 1.6,
      alpha: 0.12 + r * 0.18,
    });
  }
  return out;
}

function seedKelp(w: number, h: number, side: "left" | "right"): KelpFrond[] {
  const count = 5;
  const out: KelpFrond[] = [];
  const bandWidth = Math.min(160, w * 0.18);
  for (let i = 0; i < count; i++) {
    const t = pseudoRand(i * 31 + (side === "left" ? 1 : 100));
    const xInBand = (i / count) * bandWidth + t * 18;
    const rootX = side === "left" ? xInBand : w - xInBand;
    out.push({
      rootX,
      height: h * (0.45 + pseudoRand(i * 41) * 0.35),
      width: 5 + pseudoRand(i * 43) * 4,
      swayPhase: pseudoRand(i * 47) * Math.PI * 2,
      swaySpeed: 0.3 + pseudoRand(i * 53) * 0.5,
      swayAmp: 18 + pseudoRand(i * 59) * 22,
      segments: 14,
    });
  }
  return out;
}

function drawKelpStand(
  ctx: CanvasRenderingContext2D,
  fronds: KelpFrond[],
  h: number,
  now: number,
  _side: "left" | "right",
) {
  ctx.save();
  for (const k of fronds) {
    const segH = k.height / k.segments;
    ctx.beginPath();
    ctx.moveTo(k.rootX - k.width * 0.5, h);
    // Walk up the stem in segments, sway each segment by a sinusoid
    // whose phase shifts with height — the tip waves more than the base.
    const points: Array<[number, number]> = [];
    for (let s = 0; s <= k.segments; s++) {
      const segPhase = k.swayPhase + (s / k.segments) * 1.5;
      const sway =
        Math.sin(now * 0.001 * k.swaySpeed + segPhase) * k.swayAmp * (s / k.segments);
      const x = k.rootX + sway;
      const y = h - s * segH;
      points.push([x, y]);
    }
    // Stem outline (right side going up)
    for (let s = 0; s <= k.segments; s++) {
      const [x, y] = points[s];
      const taper = 1 - s / k.segments;
      const halfWidth = k.width * 0.5 * (taper * 0.6 + 0.4);
      if (s === 0) ctx.moveTo(x + halfWidth, y);
      else ctx.lineTo(x + halfWidth, y);
    }
    // Coming back down the left side
    for (let s = k.segments; s >= 0; s--) {
      const [x, y] = points[s];
      const taper = 1 - s / k.segments;
      const halfWidth = k.width * 0.5 * (taper * 0.6 + 0.4);
      ctx.lineTo(x - halfWidth, y);
    }
    ctx.closePath();
    ctx.fillStyle = PALETTE.kelp;
    ctx.fill();
    // Faint mint highlight on the tip — bioluminescent kelp
    const tipY = points[k.segments][1];
    const tipX = points[k.segments][0];
    const grad = ctx.createRadialGradient(tipX, tipY, 0, tipX, tipY, 30);
    grad.addColorStop(0, "rgba(107, 230, 193, 0.18)");
    grad.addColorStop(1, "rgba(107, 230, 193, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(tipX, tipY, 30, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Deterministic [0,1) PRNG seeded by integer i. Used for placing kelp
// + snow so reloads pick the same arrangement and resize reseeds
// without flicker.
function pseudoRand(i: number): number {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}
