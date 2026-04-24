import { CODENAME_SEED_MASK } from "./codename";

const OPENERS: readonly string[] = [
  "Guild reports say",
  "The charter warns",
  "Prior divers note",
  "Dispatch logs read",
  "The cartographer's ledger says",
  "Earlier soundings claim",
  "Radio silence below suggests",
  "The beacon manifest hints",
];

const BODIES: readonly string[] = [
  "the trench runs long and the lanterns grow uneven.",
  "beacon chains scatter where the shelf drops away.",
  "pirate wakes have been sighted threading the midnight column.",
  "predator silhouettes pass the lantern rig more often than usual.",
  "oxygen trims shorter than the chart suggests — do not linger.",
  "bioluminescence clusters near the twilight boundary.",
  "the light falls off earlier than any sounding yet filed.",
  "beacons hold their chain if you keep the route tight.",
  "a second light tends to answer near the landmark anemones.",
  "the current thins before the abyssal gate — breathe easy there.",
  "glow-plankton rise early along this seam.",
  "deep routes here are short on margin and long on landmarks.",
];

const CLOSERS: readonly string[] = [
  "Surface breathing easier.",
  "Trace the glow. Come home.",
  "Keep the lanterns close.",
  "Read the trench.",
  "One breath at a time.",
  "Watch the chain.",
  "Chart what holds.",
];

export interface TrenchBlurb {
  opener: string;
  body: string;
  closer: string;
  full: string;
}

/**
 * Procedural one-sentence blurb for a codename. Deterministic:
 * the same seed always produces the same blurb. Three lines stitched
 * together: opener (who reported), body (what they found), closer
 * (advice that doubles as the dive motto).
 *
 * Voice: cartographer's ledger. No whimsy, no fantasy register.
 */
export function trenchBlurbForSeed(seed: number): TrenchBlurb {
  const s = (seed >>> 0) & CODENAME_SEED_MASK;
  // Mix each bucket with a different bit-rotation so openers, bodies, and
  // closers don't all move in lockstep. Keeps blurbs feeling distinct across
  // seeds that share a single codename component.
  const openerIdx = s & 0x3f;
  const bodyIdx = (s >>> 6) & 0x3f;
  const closerIdx = (s >>> 12) & 0x3f;

  const opener = OPENERS[openerIdx % OPENERS.length];
  const body = BODIES[bodyIdx % BODIES.length];
  const closer = CLOSERS[closerIdx % CLOSERS.length];

  return {
    opener,
    body,
    closer,
    full: `${opener} ${body} ${closer}`,
  };
}
