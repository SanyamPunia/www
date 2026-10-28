/**
 * What the map holds: the places, where they are, and the town they sit in.
 * Plain data, no React. The icons are named here and mapped to components in
 * `index.tsx`, so this file stays importable anywhere.
 *
 * The world is a 1040 unit square, and one unit is 2.4 metres. Every distance
 * on the list is measured from `YOU` with that scale, so the list cannot claim
 * a distance the map does not draw.
 */

export const WORLD = 1040;

/** metres per world unit */
const METRES = 2.4;

/** where the reader is: the blue dot, and where the map opens */
export const YOU = { x: 440, y: 470 } as const;

export type Glyph =
  | "heart"
  | "sun"
  | "cherries"
  | "image"
  | "clover"
  | "play"
  | "note"
  | "flame"
  | "star"
  | "clock";

export interface Place {
  id: string;
  name: string;
  /** the name under a favourite's circle, where the whole name does not fit */
  short: string;
  kind: string;
  glyph: Glyph;
  /** the pin's fill. White icons clear 3:1 on every one */
  hue: string;
  x: number;
  y: number;
}

/**
 * The hues are scoped to this experiment and are not tokens, the claim
 * `swipe-row` makes: colour is what tells ten pins built from one circle
 * apart at a glance. White on each measures 3.95 to 5.92.
 */
export const PLACES: readonly Place[] = [
  {
    id: "home",
    name: "Home",
    short: "Home",
    kind: "Saved",
    glyph: "heart",
    hue: "#2f6fd6",
    x: 360,
    y: 400,
  },
  {
    id: "lido",
    name: "Harbour Lido",
    short: "Lido",
    kind: "Swimming",
    glyph: "sun",
    hue: "#c2690a",
    x: 610,
    y: 560,
  },
  {
    id: "market",
    name: "Fruit Market",
    short: "Market",
    kind: "Market",
    glyph: "cherries",
    hue: "#d23f35",
    x: 500,
    y: 360,
  },
  {
    id: "gallery",
    name: "Long Gallery",
    short: "Gallery",
    kind: "Museum",
    glyph: "image",
    hue: "#c23d82",
    x: 300,
    y: 520,
  },
  {
    id: "garden",
    name: "Botanic Garden",
    short: "Garden",
    kind: "Park",
    glyph: "clover",
    hue: "#2c8a51",
    x: 540,
    y: 440,
  },
  {
    id: "cinema",
    name: "Rex Cinema",
    short: "Cinema",
    kind: "Cinema",
    glyph: "play",
    hue: "#6650c8",
    x: 400,
    y: 300,
  },
  {
    id: "library",
    name: "Reading Room",
    short: "Library",
    kind: "Library",
    glyph: "note",
    hue: "#80612f",
    x: 640,
    y: 330,
  },
  {
    id: "night",
    name: "Night Market",
    short: "Night",
    kind: "Street food",
    glyph: "flame",
    hue: "#d4581a",
    x: 280,
    y: 340,
  },
  {
    id: "lookout",
    name: "Signal Hill",
    short: "Hill",
    kind: "Lookout",
    glyph: "star",
    hue: "#3f7f8f",
    x: 680,
    y: 420,
  },
  {
    id: "pier",
    name: "Ferry Pier",
    short: "Pier",
    kind: "Ferry",
    glyph: "clock",
    hue: "#3c6b9e",
    x: 480,
    y: 640,
  },
];

/** the favourites row: four places, in the order they sit */
export const FAVOURITES = ["home", "lido", "market", "garden"] as const;

/** a place's distance from the reader, as a label */
export function distance(p: Place): string {
  const m = Math.hypot(p.x - YOU.x, p.y - YOU.y) * METRES;
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

/** the places nearest first, the order the list shows them in */
export const NEARBY: readonly Place[] = [...PLACES]
  .filter((p) => p.id !== "home")
  .sort(
    (a, b) =>
      Math.hypot(a.x - YOU.x, a.y - YOU.y) -
      Math.hypot(b.x - YOU.x, b.y - YOU.y),
  );

export function placeById(id: string): Place | undefined {
  return PLACES.find((p) => p.id === id);
}

/** a search matches the start of any word in a place's name or its kind */
export function matches(p: Place, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return `${p.name} ${p.kind}`
    .toLowerCase()
    .split(/\s+/)
    .some((w) => w.startsWith(q));
}

/** a small integer hash, so the town is drawn the same way on every load */
export function hash(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}
