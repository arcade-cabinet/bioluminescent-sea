import * as Tone from "tone";
import type { BiomeId } from "@/sim/factories/region";
import { isMuted, onMuteChange } from "./mixer";

/**
 * Tone.js ambient pad — synthesized per-biome pad with a low-pass
 * filter whose cutoff drifts with depth. No audio asset files; the
 * synth is built from primitives so the bundle stays small and the
 * mood is legible even on cold start.
 *
 * Voicings:
 *   photic-gate     — lydian open fifth (airy, surface warmth)
 *   twilight-shelf  — suspended fourth (unresolved)
 *   midnight-column — minor ninth (bruise, deep color)
 *   abyssal-trench  — minor second cluster (dissonant warn)
 *
 * Cutoff modulation: `depthMeters` → filter frequency, shallower
 * means brighter. At 3200m the cutoff sits around 400 Hz.
 */

interface AmbientController {
  start(): Promise<void>;
  setBiome(biome: BiomeId): void;
  setDepthMeters(m: number): void;
  /**
   * 0..1 threat intensity, set every frame from the active stalk +
   * charge predator count near the player. Drives a low rumble
   * sub-synth and tightens the pad's filter Q so the music
   * thickens + grits when predators are pressing in. Ramped
   * smoothly so a passing predator doesn't pop the rumble in/out.
   */
  setThreatIntensity(intensity: number): void;
  /**
   * 0..1 leviathan proximity. Drives a separate ultra-low drone
   * (E1) on its own gain so the player feels something MASSIVE
   * is nearby even when the silhouette is hidden in the abyss
   * tint. Independent of the threatRumble (predator pressure) so
   * the two cues compose: a leviathan during a predator press is
   * cinematic dread on top of skirmish urgency.
   */
  setLeviathanProximity(intensity: number): void;
  stop(): void;
}

const BIOME_VOICINGS: Record<BiomeId, readonly string[]> = {
  "photic-gate": ["A3", "E4", "B4", "F#5"],
  "twilight-shelf": ["A3", "D4", "E4", "A4"],
  "midnight-column": ["A2", "E3", "C4", "B4"],
  "abyssal-trench": ["A2", "Bb2", "E3", "F3"],
  "stygian-abyss": ["A1", "C2", "C#2", "G2"],
};

