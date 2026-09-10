/**
 * What is on the shelf.
 *
 * Twelve books built from the same three rectangles, so colour is the only
 * thing telling one from another, which is the exception the brand marks
 * already get. Bookbinding cloth rather than a palette: oxblood, forest,
 * slate, mustard, and the ink is whichever of cream or near-black clears
 * 4.5:1 on the cloth it prints on.
 *
 * Thickness and height are the other two differences, and they are what make
 * a row of spines read as a shelf rather than as a bar chart. Nothing here is
 * random: a generated set has to be rejected and re-rolled until no two
 * neighbours match, which is a designer's eye run in a loop, so the run that
 * survives is the layout whether it was chosen or not.
 */
export type Book = {
  id: string;
  title: string;
  author: string;
  /** the spine's width and the book's height, in stage pixels */
  thickness: number;
  height: number;
  /** how far it leans at rest, in degrees, which only the last one does */
  lean: number;
  /** the cloth, the ink printed on it, and the band across the spine */
  cloth: string;
  ink: string;
  band: string;
};

export const BOOKS: Book[] = [
  {
    id: "grid",
    title: "The Grid",
    author: "H. Renner",
    thickness: 39,
    height: 278,
    lean: 0,
    cloth: "#2f4858",
    ink: "#f2ece0",
    band: "#c8a24a",
  },
  {
    id: "margins",
    title: "Margins",
    author: "P. Oyelaran",
    thickness: 24,
    height: 254,
    lean: 0,
    cloth: "#e5ded0",
    ink: "#2a2723",
    band: "#8a3b34",
  },
  {
    id: "cold-type",
    title: "Cold Type",
    author: "V. Aaltonen",
    thickness: 48,
    height: 288,
    lean: 0,
    cloth: "#7d2f2a",
    ink: "#f4e9d8",
    band: "#e0c07a",
  },
  {
    id: "long-shadows",
    title: "Long Shadows",
    author: "R. Mikkelsen",
    thickness: 30,
    height: 245,
    lean: 0,
    cloth: "#33513f",
    ink: "#eee7d6",
    band: "#c9b78b",
  },
  {
    id: "bindings",
    title: "Bindings",
    author: "T. Okonkwo",
    thickness: 21,
    height: 266,
    lean: 0,
    cloth: "#c7a233",
    ink: "#2b2618",
    band: "#5c4a1c",
  },
  {
    id: "the-fold",
    title: "The Fold",
    author: "M. Sandoval",
    thickness: 41,
    height: 236,
    lean: 0,
    cloth: "#3b3550",
    ink: "#efe9df",
    band: "#a9a0c4",
  },
  {
    id: "field-notes",
    title: "Field Notes",
    author: "K. Lindqvist",
    thickness: 26,
    height: 273,
    lean: 0,
    cloth: "#d9d3c6",
    ink: "#2a2723",
    band: "#3b6b6b",
  },
  {
    id: "slow-light",
    title: "Slow Light",
    author: "A. Ferreira",
    thickness: 33,
    height: 251,
    lean: 0,
    cloth: "#1f4b52",
    ink: "#eef0e9",
    band: "#d08a4a",
  },
  {
    id: "paper-ink",
    title: "Paper & Ink",
    author: "N. Baptiste",
    thickness: 45,
    height: 284,
    lean: 0,
    cloth: "#8c4a1f",
    ink: "#f6ecdc",
    band: "#e8cfa0",
  },
  {
    id: "quiet-rooms",
    title: "Quiet Rooms",
    author: "E. Hollis",
    thickness: 23,
    height: 239,
    lean: 0,
    cloth: "#4a4f3c",
    ink: "#f0eee2",
    band: "#b9b48f",
  },
  {
    id: "the-plate",
    title: "The Plate",
    author: "S. Nakagawa",
    thickness: 36,
    height: 263,
    lean: 0,
    cloth: "#e8e2d4",
    ink: "#2a2723",
    band: "#5a3f6b",
  },
  /* the last one leans, because a shelf with room left in it always has one */
  {
    id: "loose-ends",
    title: "Loose Ends",
    author: "D. Whitmore",
    thickness: 29,
    height: 230,
    lean: 9,
    cloth: "#5a3f6b",
    ink: "#f1e9f2",
    band: "#cbb2d6",
  },
];

/**
 * The pasted label every cover carries. One paper and one ink for all twelve,
 * since a label is a label: the cloth under it is what tells the books apart,
 * and a per-book ink on a cream paper would be twelve contrast checks for no
 * gain. Near-black on this paper is 13.6:1.
 */
export const LABEL = { paper: "#f2ead9", ink: "#2a2723" } as const;

/** how wide a cover is, which is also how deep the books sit on the shelf */
export const COVER = 182;
/** the gap between two spines */
export const GAP = 3;

/** where each book starts along the shelf, and how wide the row comes to */
export const LAYOUT = BOOKS.reduce<{ left: number[]; width: number }>(
  (acc, book) => {
    acc.left.push(acc.width);
    acc.width += book.thickness + GAP;
    return acc;
  },
  { left: [], width: 0 },
);
export const ROW_WIDTH = LAYOUT.width - GAP;

/**
 * How far the leaning book's head swings past the row. A lean pivots on the
 * corner the book stands on, so the box the layout knows about stops at the
 * spine while the head reaches further, and centring the boxes leaves the
 * shelf visibly off centre. Everything is centred on this instead.
 */
export const OVERHANG = Math.round(
  BOOKS.reduce(
    (most, book) =>
      Math.max(most, book.height * Math.sin((book.lean * Math.PI) / 180)),
    0,
  ),
);
