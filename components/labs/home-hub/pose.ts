/**
 * Where a hub stands, as a pure function of its seat at the table.
 *
 * The hubs sit round a table like a council, every screen facing out from
 * its centre, and the table is seen from above at `PITCH`. A hub's seat is a
 * float `o`, its offset from the front seat, which faces the reader. Every
 * number the stage draws comes off `o` and one more float, `fan`, which runs
 * from 0, with every hub gathered in the middle of the table, to 1, with them
 * in their seats. So a drag, a press, a throw and the opening are all the same
 * two numbers moving.
 */

/** the stage's design space, scaled to fit the frame as one */
export const STAGE_W = 538;
export const STAGE_H = 336;
export const PERSPECTIVE = 900;

/**
 * The table's centre on the stage, how far round it the hubs sit, and its
 * rim. The ring is pushed back by its own radius, so the front seat stands on
 * the stage's own plane and the front hub is drawn at its own size.
 */
export const RING_X = STAGE_W / 2;
export const RING_Y = 222;
export const RING_R = 260;
/**
 * How far the view looks down onto the table, in degrees. Nearly eye level,
 * as in the reference. At 8 the hubs stacked behind the front one rose above
 * its top, and the table read as a plate the hub sat on.
 */
export const PITCH = 3;
/** where the front hub's screen sits on the stage, which the zoom holds still */
export const FOCUS_Y = 184;

/** the screen, at a scale of 1 */
export const SCREEN_W = 132;
export const SCREEN_H = 122;
export const SCREEN_R = 22;
/** the slab's thickness, drawn as stacked layers */
export const DEPTH = 9;
export const LAYERS = 7;

/** the dome: a half sphere on a short cylinder, with a speaker band */
export const DOME_R = 34;
export const DOME_H = 78;
export const MESH_H = 26;

/** the screen's foot sits just above the speaker band */
export const SCREEN_TOP = -(MESH_H + 6 + SCREEN_H);
/**
 * The screen hinges in front of the dome's upper left, half a radius above the
 * half sphere's centre, where the reference's neck goes in. At the centre
 * itself the neck went into the cylinder and the hub read as squat.
 */
export const PIVOT_Y = -(DOME_H - DOME_R) - DOME_R / 2;
export const OFFSET = 48;
/** how far the screen leans back at rest, in degrees, measured off the
    reference's profile */
export const TILT = 18;
/** the metal neck from the screen's back into the dome */
export const NECK = 16;

export const COUNT = 5;
/** each hub is drawn twice, so the arc runs on with no end */
export const COPIES = COUNT * 2;
/** a copy past this offset is off the stage and not drawn */
export const VISIBLE = 2.6;
/** degrees between two seats on the front of the table */
export const STEP = 27;

export interface Seat {
  /** degrees round the table, 0 the front seat nearest the reader */
  angle: number;
  /** the distance from the table's centre */
  r: number;
  s: number;
}

const lerp = (a: number, b: number, t: number) => a * (1 - t) + b * t;

/**
 * Where a seat is round the table, for an offset `k` from the front seat. The
 * five seats sit on the front of the table, `STEP` apart, as in the
 * reference. Past the last seat a hub carries on round the table and slides
 * out past the stage's edge, while its copy slides in at the other end, so a
 * turn is one continuous run with no hub walking round the back.
 */
function around(k: number): number {
  return k * STEP;
}

/** how far past the last seat a hub slides out, per seat, off the stage */
const EXIT = 300;

/**
 * Gathered, every hub stands just behind the front one. `peek` takes them
 * from wholly hidden behind it to a few degrees either side, so the edges
 * slide out rather than appearing, the reference's frame before the spread.
 * Seated, each is at its own seat. The front hub never moves: the others fan
 * out from behind it. The outer seats are drawn smaller than honest
 * perspective makes them, since the reference's outer hubs are smaller too.
 */
export function seat(o: number, fan: number, peek = 1): Seat {
  const k = Math.abs(o);
  return {
    angle: Math.sign(o) * lerp(k * 5 * peek, around(k), fan),
    r: RING_R - k * 8 * (1 - fan) + Math.max(0, k - 2) * EXIT * fan,
    s: 1 - Math.min(k, 2) * 0.09 * fan,
  };
}

/** a copy's offset from the front seat, wrapped into `[-COUNT, COUNT)` */
export function wrap(copy: number, p: number): number {
  return ((((copy - p + COUNT) % COPIES) + COPIES) % COPIES) - COUNT;
}

/** the value of `p` nearest to `from` that puts `item` in the front seat */
export function centre(item: number, from: number): number {
  return Math.round((from - item) / COUNT) * COUNT + item;
}
