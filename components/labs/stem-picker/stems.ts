/**
 * What is in the bunch, and where each stem sits in it.
 *
 * A hand-tied bunch is the one arrangement where the arrival and the resting
 * place are the same geometry. Every stem is pinned at the knot and differs
 * only by the angle it leans at, so adding one is a rotation about that knot
 * and nothing has to travel a path invented for the occasion. That is the
 * whole reason the subject is a bunch rather than a row.
 *
 * Nine varieties, because colour is what tells one stem from another when they
 * are built from the same three shapes. That is the exception a dozen other
 * experiments here already take, and this is the narrow form of it: a market
 * bunch is mixed by definition, so the hues are the product rather than a tint
 * applied to one. Each is scoped to this experiment and nothing else may reach
 * for them.
 */

/**
 * Three forms, not one.
 *
 * Nine blooms built from one ring of ellipses is nine of the same flower in
 * different colours, which reads as clip art however the colours are chosen.
 * A market bunch is mixed in shape before it is mixed in hue, so an open bloom,
 * a pompom and a cup carry most of the variety and the palette does the rest.
 */
export type Form = "open" | "round" | "cup";

export interface Variety {
  id: string;
  name: string;
  form: Form;
  /** the petals */
  petal: string;
  /** a darker tone of the same hue, so a pale bloom still has an edge on white */
  edge: string;
  /** the eye. unused by `cup`, which is closed */
  centre: string;
  /** how many petals the ring carries. unused by `cup` */
  petals: number;
  /** the bloom's own size, so the bunch does not dome evenly */
  size: number;
}

export const VARIETIES: Variety[] = [
  {
    id: "ranunculus",
    name: "Ranunculus",
    form: "open",
    petal: "#e0705f",
    edge: "#b2513f",
    centre: "#e8c97a",
    petals: 9,
    size: 1.0,
  },
  {
    id: "anemone",
    name: "Anemone",
    form: "open",
    petal: "#f2ece2",
    edge: "#cdc2b1",
    centre: "#3a3340",
    petals: 7,
    size: 1.08,
  },
  {
    id: "tulip",
    name: "Tulip",
    form: "cup",
    petal: "#e8b862",
    edge: "#b98c37",
    centre: "#b98c37",
    petals: 3,
    size: 0.94,
  },
  {
    id: "cosmos",
    name: "Cosmos",
    form: "open",
    petal: "#dd8fa4",
    edge: "#b06478",
    centre: "#efdca6",
    petals: 8,
    size: 0.9,
  },
  {
    id: "scabiosa",
    name: "Scabiosa",
    form: "round",
    petal: "#8aa8c8",
    edge: "#5f80a3",
    centre: "#eef2f6",
    petals: 12,
    size: 0.82,
  },
  {
    id: "marigold",
    name: "Marigold",
    form: "round",
    petal: "#d98b3f",
    edge: "#a5621f",
    centre: "#a5621f",
    petals: 12,
    size: 0.86,
  },
  {
    id: "aster",
    name: "Aster",
    form: "open",
    petal: "#a996cb",
    edge: "#7d69a3",
    centre: "#efe3a8",
    petals: 11,
    size: 0.92,
  },
  {
    id: "craspedia",
    name: "Craspedia",
    form: "round",
    petal: "#d7ae3c",
    edge: "#a8851f",
    centre: "#c49c2c",
    petals: 10,
    size: 0.7,
  },
  {
    id: "dahlia",
    name: "Dahlia",
    form: "cup",
    petal: "#bd5a75",
    edge: "#8f3b53",
    centre: "#8f3b53",
    petals: 3,
    size: 1.02,
  },
];

/** one green for every stem, since the foliage is not what tells them apart */
export const FOLIAGE = "#5b7a48";
export const FOLIAGE_DEEP = "#47603a";
/** the twine at the knot */
export const TWINE = "#cbbfa6";
export const TWINE_DEEP = "#a89b80";

