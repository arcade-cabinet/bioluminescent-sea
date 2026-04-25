import type { DiveCompletionCelebration, DiveRunSummary } from "@/sim";

interface CompletionBackdropProps {
  celebration: DiveCompletionCelebration;
  summary: DiveRunSummary;
}

/**
 * Decorative arc + landmark dots painted behind the completion screen
 * summary. Aria-hidden, pointer-events disabled — purely an aesthetic beat.
 */
export function CompletionBackdrop({ celebration, summary }: CompletionBackdropProps) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_50%_42%,rgba(45,212,191,0.2),transparent_42%),linear-gradient(180deg,#051923,#020611)]"
    >
      <div className="absolute inset-x-[8%] top-[16%] h-[52%] rounded-[50%] border border-cyan-200/20 shadow-[0_0_80px_rgba(45,212,191,0.22)]" />
      {celebration.landmarkSequence.map((landmark, index) => {
        const progress =
          celebration.landmarkSequence.length <= 1
            ? 0
            : index / (celebration.landmarkSequence.length - 1);
        return (
          <div
            key={landmark}
            className="absolute grid h-14 w-14 place-items-center rounded-full border border-cyan-100/30 bg-cyan-900/35 text-[0.48rem] font-black uppercase tracking-[0.14em] text-cyan-50 shadow-[0_0_28px_rgba(103,232,249,0.4)]"
            style={{
              left: `${12 + progress * 76}%`,
              top: `${62 - Math.sin(progress * Math.PI) * 34}%`,
              transform: "translate(-50%, -50%)",
            }}
          >
            {index + 1}
          </div>
        );
      })}
      <div className="absolute bottom-[18%] left-1/2 -translate-x-1/2 rounded-md border border-amber-200/25 bg-slate-950/56 px-4 py-2 text-center font-mono text-[0.64rem] font-black uppercase tracking-[0.2em] text-amber-100">
        {summary.timeLeft}s oxygen banked / {summary.depthMeters}m charted
      </div>
    </div>
  );
}
