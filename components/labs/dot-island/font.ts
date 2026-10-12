/**
 * The island's type and icons, as bitmaps on its own grid.
 *
 * Every glyph is seven rows tall. Letters are lowercase, with the x-height on
 * rows 2 to 6 and ascenders on rows 0 and 1, so the panel speaks in the site's
 * own lowercase rather than an LED's capitals. No word on the island has a
 * descender, which is what lets seven rows carry it. Digits run the full seven
 * rows and are all four wide, so a running timer never shifts sideways.
 *
 * `#` is a lit cell and `.` an unlit one. Widths vary per glyph.
 */

export type Bitmap = readonly string[];

export const LETTERS: Record<string, Bitmap> = {
  a: ["....", "....", ".###", "...#", ".###", "#..#", ".###"],
  c: ["....", "....", ".###", "#...", "#...", "#...", ".###"],
  d: ["...#", "...#", ".###", "#..#", "#..#", "#..#", ".###"],
  e: ["....", "....", ".##.", "#..#", "####", "#...", ".###"],
  h: ["#...", "#...", "###.", "#..#", "#..#", "#..#", "#..#"],
  l: ["#.", "#.", "#.", "#.", "#.", "#.", ".#"],
  n: ["....", "....", "###.", "#..#", "#..#", "#..#", "#..#"],
  o: ["....", "....", ".##.", "#..#", "#..#", "#..#", ".##."],
  r: ["....", "....", "#.##", "##..", "#...", "#...", "#..."],
  s: ["....", "....", ".###", "#...", ".##.", "...#", "###."],
  t: ["...", ".#.", "###", ".#.", ".#.", ".#.", "..#"],
  v: [".....", ".....", "#...#", "#...#", ".#.#.", ".#.#.", "..#.."],
};

export const DIGITS: Record<string, Bitmap> = {
  "0": [".##.", "#..#", "#..#", "#..#", "#..#", "#..#", ".##."],
  "1": ["..#.", ".##.", "..#.", "..#.", "..#.", "..#.", ".###"],
  "2": [".##.", "#..#", "...#", "..#.", ".#..", "#...", "####"],
  "3": ["###.", "...#", "...#", ".##.", "...#", "...#", "###."],
  "4": ["..#.", ".##.", "#.#.", "#.#.", "####", "..#.", "..#."],
  "5": ["####", "#...", "###.", "...#", "...#", "#..#", ".##."],
  "6": [".##.", "#...", "#...", "###.", "#..#", "#..#", ".##."],
  "7": ["####", "...#", "..#.", "..#.", ".#..", ".#..", ".#.."],
  "8": [".##.", "#..#", "#..#", ".##.", "#..#", "#..#", ".##."],
  "9": [".##.", "#..#", "#..#", ".###", "...#", "...#", ".##."],
  ":": [".", ".", "#", ".", "#", ".", "."],
};

/** a solid record dot, the one the recording pill blinks */
export const DISC: Bitmap = [".###.", "#####", "#####", "#####", ".###."];

/** the 3 by 3 loader's eight outer cells, clockwise from the top left */
export const LOADER: readonly (readonly [number, number])[] = [
  [0, 0],
  [1, 0],
  [2, 0],
  [2, 1],
  [2, 2],
  [1, 2],
  [0, 2],
  [0, 1],
];

/* The icons. Each is 7 by 7, and each has a resting frame and the frames it
   plays while its row is hovered. */

const REC_SOLID: Bitmap = [
  "..###..",
  ".#####.",
  "#######",
  "#######",
  "#######",
  ".#####.",
  "..###..",
];
const REC_3: Bitmap = [
  "..###..",
  ".#...#.",
  "#.###.#",
  "#.###.#",
  "#.###.#",
  ".#...#.",
  "..###..",
];
const REC_1: Bitmap = [
  "..###..",
  ".#...#.",
  "#.....#",
  "#..#..#",
  "#.....#",
  ".#...#.",
  "..###..",
];

const CAM_7: Bitmap = [
  "##...##",
  "#.....#",
  ".......",
  "...#...",
  ".......",
  "#.....#",
  "##...##",
];
const CAM_5: Bitmap = [
  ".......",
  ".##.##.",
  ".#...#.",
  ".......",
  ".#...#.",
  ".##.##.",
  ".......",
];
const CAM_FLASH: Bitmap = [
  ".......",
  ".##.##.",
  ".#.#.#.",
  "..###..",
  ".#.#.#.",
  ".##.##.",
  ".......",
];

