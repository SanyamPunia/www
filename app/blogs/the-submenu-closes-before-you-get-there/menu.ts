/**
 * The geometry of two menus, and the corridor between them.
 *
 * Every number here is a real pixel, and the layout is drawn from the same ones
 * the hit tests use. That matters more than usual: the whole post is about which
 * region the pointer is in, so a row's box and a row's hit region cannot be
 * allowed to disagree.
 */

export const ROW_H = 32;
export const MENU_W = 144;
/** the menus' own padding, above the first row and below the last */
export const PAD = 5;
/**
 * Nothing between the two menus.
 *
 * A gap is what a first build puts here and it makes the naive rule unbeatable:
 * a pointer crossing the gap is over neither menu, so the submenu closes on a
 * straight sideways move as well as on a diagonal. Flush is also what most real
 * menus do, and it leaves the sideways move working, which matters. Going
 * sideways first is the habit everyone has quietly built to cope with this bug,
 * and the demo has to let the reader use it.
 */
export const GAP = 0;

export interface Item {
  label: string;
  children?: readonly string[];
}

/**
 * One item opens a submenu, and the submenu is longer than the menu that opens
 * it. That is the whole setup: reaching the last child means a diagonal across
 * three rows of the parent, which is the move that breaks.
 */
export const ITEMS: readonly Item[] = [
  { label: "Rename" },
  { label: "Duplicate" },
  {
    label: "Move to",
    /*
     * Five, not seven. The submenu has to be long enough that its last row
     * needs a diagonal, and no longer: at seven it stood 96px below the menu
     * that opened it, and since the block reserves that height whether or not
     * the submenu is open, every closed frame carried a third of itself as
     * empty grey. Five still drops 130px over 144px of travel, which is steeper
     * than 45 degrees and leaves the parent row well before the pointer arrives.
     */
    children: ["Inbox", "Archive", "Drafts", "Starred", "Trash"],
  },
  { label: "Copy link" },
  { label: "Add label" },
  { label: "Delete" },
];

/** the row that opens the submenu */
export const PARENT = ITEMS.findIndex((item) => item.children);
export const CHILDREN = ITEMS[PARENT]?.children ?? [];
/** the row the reader is asked to reach, which is the furthest one */
export const TARGET = CHILDREN.length - 1;

export const MENU_H = ITEMS.length * ROW_H + PAD * 2;
export const SUB_H = CHILDREN.length * ROW_H + PAD * 2;

/**
 * The submenu's first row lines up with the row that opened it, which is what
 * every menu does. It is also why the corridor is a triangle and not a
 * rectangle: the pointer starts level with the top of the submenu, and almost
 * all of the submenu is below that line.
 */
export const SUB_X = MENU_W + GAP;
export const SUB_Y = PARENT * ROW_H;

/** the block both menus occupy, which the stage centres */
export const BLOCK_W = SUB_X + MENU_W;
export const BLOCK_H = Math.max(MENU_H, SUB_Y + SUB_H);

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The corridor: where the pointer left the row, and the near edge of the
 * submenu it is heading for.
 */
export interface Grace {
  from: Point;
  top: Point;
  bottom: Point;
}

export function graceFrom(exit: Point, sub: Rect): Grace {
  return {
    from: exit,
    top: { x: sub.x, y: sub.y },
    bottom: { x: sub.x, y: sub.y + sub.h },
  };
}

const side = (a: Point, b: Point, p: Point) =>
  (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);

/**
 * Inside the triangle, by the sign of the three edge cross products.
 *
 * All three agreeing means the point is on the same side of every edge, which
 * for a triangle is the inside. Winding order does not matter, so this takes the
 * corners in whatever order they were built in.
 */
export function inGrace(p: Point, g: Grace): boolean {
  const a = side(g.from, g.top, p);
  const b = side(g.top, g.bottom, p);
  const c = side(g.bottom, g.from, p);
  return (a >= 0 && b >= 0 && c >= 0) || (a <= 0 && b <= 0 && c <= 0);
}

export function inRect(p: Point, r: Rect): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

/**
 * Which row of a menu a point is over, or null for the padding and for outside.
 *
 * The padding belongs to no row. A pointer in the five pixels above the first
 * item is not on that item, and a menu that pretends otherwise highlights a row
 * nobody is pointing at.
 */
export function rowAt(p: Point, menu: Rect, rows: number): number | null {
  if (!inRect(p, menu)) return null;
  const row = Math.floor((p.y - menu.y - PAD) / ROW_H);
  return row >= 0 && row < rows ? row : null;
}

/**
 * Every parent row a recorded path passed over, except the one that opened the
 * submenu.
 *
 * These are the hovers the menu believed. Marking them all at once is the
 * clearest thing in the piece: the reader sees five rows lit and understands
 * immediately that the menu was told about every one of them.
 */
export function crossedRows(trail: Point[], menu: Rect): number[] {
  const hit = new Set<number>();
  for (const p of trail) {
    const row = rowAt(p, menu, ITEMS.length);
    if (row !== null && row !== PARENT) hit.add(row);
  }
  return [...hit].sort((a, b) => a - b);
}
