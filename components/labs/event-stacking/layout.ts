/*
 * The grid, and the maths that turns a pile of events into boxes.
 *
 * Pure geometry, in the units the DOM takes: percentages across, since the day
 * columns divide the width evenly and the demo is fluid, and pixels down, since
 * an hour row is a fixed height. Nothing here reads the DOM or React.
 */

export interface Day {
  label: string;
  date: number;
}

/**
 * Four days rather than a full week.
 *
 * The column is 537.6px wide, so five days give a 98px card and four give
 * 122px, and a card carries a time and a title. The fifth column is paid for
 * out of the titles, and a four-day view is a real calendar view.
 */
export const DAYS: Day[] = [
  { label: "Mon", date: 12 },
  { label: "Tue", date: 13 },
  { label: "Wed", date: 14 },
  { label: "Thu", date: 15 },
];

/** the one day marked, the same filled pill a calendar puts on today */
export const TODAY = 3;

export const HOURS = [9, 10, 11, 12];

/** an hour row, in px */
export const ROW = 76;
/** the inset between a card and its cell, on all four sides */
export const GAP = 3;
/**
 * How much of a card shows below the one above it in a stack.
 *
 * This is what makes a stack legible: the sliver of colour under the top card
 * is the only thing saying anything is under there.
 */
export const PEEK = 7;
/**
 * The same, for a pile held as one object by a long press.
 *
 * Tighter, so the cards clamp together and the pile reads as a single thing
 * rather than as a fan. The pile still fills its cell exactly whatever this is:
 * the deepest card sits at `(count - 1) * peek` and every card is `room - (count
 * - 1) * peek` tall, so the two cancel. A smaller peek buys height, which is why
 * a held pile also looks more solid than a resting one.
 */
export const HOLD_PEEK = 3;
/**
 * The shortest a card is allowed to get.
 *
 * A card's content is two lines of `text-meta` plus its padding, which is 48px,
 * so this is the floor at which nothing has to be clipped. The stack has to fit
 * its cell, so past three cards the peek gives way instead of the height: see
 * `place`.
 */
const MIN_HEIGHT = 50;

export interface Box {
  left: string;
  width: string;
  top: number;
  height: number;
}

const COLUMN = 100 / DAYS.length;

/**
 * Where one card in a stack sits.
 *
 * `depth` counts down from the top of the pile, so 0 is the card you see whole
 * and `count - 1` is the one showing a sliver at the bottom. Every member gets
 * the same height, and the stack as a whole is exactly its cell: the deepest
 * card's bottom edge lands on the cell's own inset.
 *
 * **The peek shrinks before the height does.** A card loses `PEEK` for every
 * card above it, which is 70px alone, 63px in a pair and 56px in a three, and a
 * fourth would take it under the height its own content needs. So past that the
 * peeks share out whatever room is left rather than the cards getting shorter,
 * and a pile of six is still six readable cards. Clipping the content instead
 * would mean a stack whose cards stop saying what they are, which is the one
 * thing the stack exists to show.
 */
export function place(
  day: number,
  slot: number,
  depth: number,
  count: number,
  held = false,
): Box {
  const room = ROW - GAP * 2;
  const ceiling = held ? HOLD_PEEK : PEEK;
  const peek =
    count > 1 ? Math.min(ceiling, (room - MIN_HEIGHT) / (count - 1)) : 0;

  return {
    left: `calc(${day * COLUMN}% + ${GAP}px)`,
    width: `calc(${COLUMN}% - ${GAP * 2}px)`,
    top: slot * ROW + GAP + depth * peek,
    height: room - peek * (count - 1),
  };
}

/**
 * How far a card may be dragged from its own cell, as the numeric offsets
 * Motion's `dragConstraints` takes.
 *
 * **Numeric, and never the grid's own ref, and that is not a preference.** Ref
 * constraints put a `ResizeObserver` on the *draggable element*, and every card
 * here changes height whenever a pile it belongs to gains or loses a member. Each
 * of those resizes calls `scalePositionWithinConstraints`, which stops whatever
 * animation is running and rewrites `x` and `y` to hold the card's old progress
 * within the freshly measured box. Two things follow, and both were measured. A
 * drop that changes a card's height loses its return to origin part way through
 * and leaves the card sitting at most of its drag offset. And a card at rest
 * takes a permanent few pixels of transform every time its height changes,
 * because a shorter card has a larger bottom constraint and the same progress
 * inside it lands somewhere else.
 *
 * A plain object skips all of it: `isRefObject` gates both the observer and the
 * rewrite, so numeric constraints are the version that does nothing but clamp.
 */
export function limits(day: number, box: Box, width: number) {
  const column = width / DAYS.length;
  const left = day * column + GAP;

  return {
    left: -left,
    right: width - left - (column - GAP * 2),
    top: -box.top,
    bottom: ROW * HOURS.length - box.top - box.height,
  };
}

/**
 * The box a whole pile occupies, which is its cell inset by the gap.
 *
 * A pile always fills its cell, so this is `place` for a single card. It is what
 * bounds a held pile's drag: the leader's own box is a subset of it, and
 * constraining that instead would let the cards below it leave the grid.
 */
export function cellBox(day: number, slot: number): Box {
  return place(day, slot, 0, 1);
}

/** the gutter's label for a row: "9 AM", "12 PM". The stylesheet lowercases it. */
export function hourLabel(slot: number): string {
  const hour = HOURS[slot];
  return `${hour} ${hour < 12 ? "AM" : "PM"}`;
}

/** a card's own line: "9:00 AM". Derived from the slot, never stored. */
export function timeLabel(slot: number): string {
  const hour = HOURS[slot];
  return `${hour}:00 ${hour < 12 ? "AM" : "PM"}`;
}

/** "Thu 12:00 PM", the label a card carries while it is in the air */
export function cellLabel(day: number, slot: number): string {
  return `${DAYS[day].label} ${timeLabel(slot)}`;
}

export function clamp(value: number, max: number): number {
  return Math.max(0, Math.min(max, value));
}

/** the grid's own origin and column width, in page coordinates */
export interface Bounds {
  left: number;
  top: number;
  column: number;
}

export interface Cell {
  day: number;
  slot: number;
}

/**
 * Which cell a pointer is over.
 *
 * Motion reports a gesture's point in **page** coordinates, off `pageX` and
 * `pageY`, where `getBoundingClientRect` is in viewport coordinates. So the
 * bounds this is given have the page scroll added in once, at the start of the
 * gesture, rather than being corrected here every frame.
 *
 * Clamped, because `dragConstraints` holds the card's box inside the grid but
 * nothing holds the pointer there: grab a card by its left edge, drag right, and
 * the box stops at the last column while the pointer carries on off the grid.
 */
export function cellFrom(
  point: { x: number; y: number },
  bounds: Bounds,
): Cell {
  return {
    day: clamp(
      Math.floor((point.x - bounds.left) / bounds.column),
      DAYS.length - 1,
    ),
    slot: clamp(Math.floor((point.y - bounds.top) / ROW), HOURS.length - 1),
  };
}
