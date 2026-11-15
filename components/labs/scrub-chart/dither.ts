/*
 * The area under the line, drawn as an ordered dither rather than a gradient.
 * Every cell of a 3px grid asks how much ink it should hold, compares that
 * with its place in an 8x8 Bayer matrix, and is either a dot or paper. So the
 * fade from the line to the foot is a falling density of dots, the way a
 * one-bit screen draws a gradient.
 *
 * Moving the crosshair adds a wake: the density is lifted a little round the
 * crosshair by how fast it is moving. The matrix never moves, so a dot only
 * ever comes or goes where the ink it wants crosses its threshold, and the
 * screen does not shimmer. Pure apart from the context it is handed.
 */

import { type Placed, yAt } from "./chart";

/** The grid, and the dot inside each cell (px) */
const CELL = 3;
const DOT = 2;

/** The most ink a cell can hold, at the line, and how it falls off toward the foot */
const PEAK = 0.62;
const FALL = 1.5;
/** The line past the crosshair still has a screen under it, this much as dense */
const QUIET = 0.32;
/** How far the wake reaches either side of the crosshair (px), and how much it lifts */
const WAKE = { reach: 40, lift: 0.3 };

function bayer(n: number): number[] {
  let m = [0];
  let size = 1;
  while (size < n) {
    const next: number[] = new Array(size * 2 * size * 2);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const v = m[y * size + x] * 4;
        const w = size * 2;
        next[y * w + x] = v;
        next[y * w + x + size] = v + 2;
        next[(y + size) * w + x] = v + 3;
        next[(y + size) * w + x + size] = v + 1;
      }
    m = next;
    size *= 2;
  }
  return m.map((v) => (v + 0.5) / (n * n));
}

const MATRIX = bayer(8);

export interface DitherFrame {
  placed: Placed;
  /** the chart's size, in css px */
  w: number;
  h: number;
  /** the crosshair */
  x: number;
  /** 0 at rest, 1 at a fast scrub */
  wake: number;
  ink: { ahead: string; behind: string };
}

/** Paints the screen. The context is already scaled to css px */
export function paintDither(
  ctx: CanvasRenderingContext2D,
  f: DitherFrame,
): void {
  const { placed, w, h, x, wake } = f;
  ctx.clearRect(0, 0, w, h);
  const left = placed.xs[0];
  const right = placed.xs[placed.xs.length - 1];
  const ahead = new Path2D();
  const behind = new Path2D();
  const inset = (CELL - DOT) / 2;

  for (let cx = 0; cx * CELL < w; cx++) {
    const px = cx * CELL + CELL / 2;
    if (px < left || px > right) continue;
    const top = yAt(placed, px);
    const span = h - top;
    if (span <= 0) continue;
    const past = px > x;
    const near = (px - x) / WAKE.reach;
    const lift = wake * WAKE.lift * Math.exp(-near * near);
    const path = past ? behind : ahead;
    const scale = past ? QUIET : 1;
    // the first row below the line, so no dot sits over the stroke
    const first = Math.ceil((top + 2) / CELL);
    for (let cy = first; cy * CELL < h; cy++) {
      const py = cy * CELL + CELL / 2;
      const t = (py - top) / span;
      const d = PEAK * (1 - t) ** FALL * scale + lift * (1 - t);
      if (d <= 0) continue;
      const threshold = MATRIX[(cy & 7) * 8 + (cx & 7)];
      if (d > threshold)
        path.rect(cx * CELL + inset, cy * CELL + inset, DOT, DOT);
    }
  }

  ctx.fillStyle = f.ink.behind;
  ctx.fill(behind);
  ctx.fillStyle = f.ink.ahead;
  ctx.fill(ahead);
}
