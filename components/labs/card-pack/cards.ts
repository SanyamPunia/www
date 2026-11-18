import { rng } from "./pack";

/*
 * What the pack holds: ten studies, each a photograph of one natural object
 * on a paper backdrop, in `public/assets/card-pack/`. A pack deals five of
 * them, and one of the five comes out holo.
 *
 * The hues are this experiment's own, scoped here and nowhere else. The pack
 * is a printed foil wrapper and each card a printed picture, so the colours
 * are the objects rather than a theme on them. See CLAUDE.md.
 */

export const PACK = {
  /** the foil, top to bottom */
  from: "#1f2a68",
  to: "#4a2c7d",
  /** the inside of the foil, seen through the tear */
  inside: "#d4d6df",
  insideShade: "#9a9db0",
  insideDeep: "#55586c",
} as const;

/** the card stock: its printed white, and the colour of its cut edge */
export const STOCK = {
  face: "#f6f4ef",
  edge: "#d8d3c6",
} as const;

export type Rarity = 1 | 2 | 3;

export interface Study {
  name: string;
  /** one line under the name, what the photograph is of */
  caption: string;
  /**
   * The photograph's backdrop colour, sampled off the foot of the photo, so
   * the card's ground runs on from it without a seam. And an ink drawn from
   * the object.
   */
  ground: string;
  ink: string;
  rarity: Rarity;
}

export const STUDIES: readonly Study[] = [
  {
    name: "ember",
    caption: "a coal still burning",
    ground: "#e7af90",
    ink: "#d2522d",
    rarity: 2,
  },
  {
    name: "tide",
    caption: "sea glass and a whelk",
    ground: "#c3d9e3",
    ink: "#2f6f93",
    rarity: 1,
  },
  {
    name: "moss",
    caption: "moss on a river stone",
    ground: "#d2d8be",
    ink: "#4f7a3a",
    rarity: 1,
  },
  {
    name: "dusk",
    caption: "moonstone, blue flash",
    ground: "#2e304f",
    ink: "#f2d58a",
    rarity: 3,
  },
  {
    name: "frost",
    caption: "quartz under rime",
    ground: "#d5dff0",
    ink: "#5b7fb8",
    rarity: 2,
  },
  {
    name: "pollen",
    caption: "a head gone to seed",
    ground: "#f8e6b9",
    ink: "#c08a16",
    rarity: 1,
  },
  {
    name: "slate",
    caption: "slate, split clean",
    ground: "#d5d5da",
    ink: "#4a4f5c",
    rarity: 1,
  },
  {
    name: "clay",
    caption: "a glazed shard",
    ground: "#f0d4bd",
    ink: "#a35a35",
    rarity: 2,
  },
  {
    name: "ink",
    caption: "ink falling through water",
    ground: "#d1cde8",
    ink: "#2a2a6e",
    rarity: 3,
  },
  {
    name: "coral",
    caption: "a branch of coral",
    ground: "#f6d4d2",
    ink: "#c4504a",
    rarity: 2,
  },
];

export interface Dealt {
  study: Study;
  /** its number in the set, 1 to 10 */
  no: number;
  holo: boolean;
}

/** five different studies, and the rarest of them is the holo */
export function deal(seed: number, n = 5): Dealt[] {
  const r = rng(seed * 104729 + 17);
  const order = STUDIES.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const picked = order.slice(0, n);
  let holo = 0;
  for (let i = 1; i < n; i++) {
    if (STUDIES[picked[i]].rarity > STUDIES[picked[holo]].rarity) holo = i;
  }
  return picked.map((index, i) => ({
    study: STUDIES[index],
    no: index + 1,
    holo: i === holo,
  }));
}
