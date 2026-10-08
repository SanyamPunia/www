/*
 * The pen marks: pure geometry, no DOM. A mark is handed the line rects of the
 * words it is about, in the drawing's own pixels, and returns the strokes that
 * draw it as polylines for the ink renderer.
 *
 * The loop, the underline and the roughening are a port of the reference's
 * scribble highlighter. What a hand adds is two things a ruler does not: the
 * stroke never quite closes or lies flat, and a pen goes over a line twice.
 */

export type Shape =
  | "circle"
  | "underline"
  | "double"
  | "strike"
  | "zigzag"
  | "highlight";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Point = [number, number];

export interface Stroke {
  points: Point[];
  width: number;
  opacity: number;
  /** how far into the mark's own time this stroke starts, 0 to 1 */
  at: number;
  /** its share of the mark's time */
  span: number;
}

export type Rng = () => number;

/** wobble and roughness, 0 to 1, shared by every mark */
const WOBBLE = 0.5;
const ROUGH = 0.6;

/** a seeded generator, so the same words draw the same mark on every visit */
export function rng(seed: string): Rng {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h = (h + 1831565813) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A loop round every rect at once: a superellipse that turns 1.1 times and grows
 * as it goes, so it ends outside where it started rather than on it.
 */
function loop(rects: readonly Rect[], r: Rng): Point[] {
  const left = Math.min(...rects.map((t) => t.x));
  const right = Math.max(...rects.map((t) => t.x + t.w));
  const top = Math.min(...rects.map((t) => t.y));
  const h = Math.max(...rects.map((t) => t.h));
  const cx = (left + right) / 2;
  const cy = top + 0.575 * h;
  const ry = 0.62 * h;
  // the reference widens the loop until it clears the text's corners, which on
  // a slanted hand throws it a third of an em into the next word. Clearing the
  // ends at mid-height is enough, since a hand's ascenders lean inward there.
  const rx = ((right - left) / 2 + 0.05 * h) / 0.93;
  const tilt = WOBBLE * (0.04 * (r() - 0.5) - 0.05);
  const p1 = r() * Math.PI * 2;
  const p2 = r() * Math.PI * 2;
  const amp = 0.03 * WOBBLE;
  const grow = 0.05 * (1 + WOBBLE);
  const exp = 2 / 3.5;
  const cos = Math.cos(tilt);
  const sin = Math.sin(tilt);
  const out: Point[] = [];
  for (let i = 0; i <= 110; i++) {
    const e = i / 110;
    const a = 1.1 * e * Math.PI * 2 - 2.6;
    const k =
      1 +
      amp * Math.sin(e * Math.PI * 2 * 1.7 + p1) +
      0.6 * amp * Math.sin(e * Math.PI * 2 * 2.9 + p2) +
      grow * e;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const x = rx * k * Math.sign(c) * Math.abs(c) ** exp;
    const y = ry * k * Math.sign(s) * Math.abs(s) ** exp;
    out.push([cx + x * cos - y * sin, cy + x * sin + y * cos]);
  }
  return out;
}

/** a line from x0 to x1 that bows a little and lifts at its end, as a flicked pen does */
function line(
  x0: number,
  x1: number,
  y: number,
  h: number,
  lift: number,
  r: Rng,
): Point[] {
  const phase = r() * Math.PI * 2;
  const ripple = 0.012 * h * WOBBLE;
  const out: Point[] = [];
  for (let i = 0; i <= 28; i++) {
    const t = i / 28;
    const dy =
      0.03 * h * Math.sin(Math.PI * t) -
      lift * t ** 2.5 +
      ripple * Math.sin(t * Math.PI * 2 * 1.3 + phase);
    out.push([x0 + (x1 - x0) * t, y + dy]);
  }
  return out;
}

/** a scribble back and forth under the words, about two teeth per line height */
function zigzag(x0: number, x1: number, y: number, h: number, r: Rng): Point[] {
  const step = 0.42 * h;
  const n = Math.max(3, Math.round((x1 - x0) / step));
  const out: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const up = i % 2 === 0 ? -1 : 1;
    out.push([
      x0 + (x1 - x0) * t + (r() - 0.5) * 0.08 * h,
      y + up * 0.075 * h + (r() - 0.5) * 0.04 * h,
    ]);
  }
  return out;
}

