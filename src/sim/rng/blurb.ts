import { CODENAME_SEED_MASK } from "./codename";

// Pre-dive flavor lines. Voice: a plain-English note from someone
// who has been down on this seed before. No lore-jargon — the player
// should read these and learn something concrete about what's
// down there (or what to watch for) without needing a glossary.
const OPENERS: readonly string[] = [
  "Earlier divers report",
  "The dive log notes",
  "Sonar readings show",
  "Last week's sounding said",
  "Prior runs found",
  "The oceanographer's report mentions",
  "Surface charts indicate",
  "Recent telemetry shows",
];

const BODIES: readonly string[] = [
  "thick plankton clouds along the sunlight zone — easy collecting up top.",
  "anglerfish hold the midnight zone in unusually high numbers.",
  "predators run the twilight zone faster here than the chart predicts.",
  "marine snow falls heavy through the twilight column — easier to hide in.",
  "oxygen runs short below the twilight zone on this seed.",
  "the abyss is sparse here — you'll see predators coming from far off.",
  "vent-glow stabs up from the hadal floor — bright enough to disorient.",
  "kelp forests block long sight-lines near the surface.",
  "giant squid passages cross the bathypelagic — keep moving.",
  "a whale fall sits in the abyss on this route — dense bioluminescence around it.",
  "hydrothermal vents punch up into the hadal — heat, life, and predators.",
  "this seed runs deep — push for the abyss if your oxygen holds.",
  "a sargassum drift floats along the surface — flying fish break from underneath.",
  "the continental shelf drops off sharply here; tuna and rays patrol the lip.",
  "vertical migration is timed wrong on this seed — the deep is awake all day.",
  "a bone field stretches across the abyssal plain — quiet, lit by worms.",
  "a cold seep bubbles methane near the hadal edge; tube worms and nothing else.",
  "the hadal trench runs deep here — snailfish glide near-still in the dark.",
];

const CLOSERS: readonly string[] = [
  "Good hunting.",
  "Watch the dark.",
  "Keep your light on.",
  "Mind your oxygen.",
  "One breath at a time.",
  "Chain the pickups.",
  "Surface when you're ready.",
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