export function createAmbient(): AmbientController {
  let started = false;
  let filter: Tone.Filter | null = null;
  let reverb: Tone.Reverb | null = null;
  let synth: Tone.PolySynth<Tone.AMSynth> | null = null;
  /** Sub-bass rumble that fades in with threat intensity. The
   *  filter+reverb chain is shared with the pad so it sits in the
   *  same room. */
  let rumble: Tone.MonoSynth | null = null;
  let rumbleGain: Tone.Gain | null = null;
  /** Ultra-low leviathan drone — even deeper than `rumble` (E1 vs
   *  A1) so the two layers interlock without masking each other.
   *  Independent gain ramps with leviathanProximity. */
  let leviathan: Tone.MonoSynth | null = null;
  let leviathanGain: Tone.Gain | null = null;
  let currentBiome: BiomeId = "photic-gate";
  let unsubMute: (() => void) | null = null;

  const scheduleChord = (time?: number) => {
    if (!synth) return;
    if (!isMuted()) {
      const voicing = BIOME_VOICINGS[currentBiome];
      synth.triggerAttackRelease(Array.from(voicing), "2n", time);
    }
    // Always reschedule so muting does not permanently kill the pad.
    // The Transport is cancelled in stop(), which breaks the recursion
    // on unmount.
    Tone.getTransport().scheduleOnce(scheduleChord, "+4n");
  };

  return {
    async start() {
      if (started) return;
      // Tone.js requires a user-gesture before starting on most browsers.
      // This is called from the Begin Dive click.
      await Tone.start();

      filter = new Tone.Filter({ frequency: 1200, type: "lowpass", Q: 1.2 });
      reverb = new Tone.Reverb({ decay: 4, wet: 0.45 });
      synth = new Tone.PolySynth(Tone.AMSynth, {
        harmonicity: 1.5,
        envelope: { attack: 1.5, decay: 0.3, sustain: 0.7, release: 3 },
        modulationEnvelope: { attack: 0.8, decay: 0.2, sustain: 0.4, release: 2 },
        volume: -18,
      });
      synth.chain(filter, reverb, Tone.getDestination());

      // Threat rumble — sub-bass note at A1 that sustains as long as
      // the dive runs. Volume rides through `rumbleGain` so the
      // runtime can ramp it up/down each frame from
      // setThreatIntensity. Routed through the same reverb so the
      // rumble inhabits the same acoustic space as the pad.
      rumbleGain = new Tone.Gain(0); // start silent
      rumble = new Tone.MonoSynth({
        oscillator: { type: "sine" },
        envelope: { attack: 0.4, decay: 0.2, sustain: 1, release: 1.5 },
        filterEnvelope: { attack: 0.3, decay: 0.5, sustain: 0.6, baseFrequency: 60, octaves: 1 },
        volume: -10,
      });
      rumble.chain(rumbleGain, reverb);
      rumble.triggerAttack("A1");

      // Leviathan drone — sub-bass E1 with a slow filter envelope.
      // Sits a fifth below the threat rumble and rides on its own
      // gain so the two layers interlock cleanly.
      leviathanGain = new Tone.Gain(0);
      leviathan = new Tone.MonoSynth({
        oscillator: { type: "sine" },
        envelope: { attack: 0.8, decay: 0.4, sustain: 1, release: 2 },
        filterEnvelope: { attack: 0.6, decay: 1, sustain: 0.7, baseFrequency: 40, octaves: 1 },
        volume: -8,
      });
      leviathan.chain(leviathanGain, reverb);
      leviathan.triggerAttack("E1");

      unsubMute = onMuteChange((muted) => {
        if (muted) Tone.getDestination().mute = true;
        else Tone.getDestination().mute = false;
      });
      Tone.getDestination().mute = isMuted();

      Tone.getTransport().bpm.value = 54;
      Tone.getTransport().start();
      started = true;
      scheduleChord();
    },
    setBiome(biome) {
      currentBiome = biome;
    },
    setDepthMeters(m) {
      if (!filter) return;
      // 0 m → 2400 Hz, 3600 m → 320 Hz. Clamped.
      const clamped = Math.max(0, Math.min(3600, m));
      const cutoff = 2400 - (clamped / 3600) * 2080;
      filter.frequency.rampTo(cutoff, 0.5);
    },
    setThreatIntensity(intensity) {
      if (!rumbleGain || !filter) return;
      const clamped = Math.max(0, Math.min(1, intensity));
      // Linear ramp over 0.6s — fast enough to feel responsive when
      // the player whips the lamp around, slow enough that a single
      // predator passing through the cone doesn't pulse the rumble.
      rumbleGain.gain.rampTo(clamped * 0.7, 0.6);
      // Tighten the pad filter Q with intensity so the chord becomes
      // narrower / more focused as threat builds — sonic equivalent
      // of the camera-shake intensity ramp.
      filter.Q.rampTo(1.2 + clamped * 2.4, 0.6);
    },
    setLeviathanProximity(intensity) {
      if (!leviathanGain) return;
      const clamped = Math.max(0, Math.min(1, intensity));
      // Slower ramp than threat (1.2s vs 0.6s) — leviathan presence
      // SHOULD feel like it's inevitably approaching, not snapping
      // in/out as the player wiggles. Saturates at 0.85 gain so it
      // never fully drowns the pad even when the player is right on
      // top of the leviathan.
      leviathanGain.gain.rampTo(clamped * 0.85, 1.2);
    },
    stop() {
      if (!started) return;
      Tone.getTransport().stop();
      Tone.getTransport().cancel();
      synth?.releaseAll();
      synth?.dispose();
      filter?.dispose();
      reverb?.dispose();
      rumble?.triggerRelease();
      rumble?.dispose();
      rumbleGain?.dispose();
      leviathan?.triggerRelease();
      leviathan?.dispose();
      leviathanGain?.dispose();
      synth = null;
      filter = null;
      reverb = null;
      rumble = null;
      rumbleGain = null;
      leviathan = null;
      leviathanGain = null;
      unsubMute?.();
      started = false;
    },
  };
}
