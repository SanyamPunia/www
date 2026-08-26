import { lerp } from "./lerp";

/*
 * The book's whole geometry, as fractions of the stage it sits in.
 *
 * Fractions rather than the measured pixels `document-pocket` and
 * `stamp-collection` deal in, and for the reason those two are pixels: they
 * animate a box's `width`, so a scale would drag a hairline and a shadow with
 * it. Nothing here animates a box at all. Every sheet is the same box in the
 * same place for the life of the demo, and only its `rotateY` moves, so the
 * sizes can stay percentages of the stage and each sheet's printed matter can be
 * `cqw` of the sheet.
 */

/** the stage's own shape, wide enough for the fan at full open */
export const STAGE_ASPECT = 1.45;

/**
 * The closed book, as a share of the stage's height, and its own width/height.
 *
 * The height is what it is because half open is the tallest the book ever gets,
 * and not shut or open: a sheet standing near vertical has its free edge about
 * 150px nearer the eye than its spine, which the perspective magnifies by 1.12,
 * and the tilt spreads the fan's own width across some more of it. Measured at
 * half open: 272px of fan in a 371px stage, clear of the top by 38px.
 */
export const BOOK_HEIGHT = 0.58;
const BOOK_ASPECT = 0.71;

/** and so its width, as a share of the stage's width */
export const BOOK_WIDTH = (BOOK_HEIGHT * BOOK_ASPECT) / STAGE_ASPECT;

/** leaves between the two boards */
const LEAVES = 12;

/**
 * How far the front board swings, in degrees.
 *
 * 168 rather than 180, because a book opened dead flat has no covers left to
 * read: both boards would lie in the stage's own plane and the fan would run out
 * of anything to be a fan against.
 */
export const SPREAD = 168;

/**
 * How far apart the sheets sit in depth, in px, front board to back.
 *
 * This is invisible and it is not decoration. Shut, every sheet holds the same
 * rotation and the same box, so without it fourteen coplanar layers sit exactly
 * on top of each other and nothing but document order decides which paints
 * first. A stack of paper has thickness anyway, and 0.45px a sheet is 5.9px of
 * it, which at this perspective costs the deepest leaf about half a pixel of
 * width.
 */
const SHEET_DEPTH = 0.45;

export interface Sheet {
  id: string;
  /** which board this is, or a leaf */
  kind: "front" | "back" | "leaf";
  /** where the sheet lands at full open, in degrees */
  angle: number;
  /** its own offset in the stack, in px */
  depth: number;
}

export const COUNT = LEAVES + 2;

/**
 * The stack, in document order: back board first, then the leaves, then the
 * front board, which is the one on top when the book is shut.
 *
 * **The fan is the same lerp as the animation, run across the stack instead of
 * across time.** Sheet i lands at `lerp(0, -SPREAD, i / (COUNT - 1))`, so the
 * two boards take the ends and the leaves split what is left evenly, and there
 * is one number in the file deciding how wide the book opens.
 *
 * An even number of leaves is deliberate. An odd one puts a leaf at exactly
 * half the spread, which at full open is the one angle that paints nothing: a
 * sheet seen along its own edge.
 */
export const SHEETS: Sheet[] = Array.from({ length: COUNT }, (_, i) => ({
  id: i === 0 ? "back-board" : i === COUNT - 1 ? "front-board" : `leaf-${i}`,
  kind: i === 0 ? "back" : i === COUNT - 1 ? "front" : "leaf",
  angle: -fanAngle(i / (COUNT - 1)),
  depth: i * SHEET_DEPTH,
}));

/**
 * How far the pointer travels to open the book in cursor mode, in book widths,
 * measured left from the shut book's fore-edge.
 *
 * The cover's own free edge crosses a little under two book widths on its way
 * round, so at 1.6 the hand runs slightly ahead of the paper rather than
 * dragging behind it, and full open lands inside the stage with a margin to
 * spare at 375px.
 */
export const PULL = 1.6;

/** where the shut book's fore-edge sits, as a share of the stage's width */
export const FORE_EDGE = 0.5 + BOOK_WIDTH / 2;

/**
 * Where sheet i lands, in degrees, for i as a share of the stack.
 *
 * The lerp is of the sheet's own fore-edge and not of its angle, and this is the
 * one place in the file worth reading twice. Even angles are not even paper: a
 * sheet's free end is at `cos(angle)` of the way out, and cosine is flat where
 * the fan is flat, so the sheet 13 degrees off the back board hides all but 4px
 * of it while the pair standing either side of vertical are 23px apart. Spacing
 * the fore-edges instead and taking the angle back out with `acos` shows the
 * same strip of every sheet in the stack.
 *
 * What it costs is the two ends: the boards end up 32 and 22 degrees clear of
 * their neighbours where the middle steps are 9, because that is what an even
 * spread of paper actually looks like. Pages near the covers lie down and the
 * ones at the middle stand up.
 */
function fanAngle(u: number): number {
  const reach = Math.cos((SPREAD * Math.PI) / 180);
  return (Math.acos(lerp(1, reach, u)) * 180) / Math.PI;
}
