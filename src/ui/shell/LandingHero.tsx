import { useEffect, useRef } from "react";

const PALETTE = {
  skyTop: "#020611",
  skyBottom: "#0b1b36",
  waterTop: "#072033",
  waterBottom: "#050a14",
  abyss: "#050a14",
  deep: "#0e4f55",
  glow: "#6be6c1",
  fgMuted: "#8aa7a2",
};

interface Wave {
  amplitude: number;
  period: number;
  phase: number;
  speed: number;
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

    const waves: Wave[] = [
      { amplitude: 8, period: 0.005, phase: 0, speed: 0.8 },
      { amplitude: 4, period: 0.012, phase: 2, speed: 1.4 },
      { amplitude: 2, period: 0.025, phase: 4, speed: 2.2 },
    ];

    let t0 = performance.now();

    function frame(now: number) {
      if (!canvas || !ctx) return;
      const dt = (now - t0) / 1000;
      t0 = now;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      const horizonY = h * 0.45;

      // Draw Sky
      const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
      skyGrad.addColorStop(0, PALETTE.skyTop);
      skyGrad.addColorStop(1, PALETTE.skyBottom);
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, horizonY);

      // Draw Stars/Distant lights in the sky
      ctx.fillStyle = "rgba(107, 230, 193, 0.4)";
      for (let i = 0; i < 20; i++) {
        const sx = ((i * 37) % w);
        const sy = ((i * 19) % horizonY);
        const twinkle = Math.sin(now * 0.001 + i) * 0.5 + 0.5;
        ctx.globalAlpha = twinkle;
        ctx.beginPath();
        ctx.arc(sx, sy, 1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;

      // Draw Water
      const waterGrad = ctx.createLinearGradient(0, horizonY, 0, h);
      waterGrad.addColorStop(0, PALETTE.waterTop);
      waterGrad.addColorStop(1, PALETTE.waterBottom);
      ctx.fillStyle = waterGrad;
      ctx.fillRect(0, horizonY, w, h - horizonY);

      // Draw Waves at Horizon
      for (const wave of waves) {
        wave.phase += dt * wave.speed;
      }

      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(0, horizonY);
      for (let x = 0; x <= w; x += 10) {
        let yOffset = 0;
        for (const wave of waves) {
          yOffset += Math.sin(x * wave.period + wave.phase) * wave.amplitude;
        }
        ctx.lineTo(x, horizonY + yOffset);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fillStyle = "rgba(5, 10, 20, 0.4)"; // Darken the waves
      ctx.fill();
      
      // Draw horizon glow
      ctx.beginPath();
      for (let x = 0; x <= w; x += 10) {
        let yOffset = 0;
        for (const wave of waves) {
          yOffset += Math.sin(x * wave.period + wave.phase) * wave.amplitude;
        }
        if (x === 0) ctx.moveTo(x, horizonY + yOffset);
        else ctx.lineTo(x, horizonY + yOffset);
      }
      ctx.strokeStyle = "rgba(107, 230, 193, 0.15)";
      ctx.lineWidth = 2;
      ctx.shadowColor = PALETTE.glow;
      ctx.shadowBlur = 15;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // God-ray beams cast down from a few points on the horizon. Same
      // language as the in-game water layer's GodrayFilter so the
      // landing reads as a continuous space with the dive scene.
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const beamCount = 5;
      for (let i = 0; i < beamCount; i++) {
        const beamX = ((i + 0.5) / beamCount) * w + Math.sin(now * 0.0004 + i) * 30;
        const beamGrad = ctx.createLinearGradient(beamX, horizonY, beamX + 80, h);
        beamGrad.addColorStop(0, "rgba(107, 230, 193, 0.18)");
        beamGrad.addColorStop(1, "rgba(107, 230, 193, 0)");
        ctx.beginPath();
        ctx.moveTo(beamX, horizonY);
        ctx.lineTo(beamX + 90, h);
        ctx.lineTo(beamX + 130, h);
        ctx.lineTo(beamX + 30, horizonY);
        ctx.closePath();
        ctx.fillStyle = beamGrad;
        ctx.fill();
      }
      ctx.restore();

      // Caustic spots — bright thresholded noise peaks on the upper
      // water band. Tinted mint, additive blend; same shape language
      // as the in-game caustics pass.
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const spotCount = 22;
      for (let i = 0; i < spotCount; i++) {
        const sx = ((i * 113) % w);
        const sy = horizonY + (((i * 71) % (h - horizonY)) * 0.6);
        const wobble =
          Math.sin(now * 0.0008 + i * 0.5) +
          Math.cos(now * 0.0011 + i * 0.7);
        if (wobble > 0.3) {
          const intensity = (wobble - 0.3) / 1.7;
          const r = 12 + intensity * 22;
          const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
          grad.addColorStop(0, `rgba(107, 230, 193, ${0.18 * intensity})`);
          grad.addColorStop(1, "rgba(107, 230, 193, 0)");
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(sx, sy, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();

      // Calculate Submersible Y offset based on waves at center
      const subX = w * 0.5;
      let waveYOffset = 0;
      for (const wave of waves) {
        waveYOffset += Math.sin(subX * wave.period + wave.phase) * wave.amplitude;
      }
      const bobbing = Math.sin(now * 0.0015) * 4;
      const subY = horizonY + waveYOffset + bobbing;

      drawSubmersible(ctx, subX, subY, Math.min(w, h) * 0.06);

      // Vignette
      const vig = ctx.createRadialGradient(
        w * 0.5,
        h * 0.5,
        Math.min(w, h) * 0.3,
        w * 0.5,
        h * 0.5,
        Math.max(w, h) * 0.9,
      );
      vig.addColorStop(0, "rgba(5, 10, 20, 0)");
      vig.addColorStop(1, "rgba(5, 10, 20, 0.8)");
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
      // Paint one static frame
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
  // Draw light beam pointing up and out into the water/sky
  const coneLen = scale * 8;
  const coneGrad = ctx.createLinearGradient(cx, cy, cx + coneLen * 0.8, cy + coneLen);
  coneGrad.addColorStop(0, "rgba(107, 230, 193, 0.4)");
  coneGrad.addColorStop(1, "rgba(107, 230, 193, 0)");
  ctx.beginPath();
  ctx.moveTo(cx + scale * 0.8, cy + scale * 0.1);
  ctx.lineTo(cx + scale * 0.8 + coneLen * 0.8, cy + coneLen);
  ctx.lineTo(cx + scale * 0.8 - coneLen * 0.3, cy + coneLen * 1.2);
  ctx.closePath();
  ctx.fillStyle = coneGrad;
  ctx.fill();

  ctx.save();
  ctx.translate(cx, cy);
  
  // Bobbing angle
  const pitch = Math.sin(Date.now() * 0.001) * 0.05;
  ctx.rotate(pitch);

  ctx.fillStyle = "#0a1a2e";
  ctx.strokeStyle = "rgba(107, 230, 193, 0.4)";
  ctx.lineWidth = 1.5;

  // Main body
  ctx.beginPath();
  ctx.ellipse(0, 0, scale * 1.2, scale * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Glass dome
  ctx.beginPath();
  ctx.ellipse(scale * 0.2, -scale * 0.15, scale * 0.6, scale * 0.3, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(107, 230, 193, 0.25)";
  ctx.fill();
  ctx.strokeStyle = "rgba(107, 230, 193, 0.6)";
  ctx.stroke();

  // Inner glow (pilot light)
  ctx.beginPath();
  ctx.arc(scale * 0.4, -scale * 0.05, scale * 0.12, 0, Math.PI * 2);
  ctx.fillStyle = "#d9f2ec";
  ctx.shadowColor = PALETTE.glow;
  ctx.shadowBlur = 12;
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.restore();
}
