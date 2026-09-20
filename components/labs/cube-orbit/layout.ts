/**
 * Where the two drawings sit, in stage units.
 *
 * The stage is `aspect-8/5` and the drawing is one SVG filling it, so the whole
 * picture scales as one thing and nothing inside is measured in JS. The words
 * stay out of it, since text that scales with the box is 7px on a phone and a
 * sentence has to hold its size.
 *
 * **The viewBox is exactly 8:5 and not the column's own 538 by 336.** Those two
 * are 1.60119 and 1.6, so a viewBox of the measured column letterboxes the
 * drawing by a quarter of a pixel and puts an offset between a pointer's place
 * on the box and its place in the drawing. 536 by 335 is the same size to
 * within a pixel and divides exactly.
 */

export const STAGE = { w: 536, h: 335 } as const;

/**
 * The dial: concentric rings, the largest cycle outermost, inside one arc that
 * fills over a lap.
 *
 * **The arc is the scale the count has no other way to get.** A number running
 * from 0 to 1260 says nothing about how far along it is, and a reader mid-run
 * wants to know how much longer rather than what the total was. It sits a clear
 * 12 units outside the outermost ring and is drawn at more than twice their
 * width, so seven concentric circles still read as one arc around six tracks.
 */
export const DIAL = {
  cx: 377,
  cy: 167.5,
  /** the outermost ring and the innermost, whatever the count between them */
  outer: 93,
  inner: 40,
  /** the lap arc, and the caret that marks where a lap starts and ends */
  arc: 109,
  caret: 115,
  /** the band between the rings and the arc, where the lap's own marks sit */
  tick: { base: 97, min: 3, max: 6 },
  /** a dot never grows past this, however much room its ring is given */
  dot: 5,
} as const;

/**
 * The rings are spread between a fixed outside and a fixed inside, so the room
 * each one gets is whatever its own count leaves it.
 *
 * **A fixed step was the first build and it made every dial as dense as the
 * densest sequence.** The four presets carry four, four, four and six cycles,
 * and 1260 is the only one that needs six: no sequence of turns reaches the
 * largest order in the cube group with fewer, which a search over every
 * sequence up to four turns confirms, where the best a four-ring one manages is
 * 420. So the three roomy cases were paying for the one crowded one. Spread
 * between two fixed radii instead, a four-ring dial gets 18.7 units a ring
 * against the six-ring dial's 11.2, and the hole in the middle is always the
 * same size, so the count always has room whatever is around it.
 */
export const spacingFor = (count: number): number =>
  count > 1 ? (DIAL.outer - DIAL.inner) / (count - 1) : 0;

/** A dot takes a third of its ring's room, capped, so a dense dial has small
 * nodes and a sparse one has full-size ones. */
export const dotFor = (count: number): number =>
  count > 1 ? Math.min(DIAL.dot, spacingFor(count) * 0.34) : DIAL.dot;

/**
 * The cube, which is the net and the net is the cube.
 *
 * **It is one object folded by one number.** `--fold` runs 0 to 1, and it
 * drives the five hinges, the angle the whole thing is seen from and how much
 * bigger it gets on the way up, so a cross of six faces and a cube are two
 * readings of the same markup rather than two drawings that have to agree.
 * That is `book-opening`'s `--book-open` and `window-shade`'s `--shade`, one
 * level up: there one property carried fourteen transforms, here it carries
 * eight and the camera.
 *
 * **Which is what lets a drawing of a cube show all six faces.** A cube hides
 * three of them, and the whole question this demo asks is whether all six are
 * home, so the folded state is what it looks like and the flat state is what it
 * says. Neither has to be given up.
 *
 * The faces hang off each other the way the paper does: everything is a child
 * of the front, except the back, which is a child of the right. So a hinge is
 * one rotation about the edge two faces already share, and nothing here
 * computes a position.
 */
