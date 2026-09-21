"use client";

import { motion, useReducedMotion } from "motion/react";
import type React from "react";

/**
 * The mark on a copy control, morphing between its idle glyph and a tick.
 *
 * Both copy controls on a post used to crossfade: an `AnimatePresence` in
 * `mode="wait"` swapping one Phosphor icon out and the other in over 150ms.
 * That is a dissolve, and at 12px a dissolve between two line drawings reads as
 * the icon going briefly out of focus rather than as one shape becoming
 * another. This is the shape becoming the other shape.
 *
 * **It is a real path morph and it is why the glyphs are drawn here rather than
 * imported.** Motion interpolates the numbers inside a string when the parts
 * between them match, so two `d` values morph only if they carry the same
 * commands in the same order. Phosphor's icons are filled outlines with no
 * relationship to each other, so no pair of them satisfies that. These are
 * polylines written by `path` below, which guarantees the structure by
 * construction: a glyph is a list of subpaths, a subpath is a list of points,
 * and its partner is the same shape of list holding different numbers. The
 * project's "library icons only" rule is about a text character standing in for
 * an icon, and this is the same call `island-menu` makes for its own drawn box,
 * which is that nothing off the shelf can express the in-between.
 *
 * **The tick is written once per pair rather than once.** A glyph's partner has
 * to match its own structure, so the copy mark's tick is five points and two
 * subpaths where the hash mark's is eight points and four, and both draw the
 * same three-point tick with the leftovers folded onto it. Drawing a line twice
 * costs nothing, since the second copy lands exactly on the first.
 */

type Point = readonly [number, number];

/**
 * A `d` from subpaths of points, in one format, so any two of these
 * interpolate.
 *
 * Every number goes through the same separators, which is the whole contract:
 * Motion compares what is left after the numbers are pulled out and refuses the
 * animation if the two do not agree.
 */
function path(...subpaths: readonly (readonly Point[])[]): string {
  return subpaths
    .map((points) =>
      points.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(""),
    )
    .join("");
}

/** The tick every mark lands on, in the 24 unit box all of them are drawn in. */
const START: Point = [4.5, 13];
const ELBOW: Point = [9.5, 18];
const TIP: Point = [19.5, 6.5];

/**
 * Two overlapping pages: the front one as a closed loop that comes back to its
 * own first corner, and the back one as the L of it that shows.
 *
 * **Which point goes where is the whole of whether the middle is legible, and
 * it is solved rather than chosen.** A path's points can only land on a walk
 * along the tick, since consecutive points draw a segment and the only segments
 * that exist are its two arms. Of the walks available, this is the one with the
 * least total travel: measured in the 24 unit box, 32 units against the 61 of
 * the first mapping, which sent the square's bottom-left corner clean across
 * the icon and crossed its own strokes on the way. The square's right edge
 * becomes the long arm, its left edge becomes the short one, and its top and
 * bottom edges collapse, so what the eye sees is a square being squeezed flat
 * rather than a scribble. The back page's L travels 22 units and barely moves
 * at all: its own corner is already near the tick's elbow.
 */
const COPY = path(
  [
    [8.5, 8.5],
    [20, 8.5],
    [20, 20],
    [8.5, 20],
    [8.5, 8.5],
  ],
  [
    [15.5, 4],
    [4, 4],
    [4, 15.5],
  ],
);

const COPY_DONE = path([TIP, TIP, ELBOW, ELBOW, START], [TIP, ELBOW, START]);

/**
 * Four strokes, two leaning verticals and two horizontals, which is what a hash
 * is. Each one is two points, so each lands on one arm of the tick and the
 * morph is four lines turning into two.
 *
 * Which stroke takes which arm, and in which direction, is the same solve as
 * the copy mark's: 48 units of travel against the 76 of pairing them off in
 * order. A stroke may run either way along its arm, since round caps make a
 * line and its reverse the same drawing.
 */
const HASH = path(
  [
    [9.5, 4],
    [7.5, 20],
  ],
  [
    [16.5, 4],
    [14.5, 20],
  ],
  [
    [4.5, 9],
    [20, 9],
  ],
  [
    [4, 15],
    [19.5, 15],
  ],
);

const HASH_DONE = path(
  [START, ELBOW],
  [TIP, ELBOW],
  [ELBOW, TIP],
  [START, ELBOW],
);

const MARKS = {
  copy: { idle: COPY, done: COPY_DONE },
  hash: { idle: HASH, done: HASH_DONE },
} as const;

/**
 * 280ms on `island-menu`'s curve, and both numbers are about spending time in
 * the middle rather than answering quickly.
 *
 * The crossfade this replaces ran 150ms, which is right for a dissolve and too
 * short to watch a shape travel. `book-opening`'s `[0.32, 0.72, 0, 1]` was the
 * first pick, since that is the curve `torph` is handed everywhere else, and it
 * leaves at over twice its own average speed: sampled per frame at 240ms, the
 * fold was over by 120 and the three frames anyone could read were the first
 * three. The whole point of a morph is the shape between the two shapes.
 *
 * This curve leaves at zero instead, which `island-menu` warns about for a box
 * answering input, and that warning was measured on a 520ms move where it cost
 * five still frames. At 280ms the same curve is 19% of the way through by 80ms,
 * and the press has already been answered by the control's own tone.
 */
const MORPH = { duration: 0.28, ease: [0.4, 0, 0.2, 1] } as const;

/**
 * Reduced motion is read here rather than left to `MotionProvider`. Its
 * `reducedMotion="user"` governs transforms and layout, and `d` is neither, so
 * the morph would still run. The state is kept and only the travel goes, which
 * is the line every other component in this project draws.
 */
export function CopyMark({
  mark,
  copied,
}: {
  mark: keyof typeof MARKS;
  copied: boolean;
}): React.ReactNode {
  const reduce = useReducedMotion();
  const { idle, done } = MARKS[mark];

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      className="size-3.75"
    >
      <motion.path
        d={idle}
        initial={false}
        animate={{ d: copied ? done : idle }}
        transition={reduce ? { duration: 0 } : MORPH}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
