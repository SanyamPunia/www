/*
 * Where the composer and a comment's pill sit relative to their box. Pure, in
 * stage pixels, so the placement is arithmetic rather than a measurement.
 *
 * Both are fixed heights in rem, which is what makes that possible: a composer
 * that sized itself to its text would have to be measured before it could be
 * placed, and the side it lands on decides which way its entrance travels, so
 * that measurement would land a frame after the animation had already started.
 */

/** a box as shares of the stage, so it holds its place at every width */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const REM = 16;

/** `w-72` and `h-30` on the 0.2rem spacing scale */
export const COMPOSER_W = 14.4 * REM;
export const COMPOSER_H = 6 * REM;
/** `h-7` */
export const PILL_H = 1.4 * REM;

/** clear stage kept between anything placed here and the frame */
const EDGE = 8;
/** the gap between a box and what hangs under it */
const GAP = 8;

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(Math.max(v, lo), Math.max(lo, hi));

export interface Placed {
  left: number;
  top: number;
  width: number;
  /**
   * Which side of the box it landed on. The entrance travels away from the box,
   * so it reads as coming out of it rather than arriving from somewhere else.
   */
  side: "below" | "above" | "over";
}

/**
 * Below the box, the way the reference hangs it, then above it, and on a stage
 * too short for either it sits over the box's foot. It never leaves the stage,
 * since the stage is a frame on a page and a composer hanging past it lands on
 * the prose underneath.
 */
export function placeComposer(r: Rect, W: number, H: number): Placed {
  const width = Math.min(COMPOSER_W, W - EDGE * 2);
  const left = clamp(r.x * W, EDGE, W - width - EDGE);
  const bottom = (r.y + r.h) * H;

  const below = bottom + GAP;
  if (below + COMPOSER_H <= H - EDGE)
    return { left, top: below, width, side: "below" };

  const above = r.y * H - GAP - COMPOSER_H;
  if (above >= EDGE) return { left, top: above, width, side: "above" };

  return {
    left,
    top: clamp(bottom - COMPOSER_H - GAP, EDGE, H - COMPOSER_H - EDGE),
    width,
    side: "over",
  };
}

/**
 * Under the box's left edge, or tucked inside its foot when the box runs to the
 * bottom of the stage. The pill is no wider than its box, with a floor of 9rem
 * or 28% of the stage, whichever is less, so a sliver of a box still names a
 * few words, which is what keeps two pills from
 * running into each other on a narrow stage. It is also capped by the room to
 * its right, so a box near the right edge truncates rather than overflowing.
 */
export function placePill(r: Rect, W: number, H: number) {
  const bottom = (r.y + r.h) * H;
  const inside = bottom + 6 + PILL_H > H - 6;
  const left = r.x * W + (inside ? 6 : 0);
  return {
    left,
    top: inside ? bottom - PILL_H - 6 : bottom + 6,
    maxWidth: Math.max(
      0,
      Math.min(
        12 * REM,
        W - left - EDGE,
        Math.max(r.w * W, Math.min(9 * REM, W * 0.28)),
      ),
    ),
  };
}