export const CUBE = {
  /** one face, in stage units */
  block: 46,
  /** where the folded cube sits */
  cx: 133,
  cy: DIAL.cy,
  /**
   * How much bigger the object gets as it folds.
   *
   * Flat it is four faces wide and folded it is about one and a half, so
   * without this the cube is a third of the drawing it came from and reads as
   * having been put away rather than assembled.
   *
   * **It is free to overrun the net's own box, because the caption is the only
   * thing under it and the caption only ever shows while the cube is flat.**
   * At 1.2 the folded cube measured 159 units of ink against the net's 208,
   * which left 52 of margin on its left against 34 on the dial's right and read
   * as a small object pushed into a corner. 1.65 lands it on the same footprint
   * as its own net, so the stage's margins come out even.
   */
  grow: 1.65,
  /**
   * The angle a folded cube is seen from, which is where three faces show.
   *
   * At -24 and -32 the right face came out a sliver against a front face doing
   * most of the work, which is a cube seen almost head on. A few degrees more
   * of each gives the three faces closer to equal shares, which is the view
   * every photograph of a cube is taken from.
   */
  view: { x: -27, y: -37 },
} as const;

/** The net is four faces across and three down, and the box holds both states. */
export const CUBE_BOX = {
  w: CUBE.block * 4,
  h: CUBE.block * 3,
} as const;

/**
 * The line that names the ring under the pointer, directly under the cube.
 *
 * It sat in the stage's bottom left corner to start with, which put it 68 units
 * below the thing it describes and aligned to the stage rather than to it, so
 * it read as a footnote on the demo instead of a label on the cube. Under the
 * cube and centred on it, it is a caption.
 */
export const NOTE = {
  top: CUBE.cy + CUBE_BOX.h / 2 + 20,
  /**
   * A little wider than the cube it sits under, which is what keeps it to one
   * line. A caption may be wider than its figure. What it may not be is two
   * lines with one word alone on the second.
   */
  w: CUBE_BOX.w + 40,
} as const;

/**
 * The faces, in the order `cube.ts` numbers them: U R F D L B.
 *
 * `side` is the edge the face hangs from in its parent's box, `origin` the
 * hinge on its own, and `deg` the rotation that closes it. The front has none
 * of them, and the back is the only face nested inside another.
 *
 * **`shade` is light and not palette**, which is the rule this project sets for
 * anything on an `inverse-*` ground: white and black at low alpha over the
 * face's own colour, never a second fill. It is positive for a lit face and
 * negative for one turned away, and it fades out with the fold, since a flat
 * net is six faces all pointing the same way and has no light to catch.
 */
export const FACES = [
  {
    key: "U",
    side: "bottom",
    origin: "50% 100%",
    axis: "X",
    deg: 90,
    shade: 0.1,
  },
  {
    key: "R",
    side: "left",
    origin: "0% 50%",
    axis: "Y",
    deg: 90,
    shade: -0.16,
  },
  { key: "F", side: null, origin: "50% 50%", axis: "Y", deg: 0, shade: 0 },
  {
    key: "D",
    side: "top",
    origin: "50% 0%",
    axis: "X",
    deg: -90,
    shade: -0.22,
  },
  {
    key: "L",
    side: "right",
    origin: "100% 50%",
    axis: "Y",
    deg: -90,
    shade: -0.2,
  },
  {
    key: "B",
    side: "left",
    origin: "0% 50%",
    axis: "Y",
    deg: 90,
    shade: -0.26,
  },
] as const;

/** A ring's radius, counting outward-in, largest cycle first. */
export const radiusAt = (index: number, count: number): number =>
  DIAL.outer - index * spacingFor(count);

/** Where a ring's `j`th slot sits, with slot 0 at the index line. */
export function nodeAt(
  radius: number,
  j: number,
  length: number,
): { x: number; y: number } {
  const angle = ((-90 + (j * 360) / length) * Math.PI) / 180;
  return {
    x: DIAL.cx + radius * Math.cos(angle),
    y: DIAL.cy + radius * Math.sin(angle),
  };
}
