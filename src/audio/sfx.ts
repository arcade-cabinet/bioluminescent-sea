import * as Tone from "tone";
import { isMuted } from "./mixer";

/**
 * Short-form audio events — no sample files, all synthesized.
 *
 * Using Tone.js primitives (not Howler) because all our effects are
 * pitched, short, and look exactly like what Tone.js is designed for.
 * Skipping Howler keeps the bundle down by about 10KB.
 */

export type SfxEvent =
  | "collect"
  | "impact"
  | "biome-transition"
  | "oxygen-warn"
  | "dive-complete";

let synth: Tone.PolySynth<Tone.Synth> | null = null;
let pling: Tone.MembraneSynth | null = null;

function ensureSynths(): void {
  if (synth) return;
  synth = new Tone.PolySynth(Tone.Synth, {
    envelope: { attack: 0.005, decay: 0.15, sustain: 0.1, release: 0.4 },
    volume: -10,
  }).toDestination();
  pling = new Tone.MembraneSynth({
    envelope: { attack: 0.01, decay: 0.3, sustain: 0, release: 0.3 },
    volume: -4,
  }).toDestination();
}

export async function playSfx(event: SfxEvent): Promise<void> {
  if (isMuted()) return;
  if (Tone.getContext().state !== "running") {
    await Tone.start();
  }
  ensureSynths();
  if (!synth || !pling) return;

  const now = Tone.now();
  switch (event) {
    case "collect":
      // Three-note mint chime ascending a perfect fourth.
      synth.triggerAttackRelease("E5", "16n", now);
      synth.triggerAttackRelease("A5", "16n", now + 0.08);
      synth.triggerAttackRelease("B5", "16n", now + 0.16);
      break;
    case "impact":
      // Low thud + dissonant partial.
      pling.triggerAttackRelease("C2", "8n", now);
      synth.triggerAttackRelease("F#3", "16n", now + 0.04);
      break;
    case "biome-transition":
      // Slow open fifth — marks the crossing.
      synth.triggerAttackRelease(["D4", "A4"], "4n", now);
      break;
    case "oxygen-warn":
      // Tense dotted pulse on a minor second.
      synth.triggerAttackRelease("E5", "16n", now);
      synth.triggerAttackRelease("F5", "16n", now + 0.12);
      break;
    case "dive-complete":
      // Rising arpeggio.
      synth.triggerAttackRelease("A3", "8n", now);
      synth.triggerAttackRelease("E4", "8n", now + 0.18);
      synth.triggerAttackRelease("A4", "8n", now + 0.36);
      synth.triggerAttackRelease("C#5", "4n", now + 0.54);
      break;
  }
}

export function disposeSfx(): void {
  synth?.dispose();
  pling?.dispose();
  synth = null;
  pling = null;
}
