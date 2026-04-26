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
  | "dive-complete"
  | "pack-call"           // a predator broadcasts engage to its packmates
  | "predator-kill"       // the lamp breaks a predator
  | "adrenaline-engage"   // adrenaline burst triggers — rising bend, cinematic
  | "adrenaline-disengage" // adrenaline burst ends — falling bend, settles
  | "depth-mark";         // sub crosses a hectometer (every 100 m descent)

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
    case "pack-call":
      // Two short low chirps — a predator radioing its packmates.
      // Tritone interval (D2 → G#2) so it reads as alarming, not
      // melodic.
      synth.triggerAttackRelease("D2", "32n", now);
      synth.triggerAttackRelease("G#2", "32n", now + 0.06);
      break;
    case "predator-kill":
      // Hollow whoomph — a low pluck + a high glassy tail. Sells the
      // "I broke that thing" beat.
      pling.triggerAttackRelease("A1", "8n", now);
      synth.triggerAttackRelease(["A5", "E6"], "16n", now + 0.05);
      break;
    case "adrenaline-engage":
      // Rising bend — A4 → E5 → B5 — cinematic time-snap-in. The
      // last note holds longer to anchor the slow-mo beat. Hot,
      // bright, attention-grabbing.
      synth.triggerAttackRelease("A4", "32n", now);
      synth.triggerAttackRelease("E5", "32n", now + 0.04);
      synth.triggerAttackRelease("B5", "8n", now + 0.08);
      break;
    case "adrenaline-disengage":
      // Falling bend — settles back. Inverse of engage so the
      // bookend is sonically obvious. Softer volume so the player
      // feels relief rather than another impact.
      synth.triggerAttackRelease("B5", "32n", now);
      synth.triggerAttackRelease("E5", "32n", now + 0.06);
      synth.triggerAttackRelease("A4", "8n", now + 0.12);
      break;
    case "depth-mark":
      // Single soft sub-bass click on hectometer crossings. Quiet
      // enough to live alongside the ambient pad without crowding
      // it; the visual hectometer accent leads the read, the audio
      // confirms it after a beat.
      pling.triggerAttackRelease("E2", "16n", now);
      break;
  }
}

export function disposeSfx(): void {
  synth?.dispose();
  pling?.dispose();
  synth = null;
  pling = null;
}
