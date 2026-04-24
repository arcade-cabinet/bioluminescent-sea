import { useEffect, useRef } from "react";

const PALETTE = {
  abyss: "#050a14",
  deep: "#0e4f55",
  glow: "#6be6c1",
  fgMuted: "#8aa7a2",
};

interface Spark {
  x: number;
  y: number;
  radius: number;
  driftX: number;
  driftY: number;
  phase: number;
  hue: number;
}

interface Ribbon {
  anchorX: number;
  amplitude: number;
  period: number;
  depth: number;
  phase: number;
  width: number;
  opacity: number;
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

    function resize() {
      if (!canvas || !ctx) return;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();

    const sparks: Spark[] = Array.from({ length: 42 }).map((_, i) => ({
      x: (i * 97.3) % 100,
      y: ((i * 51.7) % 100) - 10,
      radius: 0.8 + ((i * 13) % 5) * 0.45,
      driftX: ((i % 2) - 0.5) * 0.04,
      driftY: 0.03 + ((i * 7) % 5) * 0.01,
      phase: (i * 0.37) % (Math.PI * 2),
      hue: (i % 7) / 7,
    }));

    const ribbons: Ribbon[] = Array.from({ length: 4 }).map((_, i) => ({
      anchorX: 12 + i * 22 + ((i * 7) % 6),
      amplitude: 1.8 + (i % 2) * 0.9,
      period: 0.012 + i * 0.003,
      depth: 0.2 + i * 0.18,
      phase: i * 0.9,
      width: 1 + i * 0.4,
      opacity: 0.08 + i * 0.04,
    }));

    let t0 = performance.now();

    function frame(now: number) {
      if (!canvas || !ctx) return;
      const dt = (now - t0) / 1000;
      t0 = now;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "#061128");
      bg.addColorStop(0.55, PALETTE.abyss);
      bg.addColorStop(1, "#020611");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      const shaft = ctx.createRadialGradient(
        w * 0.5,
        -h * 0.2,
        0,
        w * 0.5,
        -h * 0.2,
        h * 1.2,
      );
      shaft.addColorStop(0, "rgba(107, 230, 193, 0.12)");
      shaft.addColorStop(0.4, "rgba(14, 79, 85, 0.18)");
      shaft.addColorStop(1, "rgba(5, 10, 20, 0)");
      ctx.fillStyle = shaft;
      ctx.fillRect(0, 0, w, h);

      for (const r of ribbons) {
        r.phase += dt * 0.18 * (0.7 + r.depth);
        const yOffset = ((now * 0.02 * (0.5 + r.depth)) % (h + 80)) - 40;
        ctx.beginPath();
        for (let y = -20; y < h + 20; y += 6) {
          const localY = y + yOffset;
          const wobble = Math.sin(localY * r.period + r.phase) * r.amplitude;
          const x = (r.anchorX / 100) * w + wobble * (w * 0.03);
          if (y === -20) ctx.moveTo(x, localY);
          else ctx.lineTo(x, localY);
        }
        ctx.strokeStyle = `rgba(107, 230, 193, ${r.opacity})`;
        ctx.lineWidth = r.width;
        ctx.shadowColor = PALETTE.glow;
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      for (const s of sparks) {
        s.x += s.driftX * dt * 20;
        s.y += s.driftY * dt * 20;
        s.phase += dt * 1.6;
        if (s.y > 108) s.y = -4;
        if (s.x < -4) s.x = 104;
        if (s.x > 104) s.x = -4;

        const pulse = 0.5 + 0.5 * Math.sin(s.phase);
        const px = (s.x / 100) * w;
        const py = (s.y / 100) * h;
        const rad = s.radius * (1 + pulse * 0.5);

        const grad = ctx.createRadialGradient(px, py, 0, px, py, rad * 6);
        grad.addColorStop(0, `rgba(107, 230, 193, ${0.55 + pulse * 0.35})`);
        grad.addColorStop(0.5, "rgba(107, 230, 193, 0.18)");
        grad.addColorStop(1, "rgba(107, 230, 193, 0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(px, py, rad * 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(217, 242, 236, ${0.7 + pulse * 0.3})`;
        ctx.beginPath();
        ctx.arc(px, py, rad, 0, Math.PI * 2);
        ctx.fill();
      }

      const subX = w * 0.5 + Math.sin(now * 0.0004) * w * 0.04;
      const subY = h * 0.58 + Math.sin(now * 0.0007) * 8;
      drawSubmersible(ctx, subX, subY, Math.min(w, h) * 0.06);

      const vig = ctx.createRadialGradient(
        w * 0.5,
        h * 0.55,
        Math.min(w, h) * 0.2,
        w * 0.5,
        h * 0.55,
        Math.max(w, h) * 0.8,
      );
      vig.addColorStop(0, "rgba(5, 10, 20, 0)");
      vig.addColorStop(1, "rgba(5, 10, 20, 0.88)");
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
      // Paint one static frame — no raf loop, no ongoing animation.
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

function drawSubmersible(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  scale: number,
) {
  const coneLen = scale * 8;
  const coneGrad = ctx.createLinearGradient(cx, cy, cx, cy + coneLen);
  coneGrad.addColorStop(0, "rgba(107, 230, 193, 0.28)");
  coneGrad.addColorStop(0.5, "rgba(107, 230, 193, 0.08)");
  coneGrad.addColorStop(1, "rgba(107, 230, 193, 0)");
  ctx.beginPath();
  ctx.moveTo(cx - scale * 0.4, cy + scale * 0.2);
  ctx.lineTo(cx + scale * 0.4, cy + scale * 0.2);
  ctx.lineTo(cx + scale * 2.2, cy + coneLen);
  ctx.lineTo(cx - scale * 2.2, cy + coneLen);
  ctx.closePath();
  ctx.fillStyle = coneGrad;
  ctx.fill();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = "#0a1a2e";
  ctx.strokeStyle = "rgba(107, 230, 193, 0.35)";
  ctx.lineWidth = 1.1;

  ctx.beginPath();
  ctx.ellipse(0, 0, scale * 1.1, scale * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(scale * 0.15, -scale * 0.15, scale * 0.55, scale * 0.28, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(107, 230, 193, 0.22)";
  ctx.fill();
  ctx.strokeStyle = "rgba(107, 230, 193, 0.5)";
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(scale * 0.3, scale * 0.1, scale * 0.1, 0, Math.PI * 2);
  ctx.fillStyle = "#d9f2ec";
  ctx.shadowColor = PALETTE.glow;
  ctx.shadowBlur = 10;
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.restore();
}
