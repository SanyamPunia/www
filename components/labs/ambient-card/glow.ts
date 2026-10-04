/**
 * The glow behind the card: where it is sampled, what colour each sample is,
 * and how it is painted. Pure apart from the context it is handed.
 *
 * The card's perimeter is cut into segments. Each segment reads a band of the
 * picture just inside its own stretch of edge and takes the colour most of
 * that band is. The shadow is the card's own shape filled with those colours,
 * each side its own, then dropped and blurred.
 */

import { clamp01 } from "@/lib/lerp";

export type Lab = readonly [number, number, number];

export interface Segment {
  /** where it sits on the card, as a share of each side */
  x: number;
  y: number;
  /** the outward normal, unit length */
  nx: number;
  ny: number;
  /** the band it samples, as shares of the face: x0, y0, x1, y1 */
  box: readonly [number, number, number, number];
  /** how far round the perimeter it is, 0 to 1, for the wave's phase */
  s: number;
}

/** segments per side, plus one per corner */
const ALONG = 8;
const ACROSS = 5;

/**
 * How deep a band reaches into the face, as a share of the card's height. Deep
 * enough that a strip of something at the very edge does not decide the colour
 * on its own, shallow enough that the middle of the face is never what a side
 * reports.
 */
const DEPTH = 0.24;

/** the segments, clockwise from the top left corner */
export function segments(aspect: number): Segment[] {
  const dy = DEPTH;
  const dx = DEPTH / aspect;
  const d = Math.SQRT1_2;
  const out: Omit<Segment, "s">[] = [];

  const corner = (x: number, y: number, nx: number, ny: number) =>
    out.push({
      x,
      y,
      nx: nx * d,
      ny: ny * d,
      box: [
        x === 0 ? 0 : 1 - dx,
        y === 0 ? 0 : 1 - dy,
        x === 0 ? dx : 1,
        y === 0 ? dy : 1,
      ],
    });

  corner(0, 0, -1, -1);
  for (let i = 0; i < ALONG; i++) {
    const a = i / ALONG;
    const b = (i + 1) / ALONG;
    out.push({ x: (a + b) / 2, y: 0, nx: 0, ny: -1, box: [a, 0, b, dy] });
  }
  corner(1, 0, 1, -1);
  for (let i = 0; i < ACROSS; i++) {
    const a = i / ACROSS;
    const b = (i + 1) / ACROSS;
    out.push({ x: 1, y: (a + b) / 2, nx: 1, ny: 0, box: [1 - dx, a, 1, b] });
  }
  corner(1, 1, 1, 1);
  for (let i = ALONG - 1; i >= 0; i--) {
    const a = i / ALONG;
    const b = (i + 1) / ALONG;
    out.push({ x: (a + b) / 2, y: 1, nx: 0, ny: 1, box: [a, 1 - dy, b, 1] });
  }
  corner(0, 1, -1, 1);
  for (let i = ACROSS - 1; i >= 0; i--) {
    const a = i / ACROSS;
    const b = (i + 1) / ACROSS;
    out.push({ x: 0, y: (a + b) / 2, nx: -1, ny: 0, box: [0, a, dx, b] });
  }

  return out.map((seg, i) => ({ ...seg, s: i / out.length }));
}

const toLinear = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

const fromLinear = (c: number) => {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
  return Math.round(clamp01(v) * 255);
};