const TRASH: Bitmap = [
  "..###..",
  "#######",
  ".#####.",
  ".#.#.#.",
  ".#.#.#.",
  ".#.#.#.",
  "..###..",
];
const TRASH_OPEN: Bitmap = [
  ".....##",
  "..####.",
  ".#####.",
  ".#.#.#.",
  ".#.#.#.",
  ".#.#.#.",
  "..###..",
];

export const CHECK: Bitmap = [
  ".......",
  "......#",
  ".....#.",
  "#...#..",
  ".#.#...",
  "..#....",
  ".......",
];

/** the save icon's arrow and tray, kept apart so the arrow can drop */
const ARROW: readonly (readonly [number, number])[] = [
  [3, 0],
  [3, 1],
  [1, 2],
  [3, 2],
  [5, 2],
  [2, 3],
  [3, 3],
  [4, 3],
  [3, 4],
];
const TRAY: readonly (readonly [number, number])[] = [
  [0, 5],
  [6, 5],
  [0, 6],
  [1, 6],
  [2, 6],
  [3, 6],
  [4, 6],
  [5, 6],
  [6, 6],
];

/**
 * The ring of a 7 by 7 circle, clockwise from the top. Restart is this ring
 * with a gap in it, and hovering it runs the gap round, which is the chase.
 */
const RING: readonly (readonly [number, number])[] = (() => {
  const cells: [number, number][] = [];
  REC_1.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === "#" && !(x === 3 && y === 3)) cells.push([x, y]);
    }
  });
  const angle = ([x, y]: [number, number]) => {
    const a = Math.atan2(x - 3, -(y - 3));
    return a < 0 ? a + Math.PI * 2 : a;
  };
  return cells.sort((p, q) => angle(p) - angle(q));
})();

export type Icon = "rec" | "cam" | "save" | "restart" | "trash" | "check";

type Cells = [number, number][];

export function bitmapCells(bitmap: Bitmap): Cells {
  const cells: Cells = [];
  bitmap.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === "#") cells.push([x, y]);
  });
  return cells;
}

/** one frame of a list, each held for `ms` */
function pick<T>(frames: readonly T[], t: number, ms: number): T {
  return frames[Math.floor(t / ms) % frames.length];
}

/**
 * How long one loop of each icon's flipbook takes, in ms. Every loop ends on
 * the resting frame, so a hover that leaves mid-loop plays the loop out and
 * lands on rest rather than cutting to it. Restart's loop is one lap of the
 * gap round its ring.
 */
export const CYCLE: Record<Icon, number> = {
  rec: 4 * 150,
  cam: 6 * 130,
  trash: 5 * 120,
  save: 6 * 110,
  restart: 16 * 70,
  check: 0,
};

/**
 * An icon's cells at `t` ms into its hover, or its resting frame when `t` is
 * null. The frames are a flipbook, swapped whole at the LED's own rate, never
 * eased.
 */
export function iconCells(icon: Icon, t: number | null): Cells {
  switch (icon) {
    case "rec":
      return bitmapCells(
        t === null ? REC_3 : pick([REC_SOLID, REC_3, REC_1, REC_3], t, 150),
      );
    case "cam":
      return bitmapCells(
        t === null
          ? CAM_7
          : pick([CAM_5, CAM_FLASH, CAM_5, CAM_7, CAM_7, CAM_7], t, 130),
      );
    case "trash":
      return bitmapCells(
        t === null
          ? TRASH
          : pick([TRASH_OPEN, TRASH_OPEN, TRASH_OPEN, TRASH, TRASH], t, 120),
      );
    case "check":
      return bitmapCells(CHECK);
    case "save": {
      const drop = t === null ? 0 : pick([-2, -1, 0, 1, 1, 0], t, 110);
      const arrow = ARROW.map(([x, y]) => [x, y + drop] as [number, number]);
      return [...arrow.filter(([, y]) => y >= 0), ...(TRAY as Cells)];
    }
    case "restart": {
      /* a three-cell gap, sitting at the top right at rest */
      const at = t === null ? 1 : 1 + Math.floor(t / 70);
      return RING.filter((_, i) => {
        const k = (i - at + RING.length) % RING.length;
        return k > 2;
      }) as Cells;
    }
  }
}

/** a word set in the island's face, with one blank column between letters */
export function wordCells(word: string): { cells: Cells; w: number } {
  const cells: Cells = [];
  let x = 0;
  for (const ch of word) {
    const glyph = LETTERS[ch] ?? DIGITS[ch];
    if (!glyph) continue;
    for (const [gx, gy] of bitmapCells(glyph)) cells.push([x + gx, gy]);
    x += glyph[0].length + 1;
  }
  return { cells, w: Math.max(0, x - 1) };
}

/** the width a word will take, without building it */
export function wordWidth(word: string): number {
  return wordCells(word).w;
}
