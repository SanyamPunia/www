/*
 * The outlines the icons are made of, in a 120 unit box centred on (60, 60).
 * Pure geometry, no DOM, the split `document-pocket` makes with `poses.ts`.
 * `scenes.ts` assembles them into icons and colours them.
 *
 * Every part of every icon is one closed outline resampled to the same `K`
 * points by arc length, all wound clockwise on screen, so any part can be
 * interpolated into any other point for point. That is what makes the morph
 * geometric rather than a crossfade.
 */

export const K = 256;

/** `K` points, interleaved x then y. */
export type Outline = number[];

type Segment =
  | { kind: "arc"; cx: number; cy: number; r: number; a0: number; a1: number }
  | {
      kind: "cubic";
      p: [number, number, number, number, number, number, number, number];
    };

const TAU = Math.PI * 2;

/*
 * `cw` is clockwise on screen, which with y pointing down is an increasing
 * angle. The end angle is pushed a whole turn at a time until the arc runs the
 * named way, so a caller can pass `atan2` results straight in.
 */
function arc(
  cx: number,
  cy: number,
  r: number,
  a0: number,
  a1: number,
  cw = true,
): Segment {
  let end = a1;
  if (cw) while (end <= a0) end += TAU;
  else while (end >= a0) end -= TAU;
  return { kind: "arc", cx, cy, r, a0, a1: end };
}

function line(x0: number, y0: number, x1: number, y1: number): Segment {
  return { kind: "cubic", p: [x0, y0, x0, y0, x1, y1, x1, y1] };
}

/** A dense polyline, each segment without its last point, then resampled. */
function outline(segments: readonly Segment[]): number[] {
  const dense: number[] = [];
  for (const s of segments) {
    if (s.kind === "arc") {
      const n = Math.max(8, Math.ceil((Math.abs(s.a1 - s.a0) * s.r) / 0.2));
      for (let i = 0; i < n; i++) {
        const a = s.a0 + ((s.a1 - s.a0) * i) / n;
        dense.push(s.cx + s.r * Math.cos(a), s.cy + s.r * Math.sin(a));
      }
    } else {
      const [x0, y0, x1, y1, x2, y2, x3, y3] = s.p;
      const n = 80;
      for (let i = 0; i < n; i++) {
        const t = i / n;
        const u = 1 - t;
        const a = u * u * u;
        const b = 3 * u * u * t;
        const c = 3 * u * t * t;
        const d = t * t * t;
        dense.push(
          a * x0 + b * x1 + c * x2 + d * x3,
          a * y0 + b * y1 + c * y2 + d * y3,
        );
      }
    }
  }
  return resample(dense);
}

function resample(dense: number[]): number[] {
  const n = dense.length / 2;
  const cum = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    cum[i + 1] =
      cum[i] +
      Math.hypot(
        dense[j * 2] - dense[i * 2],
        dense[j * 2 + 1] - dense[i * 2 + 1],
      );
  }
  const total = cum[n];
  const out: number[] = [];
  let seg = 0;
  for (let k = 0; k < K; k++) {
    const at = (total * k) / K;
    while (cum[seg + 1] < at) seg++;
    const j = (seg + 1) % n;
    const f = (at - cum[seg]) / (cum[seg + 1] - cum[seg] || 1);
    out.push(
      dense[seg * 2] + (dense[j * 2] - dense[seg * 2]) * f,
      dense[seg * 2 + 1] + (dense[j * 2 + 1] - dense[seg * 2 + 1]) * f,
    );
  }
  return out;
}

/** The intersection of two circles with the smaller y. */
function upperMeet(
  ax: number,
  ay: number,
  ar: number,
  bx: number,
  by: number,
  br: number,
): [number, number] {
  const dx = bx - ax;
  const dy = by - ay;
  const d = Math.hypot(dx, dy);
  const a = (ar * ar - br * br + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, ar * ar - a * a));
  const mx = ax + (dx * a) / d;
  const my = ay + (dy * a) / d;
  const p: [number, number] = [mx + (dy * h) / d, my - (dx * h) / d];
  const q: [number, number] = [mx - (dy * h) / d, my + (dx * h) / d];
  return p[1] < q[1] ? p : q;
}

const angle = (x: number, y: number, cx: number, cy: number) =>
  Math.atan2(y - cy, x - cx);

export function circle(cx: number, cy: number, r: number): Outline {
  return outline([arc(cx, cy, r, -Math.PI / 2, (3 * Math.PI) / 2)]);
}

export function centroid(pts: readonly number[]): [number, number] {
  let x = 0;
  let y = 0;
  for (let i = 0; i < K; i++) {
    x += pts[i * 2];
    y += pts[i * 2 + 1];
  }
  return [x / K, y / K];
}

