import type { Line } from "./layout";

/*
 * Puts the timeline on paper. Ink is laid down a segment at a time onto a
 * canvas that is never cleared while a note is written, so a frame costs only
 * the few segments the pen covered since the last one, and nothing already on
 * the page is drawn again.
 *
 * Each segment is its own short stroke with its own width, which is what lets
 * the ink thicken where the pen slows and thin where it lifts. The ink is
 * opaque, so where two segments overlap at a joint nothing doubles up.
 */

export interface Progress {
  /** the last whole point drawn */
  i: number;
  /** where the pen stopped inside the next segment */
  x: number;
  y: number;
  started: boolean;
  done: boolean;
  dried: boolean;
  /** when the ink stops looking wet, ms from the start of the note */
  dryAt: number;
}

export function fresh(line: Line): Progress {
  return {
    i: 0,
    x: line.xy[0],
    y: line.xy[1],
    started: false,
    done: false,
    dried: false,
    dryAt: Number.POSITIVE_INFINITY,
  };
}

/** the last point whose clock is at or before `f` */
function find(at: Float32Array, f: number): number {
  let lo = 0;
  let hi = at.length - 1;
  if (f >= at[hi]) return hi;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (at[mid] <= f) lo = mid;
    else hi = mid;
  }
  return lo;
}

function segment(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  w: number,
) {
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

/** a marker's streaks: two thin lines inside the band, a shade off its colour */
const STREAKS = [
  { offset: -0.3, width: 0.1, color: "#f4cf4d" },
  { offset: 0.22, width: 0.14, color: "#fde9a0" },
];

function markerSegment(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  w: number,
  color: string,
) {
  ctx.strokeStyle = color;
  segment(ctx, x0, y0, x1, y1, w);
  const len = Math.hypot(x1 - x0, y1 - y0) || 1;
  const nx = -(y1 - y0) / len;
  const ny = (x1 - x0) / len;
  for (const s of STREAKS) {
    ctx.strokeStyle = s.color;
    const o = s.offset * w;
    segment(
      ctx,
      x0 + nx * o,
      y0 + ny * o,
      x1 + nx * o,
      y1 + ny * o,
      s.width * w,
    );
  }
}

/**
 * Draws a line from wherever the pen stopped last frame to where its clock says
 * it is now. Returns how far the pen travelled, for the sound.
 */
export function inkTo(
  ctx: CanvasRenderingContext2D,
  line: Line,
  p: Progress,
  f: number,
): number {
  const { xy, w, at } = line;
  const n = w.length;
  const marker = line.kind === "marker";
  ctx.lineCap = "round";
  ctx.strokeStyle = line.color;
  ctx.fillStyle = line.color;

  if (!p.started) {
    p.started = true;
    // the nib landing, before it has moved anywhere
    if (!marker) {
      ctx.beginPath();
      ctx.arc(xy[0], xy[1], w[0] / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const j = find(at, f);
  let x = p.x;
  let y = p.y;
  let moved = 0;
  const to = (tx: number, ty: number, tw: number) => {
    if (marker) markerSegment(ctx, x, y, tx, ty, tw, line.color);
    else segment(ctx, x, y, tx, ty, tw);
    moved += Math.hypot(tx - x, ty - y);
    x = tx;
    y = ty;
  };
  for (let k = p.i + 1; k <= j; k++) to(xy[k * 2], xy[k * 2 + 1], w[k]);
  if (j < n - 1 && at[j + 1] > at[j]) {
    const a = Math.max(0, (f - at[j]) / (at[j + 1] - at[j]));
    to(
      xy[j * 2] + (xy[j * 2 + 2] - xy[j * 2]) * a,
      xy[j * 2 + 1] + (xy[j * 2 + 3] - xy[j * 2 + 1]) * a,
      w[j] + (w[j + 1] - w[j]) * a,
    );
  }
  p.i = Math.max(p.i, j);
  p.x = x;
  p.y = y;
  return moved;
}

/** the whole line again in the colour it dries to, over the wet one */
export function dry(ctx: CanvasRenderingContext2D, line: Line) {
  if (!line.dry) return;
  const { xy, w } = line;
  ctx.lineCap = "round";
  ctx.strokeStyle = line.dry;
  ctx.fillStyle = line.dry;
  ctx.beginPath();
  ctx.arc(xy[0], xy[1], w[0] / 2, 0, Math.PI * 2);
  ctx.fill();
  for (let k = 1; k < w.length; k++) {
    segment(ctx, xy[k * 2 - 2], xy[k * 2 - 1], xy[k * 2], xy[k * 2 + 1], w[k]);
  }
}
