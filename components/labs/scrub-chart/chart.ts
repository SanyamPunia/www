/*
 * The chart as numbers: a month of made-up balances, the monotone curve
 * through them, and the curve's height at any x. Pure and DOM-free, so the
 * component is only the hand and the paint.
 */

/** One point a day, Oct 16 to Nov 14 */
export const DAYS = 30;
const START = Date.UTC(2026, 9, 16);

export interface Point {
  /** ms since the epoch, midnight UTC */
  at: number;
  value: number;
}

/*
 * Nothing rolls at runtime: the walk is seeded, so the chart is the same on
 * every visit. It stays between $4,000 and $9,999, so the big number never
 * changes length and its width holds still through a morph.
 */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function walk(): Point[] {
  const rand = seeded(3);
  const out: Point[] = [];
  let v = 4620;
  for (let i = 0; i < DAYS; i++) {
    out.push({ at: START + i * 86_400_000, value: Math.round(v * 100) / 100 });
    // a gentle drift up, with a dip in the middle of the month
    const drift = i > 11 && i < 17 ? -38 : 14;
    v += drift + (rand() - 0.5) * 150;
    v = Math.min(5400, Math.max(4200, v));
  }
  return out;
}

export const POINTS: readonly Point[] = walk();

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const day = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

export const formatMoney = (v: number): string => money.format(v);
export const formatDay = (at: number): string => day.format(at);

/** The change from the first point to point `i`, written the way a broker writes it */
export function change(i: number): { up: boolean; text: string } {
  const first = POINTS[0].value;
  const d = POINTS[i].value - first;
  const pct = (Math.abs(d) / first) * 100;
  return {
    up: d >= 0,
    text: `${money.format(Math.abs(d))} (${pct.toFixed(2)}%)`,
  };
}

/** Where the points sit in a plot box, in px */
export interface Plot {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Placed {
  xs: number[];
  ys: number[];
  /** the curve's tangent at each point, dy/dx */
  ms: number[];
}

/** Every point placed in the plot, low values at the foot */
export function place(plot: Plot): Placed {
  const values = POINTS.map((p) => p.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const xs = POINTS.map(
    (_, i) => plot.left + (i / (POINTS.length - 1)) * plot.width,
  );
  const ys = values.map(
    (v) => plot.top + (1 - (v - lo) / (hi - lo)) * plot.height,
  );
  return { xs, ys, ms: tangents(xs, ys) };
}

/*
 * Fritsch-Carlson monotone tangents. A plain Catmull-Rom overshoots between
 * two close values, so the line would dip under a low it never reached, and
 * the dot riding it would report a height that is not in the data.
 */
function tangents(xs: number[], ys: number[]): number[] {
  const n = xs.length;
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++)
    d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  const m = [d[0]];
  for (let i = 1; i < n - 1; i++)
    m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
  m.push(d[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const h = a * a + b * b;
    if (h > 9) {
      const t = 3 / Math.sqrt(h);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }
  return m;
}

/** The curve as path data. Each segment is the Hermite cubic `yAt` evaluates */
export function linePath({ xs, ys, ms }: Placed): string {
  let d = `M${xs[0].toFixed(2)},${ys[0].toFixed(2)}`;
  for (let i = 0; i < xs.length - 1; i++) {
    const h = (xs[i + 1] - xs[i]) / 3;
    d += `C${(xs[i] + h).toFixed(2)},${(ys[i] + ms[i] * h).toFixed(2)} ${(xs[i + 1] - h).toFixed(2)},${(ys[i + 1] - ms[i + 1] * h).toFixed(2)} ${xs[i + 1].toFixed(2)},${ys[i + 1].toFixed(2)}`;
  }
  return d;
}

/*
 * The curve's height at any x. With the control points at a third of each
 * segment's width, x runs linearly in t, so t is a plain share of the segment
 * and the dot gliding between two points stays on the line drawn.
 */
export function yAt({ xs, ys, ms }: Placed, x: number): number {
  const n = xs.length;
  if (x <= xs[0]) return ys[0];
  if (x >= xs[n - 1]) return ys[n - 1];
  let i = Math.floor(((x - xs[0]) / (xs[n - 1] - xs[0])) * (n - 1));
  i = Math.min(n - 2, Math.max(0, i));
  const dx = xs[i + 1] - xs[i];
  const t = (x - xs[i]) / dx;
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * ys[i] +
    (t3 - 2 * t2 + t) * dx * ms[i] +
    (-2 * t3 + 3 * t2) * ys[i + 1] +
    (t3 - t2) * dx * ms[i + 1]
  );
}

/** The nearest point to an x, which is what the crosshair snaps to */
export function nearest({ xs }: Placed, x: number): number {
  const n = xs.length;
  const i = Math.round(((x - xs[0]) / (xs[n - 1] - xs[0])) * (n - 1));
  return Math.min(n - 1, Math.max(0, i));
}