/** The outline scaled about its own centroid, which then moves to `(x, y)`. */
export function placed(
  pts: readonly number[],
  scale: number,
  x: number,
  y: number,
): Outline {
  const [cx, cy] = centroid(pts);
  const out = new Array<number>(K * 2);
  for (let i = 0; i < K; i++) {
    out[i * 2] = x + (pts[i * 2] - cx) * scale;
    out[i * 2 + 1] = y + (pts[i * 2 + 1] - cy) * scale;
  }
  return out;
}

/*
 * Three circles standing on one flat foot. The two notches where the top
 * circle meets the side ones are left sharp, and the path renderer softens
 * them by about a sample's length.
 */
export function cloud(): Outline {
  const top = { x: 60, y: 50.75, r: 27 };
  const left = { x: 37.75, y: 71, r: 25 };
  const right = { x: 84.25, y: 73.25, r: 22.75 };
  const foot = left.y + left.r;
  const [lx, ly] = upperMeet(left.x, left.y, left.r, top.x, top.y, top.r);
  const [rx, ry] = upperMeet(top.x, top.y, top.r, right.x, right.y, right.r);
  return outline([
    arc(left.x, left.y, left.r, Math.PI / 2, angle(lx, ly, left.x, left.y)),
    arc(
      top.x,
      top.y,
      top.r,
      angle(lx, ly, top.x, top.y),
      angle(rx, ry, top.x, top.y),
    ),
    arc(
      right.x,
      right.y,
      right.r,
      angle(rx, ry, right.x, right.y),
      Math.PI / 2,
    ),
    line(right.x, foot, left.x, foot),
  ]);
}

/*
 * A disc with a second disc bitten out of its upper right, and both horns
 * rounded by a small circle tangent to the two. A tip's centre sits `R - rt`
 * from the moon's centre and `rk + rt` from the bite's, so it is where those
 * two circles cross.
 */
export function moon(): Outline {
  const B = { x: 60.5, y: 60, r: 39.5 };
  const bite = { x: 80.75, y: 39.25, r: 29.75 };
  const rt = 2.6;

  const dx = bite.x - B.x;
  const dy = bite.y - B.y;
  const d = Math.hypot(dx, dy);
  const r0 = B.r - rt;
  const r1 = bite.r + rt;
  const a = (r0 * r0 - r1 * r1 + d * d) / (2 * d);
  const h = Math.sqrt(r0 * r0 - a * a);
  const mx = B.x + (dx * a) / d;
  const my = B.y + (dy * a) / d;
  const one = { x: mx + (dy * h) / d, y: my - (dx * h) / d };
  const two = { x: mx - (dy * h) / d, y: my + (dx * h) / d };
  // the top horn and the right horn
  const [hornA, hornB] = one.y < two.y ? [one, two] : [two, one];

  const onMoon = (t: { x: number; y: number }) => angle(t.x, t.y, B.x, B.y);
  const onBite = (t: { x: number; y: number }) =>
    angle(t.x, t.y, bite.x, bite.y);
  // seen from a tip, the moon's rim lies away from the moon's centre, which
  // is `onMoon`, and the bite's rim lies toward the bite's centre
  const inward = (t: { x: number; y: number }) =>
    angle(bite.x, bite.y, t.x, t.y);

  return outline([
    arc(B.x, B.y, B.r, onMoon(hornB), onMoon(hornA)),
    arc(hornA.x, hornA.y, rt, onMoon(hornA), inward(hornA)),
    arc(bite.x, bite.y, bite.r, onBite(hornA), onBite(hornB), false),
    arc(hornB.x, hornB.y, rt, inward(hornB), onMoon(hornB)),
  ]);
}

/** A closed polygon through `corners`, wound clockwise on screen. */
export function polygon(corners: readonly [number, number][]): Outline {
  return outline(
    corners.map(([x0, y0], i) => {
      const [x1, y1] = corners[(i + 1) % corners.length];
      return line(x0, y0, x1, y1);
    }),
  );
}

/*
 * A drop is a round foot and two curves meeting in a small round tip.
 * `(cx, cy)` is the centre of the foot and `k` its size against a 16.4 unit
 * foot. The tip circle's tangent at 45 degrees is the direction the side
 * curves leave it in, so the joins are smooth.
 */
export function drop(cx: number, cy: number, k = 1): Outline {
  const r = 16.4;
  const P = (x: number, y: number): [number, number] => [
    cx + x * k,
    cy + y * k,
  ];
  return outline([
    arc(cx, cy - 23.15 * k, 2.05 * k, (5 * Math.PI) / 4, (7 * Math.PI) / 4),
    {
      kind: "cubic",
      p: [...P(1.45, -24.6), ...P(6.45, -19.6), ...P(r, -11), ...P(r, 0)],
    },
    arc(cx, cy, r * k, 0, Math.PI),
    {
      kind: "cubic",
      p: [...P(-r, 0), ...P(-r, -11), ...P(-6.45, -19.6), ...P(-1.45, -24.6)],
    },
  ]);
}
