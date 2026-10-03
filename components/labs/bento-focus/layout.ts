/**
 * The bento's geometry, in stage pixels. Pure and DOM-free, the split
 * `document-pocket` makes with `poses.ts`.
 *
 * Five slots: the focus slot on the left, full height, and a two by two block
 * on the right whose rows are offset, a wide slot and a narrow one on top and
 * the narrow one first underneath. So no two of the four small slots are the
 * same shape as their neighbour, which is what makes a tile re-settling into
 * one read as it changing shape rather than only changing place.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Bento {
  /** the focus slot first, then the four small ones in reading order */
  slots: readonly Rect[];
  /** where a tile's label and the focus slot's text sit, from its corner */
  inset: number;
  radius: number;
}

/**
 * A narrow slot is one unit across and a wide one two. On a compact stage the
 * wide slot takes one and a half: at two, the narrow slot is 50px across and
 * cuts "precision" off at its label's smallest size. At one and a half it still
 * did once the gaps widened, so it is 1.4.
 */
const NARROW = 1;
const wideUnits = (width: number) => (width < COMPACT ? 1.4 : 2);

/** under this the stage is a phone, see `heroShare` */
const COMPACT = 448;

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

/**
 * The focus slot takes a larger share of a narrow stage. At the column's share
 * on a 352px stage it is 125px wide, and the copy under its title runs to six
 * lines of a few words each.
 */
const heroShare = (width: number) => (width < COMPACT ? 0.46 : 0.4);

export function bento(width: number, height: number): Bento {
  // the room round the grid is wider than the gaps inside it, so the five
  // tiles read as one object on the stage rather than filling it
  const pad = Math.round(clamp(width * 0.07, 20, 40));
  const gap = Math.round(clamp(width * 0.024, 7, 14));
  const inner = { w: width - pad * 2, h: height - pad * 2 };

  const heroW = Math.round(inner.w * heroShare(width));
  const right = inner.w - heroW - gap;
  const wide = wideUnits(width);
  const unit = (right - gap) / (wide + NARROW);
  const rowH = (inner.h - gap) / 2;

  const left = pad + heroW + gap;
  const top = pad;
  const bottom = pad + rowH + gap;

  return {
    slots: [
      { x: pad, y: pad, w: heroW, h: inner.h },
      { x: left, y: top, w: unit * wide, h: rowH },
      { x: left + unit * wide + gap, y: top, w: unit * NARROW, h: rowH },
      { x: left, y: bottom, w: unit * NARROW, h: rowH },
      { x: left + unit * NARROW + gap, y: bottom, w: unit * wide, h: rowH },
    ],
    inset: Math.round(clamp(width * 0.028, 8, 16)),
    radius: Math.round(clamp(width * 0.022, 6, 12)),
  };
}

/**
 * Which slot each tile takes: the focused tile has the focus slot and the rest
 * fill the small ones in their own order, so the arrangement is a function of
 * one index and a tile never has to remember where it was.
 */
export function assign(count: number, focus: number): number[] {
  let next = 1;
  return Array.from({ length: count }, (_, i) => (i === focus ? 0 : next++));
}

/** how far a tile's centre travels between two rects */
export function travel(from: Rect, to: Rect): number {
  return Math.hypot(
    to.x + to.w / 2 - (from.x + from.w / 2),
    to.y + to.h / 2 - (from.y + from.h / 2),
  );
}