/**
 * Pushes every point out along its normal by a smoothed random amount, plus a
 * constant offset, so a second pass runs beside the first rather than on it.
 */
function roughen(pts: readonly Point[], r: Rng, amp: number, shift: number) {
  const noise = pts.map(() => 2 * (r() - 0.5) * amp);
  const n = pts.length;
  return pts.map((p, i): Point => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const k =
      (noise[Math.max(0, i - 1)] +
        2 * noise[i] +
        noise[Math.min(n - 1, i + 1)]) /
        4 +
      shift;
    return [p[0] - (dy / len) * k, p[1] + (dx / len) * k];
  });
}

/** the bare spines of a mark, before the pen goes over them */
function spines(shape: Shape, rects: readonly Rect[], r: Rng): Point[][] {
  if (shape === "circle") return [loop(rects, r)];
  const out: Point[][] = [];
  for (const t of rects) {
    const lift = 0.07 * t.h * (0.6 + 0.8 * WOBBLE);
    if (shape === "strike") {
      out.push(
        line(
          t.x - 0.06 * t.h,
          t.x + t.w + 0.06 * t.h,
          t.y + 0.6 * t.h,
          t.h,
          0.4 * lift,
          r,
        ),
      );
    } else if (shape === "highlight") {
      // inset by the cap, since a round cap 0.72em wide reaches past the run
      // into the word before it
      out.push(
        line(
          t.x + 0.22 * t.h,
          t.x + t.w - 0.18 * t.h,
          t.y + 0.6 * t.h,
          t.h,
          0.3 * lift,
          r,
        ),
      );
    } else if (shape === "zigzag") {
      out.push(zigzag(t.x, t.x + t.w, t.y + 0.98 * t.h, t.h, r));
    } else {
      const y = t.y + 0.92 * t.h;
      out.push(
        line(
          t.x - 0.04 * t.h,
          t.x + t.w + Math.max(0.1 * t.h, 0.03 * t.w),
          y,
          t.h,
          lift,
          r,
        ),
      );
      if (shape === "double") {
        out.push(
          line(
            t.x + 0.08 * t.w,
            t.x + 0.99 * t.w,
            y + 0.13 * t.h,
            t.h,
            0.7 * lift,
            r,
          ),
        );
      }
    }
  }
  return out;
}

/**
 * The strokes for one mark. `size` is the font size the words are set at, which
 * every width and every wobble is a share of, so a mark scales with its text.
 *
 * A highlight is one fat pass and nothing else: a marker is laid down once. Every
 * other mark is a pen, two passes, the second thinner, fainter, a frame behind.
 */
export function strokes(
  shape: Shape,
  rects: readonly Rect[],
  size: number,
  seed: string,
): Stroke[] {
  if (!rects.length) return [];
  const r = rng(`${seed}|${shape}`);
  const lines = spines(shape, rects, r);
  const lengths = lines.map((pts) =>
    pts.reduce(
      (sum, p, i) =>
        i ? sum + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0,
      0,
    ),
  );
  const total = lengths.reduce((a, b) => a + b, 0) || 1;
  const width = size * 0.06;
  const rough = 0.032 * size * ROUGH;
  const out: Stroke[] = [];
  let at = 0;
  lines.forEach((pts, i) => {
    const span = lengths[i] / total;
    if (shape === "highlight") {
      out.push({
        points: roughen(pts, r, rough * 0.5, 0),
        width: size * 0.72,
        opacity: 1,
        at,
        span,
      });
    } else {
      out.push({
        points: roughen(pts, r, rough, 0),
        width,
        opacity: 1,
        at,
        span,
      });
      out.push({
        points: roughen(pts, r, rough * 1.3, 0.035 * size * ROUGH),
        width: width * 0.55,
        opacity: 0.75,
        at: at + 0.06,
        span,
      });
    }
    at += span;
  });
  return out;
}
