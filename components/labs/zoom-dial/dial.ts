/**
 * The zoom dial's numbers, pure and DOM-free.
 *
 * Zoom is a ratio, so everything here works in its log: one octave is one
 * doubling, and 0.5x to 10x is four and a third of them. The dial's state is
 * one float, `raw`, in octaves along the ruler, and the zoom is read off it.
 *
 * The ruler is longer than the zoom range by a short flat at each lens stop:
 * across that flat the zoom holds at the stop while the hand keeps moving, which
 * is what makes the dial catch its stops, and leaving it is continuous, so
 * there is no jump on the way out.
 */

export const ZMIN = 0.5;
export const ZMAX = 10;

/** the lenses, the stops the pill offers */
export const STOPS = [0.5, 1, 2, 5] as const;

/** the stops inside the range, which are the ones the dial catches on */
const INTERIOR = [1, 2, 5] as const;

/** half a stop's flat, in octaves along the ruler */
export const CATCH = 0.06;

/** degrees of ruler per octave */
export const DEG = 22;

/** a release coasts on UIScrollView's own time constant */
export const TAU = 0.325;

const lg = Math.log2;
const L0 = lg(ZMIN);
const L1 = lg(ZMAX);

/** the ruler's whole length, in octaves */
export const RAW_MAX = L1 - L0 + 2 * CATCH * INTERIOR.length;

/** the zoom a ruler position reads, holding at a stop across its flat */
export function zoomOf(raw: number): number {
  let l = L0;
  let r = Math.max(0, raw);
  for (const s of INTERIOR) {
    const span = lg(s) - l;
    if (r <= span) return 2 ** (l + r);
    r -= span;
    if (r <= 2 * CATCH) return s;
    r -= 2 * CATCH;
    l = lg(s);
  }
  return 2 ** Math.min(L1, l + r);
}

/** the ruler position for a zoom, a stop's being the middle of its flat */
export function rawOf(zoom: number): number {
  const lz = lg(Math.min(ZMAX, Math.max(ZMIN, zoom)));
  let raw = 0;
  let l = L0;
  for (const s of INTERIOR) {
    const ls = lg(s);
    if (Math.abs(lz - ls) < 1e-9) return raw + (ls - l) + CATCH;
    if (lz < ls) return raw + (lz - l);
    raw += ls - l + 2 * CATCH;
    l = ls;
  }
  return raw + (lz - l);
}

/** the stop whose flat a ruler position sits in, or -1 */
export function caughtAt(raw: number): number {
  let edge = 0;
  let l = L0;
  for (let i = 0; i < INTERIOR.length; i++) {
    edge += lg(INTERIOR[i]) - l;
    if (raw > edge && raw < edge + 2 * CATCH) return i;
    edge += 2 * CATCH;
    l = lg(INTERIOR[i]);
  }
  return -1;
}

/** the ruler's angle for a zoom, in degrees, with 1x at the top */
export function angleOf(zoom: number): number {
  return lg(zoom) * DEG;
}

/**
 * The ruler's own angle for a ruler position, which follows the zoom and so
 * stands still across a stop's flat, and keeps going past either end by
 * however far the rubber band has let the hand pull it.
 */
export function rulerAngle(raw: number): number {
  const inside = Math.min(RAW_MAX, Math.max(0, raw));
  return angleOf(zoomOf(inside)) + (raw - inside) * DEG;
}

/** the UIScrollView rubber band, in octaves, for a pull past an end */
export function rubber(over: number): number {
  const d = 0.5;
  return (over * d * 0.55) / (d + 0.55 * Math.abs(over));
}

/** a drag position with the band applied past either end */
export function banded(raw: number): number {
  if (raw < 0) return rubber(raw);
  if (raw > RAW_MAX) return RAW_MAX + rubber(raw - RAW_MAX);
  return raw;
}

/**
 * Where a release lands and how long its coast takes. The coast is a decay
 * whose time constant is the gap over the hand's speed, so it leaves at that
 * speed, and a landing inside a stop's flat goes to the stop.
 */
export function release(
  raw: number,
  velocity: number,
): { land: number; tau: number } {
  let land = Math.min(RAW_MAX, Math.max(0, raw + velocity * TAU));
  const caught = caughtAt(land);
  if (caught >= 0) land = rawOf(INTERIOR[caught]);
  const gap = land - raw;
  const tau =
    Math.abs(velocity) > 0.3 && Math.sign(gap) === Math.sign(velocity)
      ? Math.min(0.6, Math.max(0.08, gap / velocity))
      : 0.12;
  return { land, tau };
}

export interface Tick {
  zoom: number;
  major: boolean;
  label: string | null;
}

/**
 * The ruler's marks: a tenth apart below 2x, a fifth to 5x and a half to 10x,
 * so they stay about evenly spaced on a log ruler. The stops and the far end
 * are the long marks, and carry their numbers.
 */
export const TICKS: readonly Tick[] = (() => {
  const out: Tick[] = [];
  const add = (z: number) => {
    const zoom = Math.round(z * 100) / 100;
    const major = zoom === 10 || (STOPS as readonly number[]).includes(zoom);
    out.push({ zoom, major, label: major ? short(zoom) : null });
  };
  for (let z = 0.5; z < 2 - 1e-9; z += 0.1) add(z);
  for (let z = 2; z < 5 - 1e-9; z += 0.2) add(z);
  for (let z = 5; z <= 10 + 1e-9; z += 0.5) add(z);
  return out;
})();

/** the mark a zoom has passed, so a crossing is heard once */
export function tickOf(zoom: number): number {
  let lo = 0;
  let hi = TICKS.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (TICKS[mid].zoom <= zoom + 1e-6) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** a zoom as the camera writes it on a ruler mark: ".5", "1", "2.4" */
export function short(zoom: number): string {
  const z = Math.round(zoom * 10) / 10;
  if (z < 1) return `.${Math.round(z * 10)}`;
  return Number.isInteger(z) ? String(z) : z.toFixed(1);
}

/** a zoom as the camera reads it out, with its sign: ".5×", "2.4×" */
export function readout(zoom: number): string {
  return `${short(zoom)}×`;
}

/** the lens a zoom is on, the largest stop at or below it */
export function lensOf(zoom: number): number {
  let i = 0;
  for (let k = 0; k < STOPS.length; k++) if (zoom >= STOPS[k] - 1e-6) i = k;
  return i;
}