export function toLab(r: number, g: number, b: number): Lab {
  const R = toLinear(r);
  const G = toLinear(g);
  const B = toLinear(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** linear sRGB, unclamped, so a caller can tell when it left the gamut */
function linearRgb([L, a, b]: Lab): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

export function toRgb(lab: Lab): [number, number, number] {
  const [r, g, b] = linearRgb(lab);
  return [fromLinear(r), fromLinear(g), fromLinear(b)];
}

/**
 * The colour most of a band is, not its average.
 *
 * An average of a band that is half snow and half sky is a grey nobody drew.
 * So the band's pixels are dropped into 64 coarse bins, four levels a channel,
 * the fullest bin wins, and what comes back is the mean of the pixels in that
 * bin alone. Coarse bins are what make it a majority rather than a mode: a sky
 * gradient lands in one or two bins rather than being split across a dozen
 * that each lose to the snow.
 */
export function dominant(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  [x0, y0, x1, y1]: Segment["box"],
): Lab {
  const counts = new Uint32Array(64);
  const sums = new Float64Array(64 * 3);
  const left = Math.floor(x0 * width);
  const right = Math.ceil(x1 * width);
  const top = Math.floor(y0 * height);
  const bottom = Math.ceil(y1 * height);

  for (let y = top; y < bottom; y++) {
    for (let x = left; x < right; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const bin = ((r >> 6) << 4) | ((g >> 6) << 2) | (b >> 6);
      counts[bin]++;
      sums[bin * 3] += r;
      sums[bin * 3 + 1] += g;
      sums[bin * 3 + 2] += b;
    }
  }

  let best = 0;
  for (let i = 1; i < 64; i++) if (counts[i] > counts[best]) best = i;
  const n = counts[best] || 1;
  return toLab(
    sums[best * 3] / n,
    sums[best * 3 + 1] / n,
    sums[best * 3 + 2] / n,
  );
}

/**
 * A face's colour turned into the colour of its shadow on a white page.
 *
 * A shadow is darker than the ground it falls on, so the pale blue of a sky
 * cannot be painted as itself: on white it would be nothing. Lightness is
 * pulled into a band a little under the page's, or kept 0.08 under its own
 * when it is brighter than that band, and chroma is raised, so the
 * sky comes back as a clear blue tint and a near-black night comes back as a
 * navy rather than as a grey smudge. A colour with almost no chroma keeps
 * almost none, or a white face would cast a coloured shadow it does not have.
 *
 * Chroma is stepped down until the result is inside sRGB, since clamping each
 * channel on its own shifts the hue.
 */
export function tone([L, a, b]: Lab): Lab {
  const C = Math.hypot(a, b);
  const h = Math.atan2(b, a);
  /*
   * A bright colour keeps most of its own lightness. Yellow only has chroma
   * near the top of the lightness range, so pulled down into the band it
   * comes back as olive.
   */
  const L2 = Math.max(0.62 + 0.14 * clamp01(L), L - 0.08);
  let C2 = C < 0.025 ? C * 0.8 : Math.min(0.06 + C * 1.25, 0.22);

  for (let step = 0; step < 12; step++) {
    const lab: Lab = [L2, C2 * Math.cos(h), C2 * Math.sin(h)];
    if (linearRgb(lab).every((v) => v >= -0.001 && v <= 1.001)) return lab;
    C2 *= 0.9;
  }
  return [L2, C2 * Math.cos(h), C2 * Math.sin(h)];
}

/**
 * Each segment's shadow colour for one face, softened against its two
 * neighbours.
 *
 * Neighbouring blobs already overlap, and this is the second half of the same
 * job: where a face changes colour between two segments the glow changes over
 * three of them rather than at a seam.
 */
export function palette(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  segs: readonly Segment[],
): Lab[] {
  const raw = segs.map((seg) => tone(dominant(data, width, height, seg.box)));
  const n = raw.length;
  return raw.map((c, i) => {
    const p = raw[(i - 1 + n) % n];
    const q = raw[(i + 1) % n];
    return [
      c[0] * 0.5 + (p[0] + q[0]) * 0.25,
      c[1] * 0.5 + (p[1] + q[1]) * 0.25,
      c[2] * 0.5 + (p[2] + q[2]) * 0.25,
    ];
  });
}

export interface Geometry {
  /** the card's box inside the canvas, in CSS pixels */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Frame {
  /** seconds, for the wave */
  t: number;
  /** 0 to 1, how much the wave moves the shadow's edge */
  wave: number;
  /** 0 to 1, how far the card is lifted off the page */
  lift: number;
  /** how far the tilt slides the shadow, in CSS pixels */
  shiftX: number;
  shiftY: number;
}

/**
 * The shadow is a drop shadow, not a glow: a rounded rect the shape of the
 * card, filled with each side's colour, grown a little, dropped a little
 * and blurred as one piece. So its spread falls off evenly from every edge and
 * follows the card's corners, which is what a real shadow does.
 *
 * Every length is a share of the card's height. A lift drops the shadow
 * further and blurs it wider, as a shadow does when its object rises.
 */
export const SHADOW = {
  /**
   * How far the shape is pulled in from the card's edge. Negative, so the
   * shape is a little larger than the card and every side shows its colour,
   * the top included, rather than the whole shadow pooling under the foot.
   */
  inset: -0.03,
  drop: 0.06,
  /** CSS blur, the standard deviation of the spread */
  blur: 0.13,
  /** how far the wave pushes the edge in and out */
  wave: 0.045,
  /**
   * How far the tilt slides the shadow away from the pointer at full tilt. The
   * edge that comes forward is further off the page, so its shadow reaches
   * further.
   */
  shift: 0.04,
  /** the canvas's opacity, since the shape itself is painted opaque */
  alpha: 0.85,
  lift: { drop: 0.04, blur: 0.02, alpha: -0.05 },
};

/**
 * How far the shadow can reach past the card, which the canvas has to clear on
 * every side. A gaussian is spent by about two and a half deviations, and a
 * canvas that stops short of that cuts the shadow off in a hard line.
 */
export const MARGIN =
  SHADOW.shift +
  SHADOW.drop +
  SHADOW.lift.drop +
  SHADOW.wave +
  (SHADOW.blur + SHADOW.lift.blur) * 2.5;

export function shadowBlur(height: number, lift: number): number {
  return height * (SHADOW.blur + SHADOW.lift.blur * lift);
}

export function shadowAlpha(lift: number): number {
  return SHADOW.alpha + SHADOW.lift.alpha * lift;
}

/** one point on the shadow's outline, in the card's own pixels */
export interface Point {
  x: number;
  y: number;
  nx: number;
  ny: number;
  /** how far round the outline it is, 0 to 1, by arc length */
  u: number;
  /** the two nearest segments and how much of the second to mix in */
  a: number;
  b: number;
  mix: number;
}

/** points on the outline, enough that the wave bends it smoothly */
const POINTS = 160;

/**
 * The card's rounded rect as evenly spaced points, each tied to the two
 * nearest segments. The tie is worked out once per size, since only the wave
 * moves the points and the wave moves them along their own normals.
 */
export function outline(
  width: number,
  height: number,
  radius: number,
  segs: readonly Segment[],
): Point[] {
  const r = Math.min(radius, width / 2, height / 2);
  const sx = width - 2 * r;
  const sy = height - 2 * r;
  const arc = (Math.PI / 2) * r;
  const total = 2 * sx + 2 * sy + 4 * arc;

  /* the outline as runs: a straight side, then a quarter turn, four times */
  const runs: [number, (d: number) => [number, number, number, number]][] = [
    [sx, (d) => [r + d, 0, 0, -1]],
    [arc, (d) => corner(width - r, r, -Math.PI / 2 + d / r)],
    [sy, (d) => [width, r + d, 1, 0]],
    [arc, (d) => corner(width - r, height - r, d / r)],
    [sx, (d) => [width - r - d, height, 0, 1]],
    [arc, (d) => corner(r, height - r, Math.PI / 2 + d / r)],
    [sy, (d) => [0, height - r - d, -1, 0]],
    [arc, (d) => corner(r, r, Math.PI + d / r)],
  ];
  function corner(cx: number, cy: number, angle: number) {
    const nx = Math.cos(angle);
    const ny = Math.sin(angle);
    return [cx + nx * r, cy + ny * r, nx, ny] as [
      number,
      number,
      number,
      number,
    ];
  }

  const anchors = segs.map((seg) => [seg.x * width, seg.y * height]);
  const out: Point[] = [];

  for (let i = 0; i < POINTS; i++) {
    let d = (i / POINTS) * total;
    let run = 0;
    while (run < runs.length - 1 && d > runs[run][0]) {
      d -= runs[run][0];
      run++;
    }
    const [x, y, nx, ny] = runs[run][1](d);

    let a = 0;
    let b = 0;
    let da = Infinity;
    let db = Infinity;
    for (let k = 0; k < anchors.length; k++) {
      const dist = Math.hypot(anchors[k][0] - x, anchors[k][1] - y);
      if (dist < da) {
        b = a;
        db = da;
        a = k;
        da = dist;
      } else if (dist < db) {
        b = k;
        db = dist;
      }
    }
    out.push({ x, y, nx, ny, u: i / POINTS, a, b, mix: da / (da + db || 1) });
  }
  return out;
}

/**
 * Two sines round the outline moving in opposite directions, so the shadow's
 * edge swells and thins along each side rather than pulsing all at once.
 * Three waves and two, which never line up into one shape the eye can follow.
 */
function wave(u: number, t: number): number {
  const tau = Math.PI * 2;
  return (
    Math.sin(tau * 3 * u + t * 0.9) * 0.65 +
    Math.sin(tau * 2 * u - t * 0.55 + 1.3) * 0.35
  );
}

/**
 * The shape, filled as a fan of thin wedges from its middle, each the colour of
 * the stretch of edge it ends on. The blur over the canvas turns the fan into
 * one smooth shadow. Each wedge reaches one point past its neighbour, so the
 * antialiased seams between them are covered rather than left as hairlines.
 */
export function paint(
  ctx: CanvasRenderingContext2D,
  points: readonly Point[],
  colors: readonly Lab[],
  g: Geometry,
  f: Frame,
): void {
  const H = g.height;
  const drop = H * (SHADOW.drop + SHADOW.lift.drop * f.lift);
  const inset = H * SHADOW.inset;
  const amp = H * SHADOW.wave * f.wave;
  const cx = g.x + g.width / 2 + f.shiftX;
  const cy = g.y + H / 2 + drop + f.shiftY;

  const xs = new Float64Array(points.length);
  const ys = new Float64Array(points.length);
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const push = amp * wave(p.u, f.t) - inset;
    xs[i] = g.x + p.x + p.nx * push + f.shiftX;
    ys[i] = g.y + p.y + p.ny * push + drop + f.shiftY;
  }

  const n = points.length;
  for (let i = 0; i < n; i++) {
    const p = points[i];
    const ca = colors[p.a];
    const cb = colors[p.b];
    const t = p.mix;
    const [r, gr, b] = toRgb([
      ca[0] * (1 - t) + cb[0] * t,
      ca[1] * (1 - t) + cb[1] * t,
      ca[2] * (1 - t) + cb[2] * t,
    ]);
    const j = (i + 1) % n;
    const k = (i + 2) % n;
    ctx.fillStyle = `rgb(${r},${gr},${b})`;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(xs[i], ys[i]);
    ctx.lineTo(xs[j], ys[j]);
    ctx.lineTo(xs[k], ys[k]);
    ctx.closePath();
    ctx.fill();
  }
}
