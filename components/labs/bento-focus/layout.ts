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
 * Which tile sits in which slot is an order, `order[slot] = tile`, and the
 * focus slot is `order[0]`. It is a list rather than a function of one index
 * because a drag can put a tile in a slot the arithmetic would never pick.
 */
export type Order = readonly number[];

export const initialOrder = (count: number): Order =>
  Array.from({ length: count }, (_, i) => i);

/**
 * A press, or a tile dragged into the focus slot. The tile that had the slot
 * takes the first small slot, beside it, and the tiles between move along one
 * to close the gap, so the grid reads as a list of what was looked at last and
 * every tile re-settles into a slot of a different shape.
 */
export function promote(order: Order, tile: number): Order {
  if (order[0] === tile) return order;
  return [tile, order[0], ...order.slice(1).filter((t) => t !== tile)];
}

/**
 * The focus tile dragged out onto a small slot. It lands where it was put and
 * the tile that was there takes the focus slot. Nothing else moves, since the
 * hand placed this tile and nothing else.
 */
export function swapIn(order: Order, slot: number): Order {
  const next = [...order];
  [next[0], next[slot]] = [next[slot], next[0]];
  return next;
}

/** each tile's rect under an order */
export function rects(grid: Bento, order: Order): Rect[] {
  const out: Rect[] = [];
  order.forEach((tile, slot) => {
    out[tile] = grid.slots[slot];
  });
  return out;
}

export const centre = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

export function lerpRect(a: Rect, b: Rect, t: number): Rect {
  const m = (p: number, q: number) => p + (q - p) * t;
  return { x: m(a.x, b.x), y: m(a.y, b.y), w: m(a.w, b.w), h: m(a.h, b.h) };
}

/**
 * The slot a pointer is over, against the resting slots and never the moving
 * boxes, each grown by half a gap so the gaps belong to the nearer slot. A
 * hovered tile grows, so testing the boxes would let the hover move the edge
 * that decides it, which is the loop `document-pocket` documents.
 */
export function slotAt(grid: Bento, x: number, y: number): number {
  const gap = grid.slots[1].x - (grid.slots[0].x + grid.slots[0].w);
  const half = gap / 2;
  return grid.slots.findIndex(
    (r) =>
      x >= r.x - half &&
      x <= r.x + r.w + half &&
      y >= r.y - half &&
      y <= r.y + r.h + half,
  );
}

/**
 * The slot an arrow key moves to from `from`: the nearest centre in that
 * direction, with distance off the axis costing double, so right from the focus
 * slot picks the slot level with it before one diagonally away.
 */
export function slotToward(
  grid: Bento,
  from: number,
  dx: number,
  dy: number,
): number {
  const a = centre(grid.slots[from]);
  let best = -1;
  let score = Number.POSITIVE_INFINITY;
  grid.slots.forEach((r, i) => {
    if (i === from) return;
    const c = centre(r);
    const along = (c.x - a.x) * dx + (c.y - a.y) * dy;
    if (along <= 1) return;
    const across = Math.abs((c.x - a.x) * dy - (c.y - a.y) * dx);
    const s = along + across * 2;
    if (s < score) {
      score = s;
      best = i;
    }
  });
  return best;
}

/** how far a tile's centre travels between two rects */
export function travel(from: Rect, to: Rect): number {
  return Math.hypot(
    to.x + to.w / 2 - (from.x + from.w / 2),
    to.y + to.h / 2 - (from.y + from.h / 2),
  );
}