export const MIN = 1;
export const MAX = VARIETIES.length;

/**
 * How wide the fan opens.
 *
 * Not linear in the count. Eleven degrees a gap put the second stem five and a
 * half degrees off the first, which is two blooms sitting on top of each other,
 * and it then ran past anything a hand could hold before the ninth. A bunch
 * opens decisively on the first few stems and fills in after that, so this
 * approaches the cap rather than walking into it: measured, 21 degrees at two
 * stems, 37 at three, 56 at five and 71 at nine.
 *
 * The cap is where the outer stems start lying closer to the table than to the
 * bunch, which is the point it stops reading as something being held.
 */
const SPREAD_MAX = 76;
const OPENING = 3;

export function spreadFor(count: number): number {
  if (count <= 1) return 0;
  return SPREAD_MAX * (1 - Math.exp(-(count - 1) / OPENING));
}

/** where stem `index` leans, in degrees, with the fan centred on the knot */
export function angleAt(index: number, count: number): number {
  if (count <= 1) return 0;
  const spread = spreadFor(count);
  return -spread / 2 + (spread * index) / (count - 1);
}

/**
 * A deterministic wobble per stem.
 *
 * Not `Math.random`, because a stem is re-rendered every time the count changes
 * and a fresh roll would make the whole bunch twitch when one stem arrives.
 * Seeded off the index, so a stem keeps whatever it was given for as long as it
 * is in the bunch.
 *
 * An integer hash rather than the usual `sin(x) * 43758.5453`. That one is a
 * GLSL trick and it degenerates on small integer inputs here: measured across
 * the nine stems it gave the same tilt to five of them, 2.0 to 2.2 degrees, and
 * put a leaf on none of the first two. Whether a hash is good enough is
 * something to check by printing it, not by assuming.
 */
function noise(index: number, salt: number): number {
  let hash = Math.imul(index + 1, 374761393) + Math.imul(salt + 1, 668265263);
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
}

/**
 * Stems are cut by hand, so no two are the same length.
 *
 * Without this every bloom lands on one arc and the bunch reads as a diagram
 * of a bunch. A sixteen percent spread is enough to break the arc and small
 * enough that the fan still looks deliberate.
 */
export function lengthAt(index: number): number {
  return 0.92 + noise(index, 1) * 0.16;
}

/** how far the bloom is turned on its own stem */
export function tiltAt(index: number): number {
  return (noise(index, 2) - 0.5) * 30;
}

/** which side the leaf comes off, split as near evenly as nine stems allow */
export function leafSideAt(index: number): 1 | -1 {
  return noise(index, 7) > 0.5 ? 1 : -1;
}

/**
 * Not every stem carries a leaf, and the ones that do carry it at a different
 * height.
 *
 * Nine leaves at one height gather into a single green mass above the knot,
 * which reads as a hedge rather than as foliage. Two stems in three is enough
 * to say the bunch has leaves in it.
 */
export function leafAt(index: number): number | null {
  const roll = noise(index, 5);
  return roll > 0.34 ? 118 + noise(index, 6) * 34 : null;
}

/** how far the stem bows, in the drawing's own units */
export function bendAt(index: number): number {
  return (noise(index, 4) - 0.5) * 11;
}

export function varietyAt(index: number): Variety {
  return VARIETIES[index % VARIETIES.length];
}

/** the bunch in the order it was cut, which is what a fresh order looks like */
export function inOrder(): number[] {
  return VARIETIES.map((_, index) => index);
}

/**
 * A new mix.
 *
 * Fisher-Yates, and it refuses to return the arrangement it was handed. A
 * shuffle that lands on the same order reads as a control that did nothing,
 * which is worse than not offering one, and with nine varieties it comes up
 * often enough to notice.
 */
export function reshuffle(current: number[]): number[] {
  const next = [...current];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next.every((value, index) => value === current[index])
    ? reshuffle(current)
    : next;
}
