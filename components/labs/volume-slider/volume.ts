/**
 * The volume slider's numbers, pure and DOM-free.
 *
 * The slider's state is a level from 0 to 1 and a stretch in px. The level is
 * what the fill shows. The stretch is how far past either end the hand has
 * pulled the slab, positive past the top and negative past the bottom, and it
 * is what makes the slab give rather than stop.
 */

/** the slab at rest, in px */
export const WIDTH = 96;
export const HEIGHT = 216;

/** how much wider the slab is while a hand is on it */
export const GROW = 8;

/** iOS steps the volume in sixteenths, and so does every click here */
export const STEPS = 16;

/** the most the slab can stretch, in px, however far the hand goes */
export const REACH = 34;

/**
 * The UIScrollView rubber band: the slab follows a falling share of the hand
 * past either end and never more than `REACH`, so the end reads as the slab
 * giving way and not as a wall.
 */
export function rubber(over: number): number {
  const c = 0.55;
  return (over * REACH * c) / (REACH + c * Math.abs(over));
}

/**
 * Where a drag puts the level and the stretch, for the level it started at and
 * how far the hand has moved, in px, up being positive.
 */
export function drag(
  from: number,
  moved: number,
): { level: number; over: number } {
  const raw = from + moved / HEIGHT;
  if (raw > 1) return { level: 1, over: rubber((raw - 1) * HEIGHT) };
  if (raw < 0) return { level: 0, over: rubber(raw * HEIGHT) };
  return { level: raw, over: 0 };
}

/** the sixteenth the level sits in, which is what a click is heard for */
export function stepOf(level: number): number {
  return Math.round(level * STEPS);
}

/**
 * How many waves the speaker shows: none and struck through at silence, then
 * one, two and three, the way the iOS glyph steps up.
 */
export function wavesOf(level: number): 0 | 1 | 2 | 3 {
  if (level <= 0.001) return 0;
  if (level <= 1 / 3) return 1;
  if (level <= 2 / 3) return 2;
  return 3;
}

/**
 * The slab's box for a stretch, the end it is on and a press. A press grows the
 * whole slab about its middle, which is the module answering a touch. A
 * stretch grows it toward the end being pulled, so the other end stays where
 * it was, and narrows it as it goes, the way something elastic does.
 *
 * `extent` is measured along `side`, 1 at the top and -1 at the bottom, so it
 * can go below zero: a release springs past rest and the slab squashes a
 * little at the same end, rather than the overshoot being read as a stretch
 * at the other one. `base` is the slab's height without the stretch, which is
 * what the level fills.
 */
export function box(extent: number, side: 1 | -1, press: number) {
  const base = HEIGHT + GROW * press;
  return {
    base,
    width: WIDTH + GROW * press - extent * 0.35,
    height: base + extent,
    top: (side > 0 ? -extent : 0) - (GROW * press) / 2,
  };
}

/** the sixteenth nearest a level, which is where a release comes to rest */
export function snap(level: number): number {
  return stepOf(level) / STEPS;
}

/** the slab's corner, in px, which is `rounded-[2rem]` */
export const CORNER = 32;

/** how many strokes a burst has, and how far out from the slab they start */
const STROKES = 7;
const CLEAR = 9;

export interface Stroke {
  /** the stroke's path, in px from the centre of the end's corners */
  d: string;
  /** the way it flicks as it wipes off, in px */
  dx: number;
  dy: number;
}

/** an integer hash, so every burst is a little different and none is random */
function hash(n: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/**
 * The doodle at an end: a fan of short, slightly bent strokes ringing the
 * rounded end of the slab, like the "boing" marks round something in a sketch.
 *
 * The strokes are placed off the slab's real outline, a rounded box measured
 * with its signed distance, so each starts the same `CLEAR` px out whether it
 * leaves the flat of the end or the curve of a corner. Coordinates are from the
 * centre of the end's corners, with the slab running down for the top end and
 * up for the bottom one.
 */
export function burst(
  side: 1 | -1,
  width: number,
  height: number,
  seed: number,
): Stroke[] {
  const hw = width / 2;
  const hh = height / 2;
  // the slab's centre, from the centre of the top end's corners
  const cy = hh - CORNER;
  const outside = (x: number, y: number) => {
    const qx = Math.abs(x) - hw + CORNER;
    const qy = Math.abs(y - cy) - hh + CORNER;
    const ox = Math.max(qx, 0);
    const oy = Math.max(qy, 0);
    return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - CORNER;
  };
  const strokes: Stroke[] = [];
  for (let k = 0; k < STROKES; k++) {
    const j = (i: number) => hash(seed * 131 + k * 17 + i) * 2 - 1;
    const a = ((-155 + (130 * k) / (STROKES - 1) + j(1) * 6) * Math.PI) / 180;
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    let t = 0;
    while (outside(ux * t, uy * t) < CLEAR && t < 160) t += 0.5;
    const len = 9 + (j(2) + 1) * 2.5;
    const bend = j(3) * 2.2;
    const x0 = ux * t;
    const y0 = uy * t;
    const x1 = ux * (t + len);
    const y1 = uy * (t + len);
    const mx = (x0 + x1) / 2 - uy * bend;
    const my = (y0 + y1) / 2 + ux * bend;
    const f = (y: number) => (side * y).toFixed(2);
    strokes.push({
      d: `M ${x0.toFixed(2)} ${f(y0)} Q ${mx.toFixed(2)} ${f(my)} ${x1.toFixed(2)} ${f(y1)}`,
      dx: ux * 7,
      dy: side * uy * 7,
    });
  }
  return strokes;
}
