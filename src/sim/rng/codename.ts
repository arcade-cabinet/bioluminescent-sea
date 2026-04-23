/**
 * Adjective-Adjective-Noun codename codec.
 *
 * Each run gets a human-readable codename that round-trips with an
 * 18-bit seed (6 bits per pool × 3 pools = 262,144 distinct names).
 * The codename IS the shareable run ID — `?seed=<slug>` replays the
 * same trench for any player.
 *
 * Word pools are deliberately curated for the trench-chart register:
 * deep-sea geography, liquid/cold-light qualities, benthic fauna.
 * No generic fantasy or cute-RPG vocabulary.
 */

export const ADJECTIVES_PRIMARY: readonly string[] = [
  "Abyssal",
  "Archean",
  "Becalmed",
  "Benthic",
  "Brackish",
  "Briny",
  "Cold",
  "Dim",
  "Drowsy",
  "Ember",
  "Fathom",
  "Fjordlit",
  "Glacial",
  "Glassy",
  "Hadal",
  "Halide",
  "Hollow",
  "Hushed",
  "Indigo",
  "Ink",
  "Isobaric",
  "Kelpish",
  "Lanternlit",
  "Lichened",
  "Midnight",
  "Moonless",
  "Nacre",
  "Noctilucent",
  "Nocturnal",
  "Obsidian",
  "Overcast",
  "Patient",
  "Pelagic",
  "Phosphor",
  "Quiet",
  "Remote",
  "Riven",
  "Saline",
  "Salt",
  "Shaded",
  "Silent",
  "Slack",
  "Slow",
  "Somber",
  "Spectral",
  "Steep",
  "Stilled",
  "Submerged",
  "Sunken",
  "Tempered",
  "Tethered",
  "Tidal",
  "Tideless",
  "Umbral",
  "Undertow",
  "Velvet",
  "Verdigris",
  "Waning",
  "Waterlogged",
  "Weightless",
  "Whispered",
  "Widow",
  "Winterlit",
  "Woven",
];

export const ADJECTIVES_SECONDARY: readonly string[] = [
  "Amber",
  "Ashen",
  "Bell",
  "Bismuth",
  "Bone",
  "Candle",
  "Cinder",
  "Citrine",
  "Clover",
  "Coral",
  "Cypress",
  "Dawn",
  "Driftwood",
  "Dune",
  "Feldspar",
  "Fern",
  "Fog",
  "Foxfire",
  "Frost",
  "Gilded",
  "Glass",
  "Graphite",
  "Harbor",
  "Heather",
  "Horizon",
  "Hyacinth",
  "Iron",
  "Ivory",
  "Jade",
  "Jetsam",
  "Kelp",
  "Lantern",
  "Lapis",
  "Lichen",
  "Lye",
  "Marrow",
  "Mast",
  "Moth",
  "Mussel",
  "Needle",
  "Olivine",
  "Opal",
  "Parchment",
  "Pearl",
  "Peridot",
  "Pewter",
  "Pine",
  "Plume",
  "Quartz",
  "Quill",
  "Reed",
  "Salt",
  "Sextant",
  "Shale",
  "Shroud",
  "Silver",
  "Smoke",
  "Sorrel",
  "Spindle",
  "Spire",
  "Tallow",
  "Tin",
  "Tourmaline",
  "Vellum",
];

export const NOUNS: readonly string[] = [
  "Anglerfish",
  "Archway",
  "Atoll",
  "Benthos",
  "Bloom",
  "Caldera",
  "Cenote",
  "Chasm",
  "Column",
  "Current",
  "Drift",
  "Eddy",
  "Estuary",
  "Fathom",
  "Fissure",
  "Flume",
  "Foraminifer",
  "Gyre",
  "Halocline",
  "Harbinger",
  "Isobath",
  "Keel",
  "Lagoon",
  "Lantern",
  "Leviathan",
  "Maelstrom",
  "Mantle",
  "Nautilus",
  "Nebula",
  "Oculus",
  "Oyster",
  "Passage",
  "Plume",
  "Reef",
  "Ridge",
  "Rookery",
  "Saltwedge",
  "Scarp",
  "Seamount",
  "Shelf",
  "Shipwreck",
  "Shoal",
  "Silence",
  "Siphonophore",
  "Slope",
  "Smolt",
  "Sounding",
  "Spire",
  "Strait",
  "Sump",
  "Swell",
  "Tangle",
  "Thermocline",
  "Tide",
  "Trench",
  "Undertow",
  "Vesper",
  "Volute",
  "Waters",
  "Whalefall",
  "Wharf",
  "Zephyr",
  "Sargasso",
  "Meridian",
  "Fathomline",
];

const ADJ1_BITS = 6;
const ADJ2_BITS = 6;
const NOUN_BITS = 6;
const ADJ1_MASK = (1 << ADJ1_BITS) - 1;
const ADJ2_MASK = (1 << ADJ2_BITS) - 1;
const NOUN_MASK = (1 << NOUN_BITS) - 1;

export const CODENAME_SEED_MASK = (1 << (ADJ1_BITS + ADJ2_BITS + NOUN_BITS)) - 1;

export interface CodenameParts {
  adjective1: string;
  adjective2: string;
  noun: string;
}

export function codenamePartsFromSeed(seed: number): CodenameParts {
  const s = (seed >>> 0) & CODENAME_SEED_MASK;
  const adj1Idx = s & ADJ1_MASK;
  const adj2Idx = (s >>> ADJ1_BITS) & ADJ2_MASK;
  const nounIdx = (s >>> (ADJ1_BITS + ADJ2_BITS)) & NOUN_MASK;
  return {
    adjective1: ADJECTIVES_PRIMARY[adj1Idx],
    adjective2: ADJECTIVES_SECONDARY[adj2Idx],
    noun: NOUNS[nounIdx],
  };
}

export function codenameFromSeed(seed: number): string {
  const parts = codenamePartsFromSeed(seed);
  return `${parts.adjective1} ${parts.adjective2} ${parts.noun}`;
}

export function codenameSlug(codename: string): string {
  return normalize(codename);
}

export function seedFromCodename(codename: string): number | null {
  const tokens = normalize(codename).split("-");
  if (tokens.length !== 3) return null;

  const adj1 = indexOfCaseInsensitive(ADJECTIVES_PRIMARY, tokens[0]);
  const adj2 = indexOfCaseInsensitive(ADJECTIVES_SECONDARY, tokens[1]);
  const noun = indexOfCaseInsensitive(NOUNS, tokens[2]);
  if (adj1 < 0 || adj2 < 0 || noun < 0) return null;

  return (adj1 | (adj2 << ADJ1_BITS) | (noun << (ADJ1_BITS + ADJ2_BITS))) >>> 0;
}

export function dailySeed(date: Date = new Date()): number {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return ((y * 10000 + m * 100 + d) >>> 0) & CODENAME_SEED_MASK;
}

function normalize(codename: string): string {
  return codename
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z-]/g, "");
}

function indexOfCaseInsensitive(pool: readonly string[], token: string): number {
  for (let i = 0; i < pool.length; i++) {
    if (pool[i].toLowerCase() === token) return i;
  }
  return -1;
}
