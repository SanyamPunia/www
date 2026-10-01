import type { Part, Scene } from "./scenes";
import { centroid, K, placed } from "./shapes";

/*
 * Turning one icon into another. Pure, no DOM.
 *
 * Every icon is a body and the small parts that belong to it, and every morph
 * is the same three moves:
 *
 * - the body turns into the next body, outline into outline,
 * - the old body's small parts go home, shrinking into the body behind it,
 * - the new body's small parts come out of it, growing from its centre.
 *
 * So the sun pulls its rays in, becomes the cloud, and the rain drips out of
 * the cloud, which is the shape of every other change in the set too.
 */

/** A part on screen, which mid-morph may be partly faded. */
export interface Live extends Part {
  op: number;
  body: boolean;
  /** each point's velocity in units a second, when it was caught mid-morph */
  vel?: number[];
}

type Kind = "body" | "home" | "out";

export interface Track {
  from: number[];
  to: number[];
  color: [string, string];
  opFrom: number;
  kind: Kind;
  /** seconds this track waits before it moves */
  delay: number;
  /** radians about the icon's centre, at the start and at the end */
  turn: [number, number];
  /** for a body: each point's path round the two centroids, see `polar` */
  polar: Polar | null;
  /** the velocity each point was caught with, carried into this track */
  kick: number[] | null;
}

/*
 * A body's points travel round its centre rather than straight across it. A
 * point on the far side of a cloud going to the far side of a snowflake cuts
 * through the middle in a straight line, so the middle frames of every body
 * morph crumpled into a smaller, lumpier shape. Each point keeps a distance
 * and an angle about a centroid that itself travels in a straight line, and
 * both of those are interpolated, so the shape stays full the whole way.
 */
interface Polar {
  from: [number, number];
  to: [number, number];
  r0: Float64Array;
  r1: Float64Array;
  a0: Float64Array;
  /** the turn each point makes, unwrapped along the loop so neighbours agree */
  da: Float64Array;
}

function polar(from: readonly number[], to: readonly number[]): Polar {
  const cf = centroid(from);
  const ct = centroid(to);
  const r0 = new Float64Array(K);
  const r1 = new Float64Array(K);
  const a0 = new Float64Array(K);
  const da = new Float64Array(K);
  for (let i = 0; i < K; i++) {
    const fx = from[i * 2] - cf[0];
    const fy = from[i * 2 + 1] - cf[1];
    const tx = to[i * 2] - ct[0];
    const ty = to[i * 2 + 1] - ct[1];
    r0[i] = Math.hypot(fx, fy);
    r1[i] = Math.hypot(tx, ty);
    a0[i] = Math.atan2(fy, fx);
    let d = Math.atan2(ty, tx) - a0[i];
    d = Math.atan2(Math.sin(d), Math.cos(d));
    // a neighbour that wrapped the other way round would tear the outline
    if (i > 0) {
      while (d - da[i - 1] > Math.PI) d -= Math.PI * 2;
      while (d - da[i - 1] < -Math.PI) d += Math.PI * 2;
    }
    da[i] = d;
  }
  return { from: cf, to: ct, r0, r1, a0, da };
}

/*
 * A press mid-morph carries each point's velocity into the next one, and lets
 * it die away over `TAU`. Without it the shape turns hard toward the new
 * target in one frame. The carried motion is added on top of the new path as
 * `v * t * exp(-t / TAU)`, which leaves at exactly `v`, peaks at `TAU` and is
 * a third of a unit from nothing by the time the path lands, so the landing is
 * the new target's. A press from rest, or in a morph's slow tail, has nothing
 * to carry and answers at full speed as before.
 */
const TAU = 0.08;

/*
 * A body's outline is smoothed in proportion to how far through the morph it
 * is, by a moving average round the loop, `SOFTEN` samples either side at the
 * peak. Mid-flight there is no shape to be faithful to, and the detail of the
 * two ends, a flake's branches or a cloud's notches, otherwise shows as bumps
 * all along the outline. On `sin(pi * e)`, so both ends are exact.
 */
const SOFTEN = 14;

/** A moving average `w` samples either side, round the closed loop. */
function box(pts: number[], w: number): number[] {
  if (w < 1) return pts;
  const out = new Array<number>(K * 2);
  let sx = 0;
  let sy = 0;
  for (let j = -w; j <= w; j++) {
    const k = (j + K) % K;
    sx += pts[k * 2];
    sy += pts[k * 2 + 1];
  }
  const span = 2 * w + 1;
  for (let i = 0; i < K; i++) {
    out[i * 2] = sx / span;
    out[i * 2 + 1] = sy / span;
    const add = (i + w + 1) % K;
    const drop = (i - w + K) % K;
    sx += pts[add * 2] - pts[drop * 2];
    sy += pts[add * 2 + 1] - pts[drop * 2 + 1];
  }
  return out;
}

/*
 * A fractional window blends the two whole ones either side of it, so the
 * softening ramps rather than stepping a sample at a time.
 */
function soften(pts: number[], n: number): number[] {
  if (n <= 0) return pts;
  const w = Math.floor(n);
  const f = n - w;
  const lo = box(pts, w);
  if (f === 0) return lo;
  const hi = box(pts, w + 1);
  for (let i = 0; i < K * 2; i++) lo[i] += (hi[i] - lo[i]) * f;
  return lo;
}

/*
 * The shape runs on a strong ease-out, which moves on the first frame after
 * the press and is two fifths of the way there by 50ms. It ran on a spring
 * before, and a spring released from rest starts slowly and gathers speed, so
 * every press looked answered a beat late however steady the frame rate was.
 */
const DURATION = 0.5;
const ease = bezier(0.22, 1, 0.36, 1);

/** How long a track takes, shape and fades, before it counts as landed. */
export const SETTLE = DURATION;
/** The clock the fades and the icon's breath run on. */
export const BEAT = 0.4;
/** The gap between one small part moving and the next. */
const STAGGER = 0.015;
/*
 * How long the new small parts wait: just long enough that the body has
 * started changing, so what they come out of is already the new shape.
 */
const EMIT = 0.04;
/** A small part's size at the centre of its body. */
const SEED = 0.2;

/*
 * Both outlines are wound the same way, so the only freedom left is where the
 * target's loop starts. The start that puts each point nearest its partner is
 * the one that stops the outline twisting through itself on the way. Measured
 * about each shape's own centroid.
 */
function align(from: readonly number[], to: readonly number[]): number[] {
  const [fx, fy] = centroid(from);
  const [tx, ty] = centroid(to);
  let best = 0;
  let bestCost = Number.POSITIVE_INFINITY;
  for (let o = 0; o < K; o++) {
    let cost = 0;
    for (let i = 0; i < K && cost < bestCost; i++) {
      const j = (i + o) % K;
      const dx = from[i * 2] - fx - (to[j * 2] - tx);
      const dy = from[i * 2 + 1] - fy - (to[j * 2 + 1] - ty);
      cost += dx * dx + dy * dy;
    }
    if (cost < bestCost) {
      bestCost = cost;
      best = o;
    }
  }
  const out = new Array<number>(K * 2);
  for (let i = 0; i < K; i++) {
    const j = (i + best) % K;
    out[i * 2] = to[j * 2];
    out[i * 2 + 1] = to[j * 2 + 1];
  }
  return out;
}

/** Clockwise from straight up, about the icon's centre. */
const bearing = (pts: readonly number[]) => {
  const [x, y] = centroid(pts);
  return (Math.atan2(x - 60, -(y - 60)) + Math.PI * 2) % (Math.PI * 2);
};

/**
 * `source` is what is on screen, so a press mid-morph starts from the shapes
 * as they are that frame. `spin` is the outgoing scene's, so rays wind in the
 * way they bloomed out.
 */
export function plan(
  source: readonly Live[],
  spin: number,
  target: Scene,
): Track[] {
  const body = source.find((p) => p.body) ?? source[0];
  // both ways run through where the body ends up. Aiming the parts going home
  // at where it started left the sun's rays poking out under the cloud, since
  // the disc's centre is lower than the cloud's
  const [ox, oy] = centroid(target.body.pts);

  // going home runs anticlockwise, the bloom played back, and coming out
  // runs clockwise from the top
  const home = source
    .filter((p) => p !== body)
    .sort((a, b) => bearing(b.pts) - bearing(a.pts))
    .map(
      (p, k): Track => ({
        from: p.pts,
        to: placed(p.pts, SEED, ox, oy),
        color: [p.color, p.color],
        opFrom: p.op,
        kind: "home",
        delay: k * STAGGER,
        turn: [0, -spin],
        polar: null,
        kick: p.vel ?? null,
      }),
    );

  const out = [...target.satellites]
    .sort((a, b) => bearing(a.pts) - bearing(b.pts))
    .map(
      (p, k): Track => ({
        from: placed(p.pts, SEED, ox, oy),
        to: p.pts,
        color: [p.color, p.color],
        opFrom: 0,
        kind: "out",
        delay: EMIT + k * STAGGER,
        turn: [target.spin, 0],
        polar: null,
        kick: null,
      }),
    );

  const to = align(body.pts, target.body.pts);
  const morph: Track = {
    from: body.pts,
    to,
    color: [body.color, target.body.color],
    opFrom: body.op,
    kind: "body",
    delay: 0,
    turn: [0, 0],
    polar: polar(body.pts, to),
    kick: body.vel ?? null,
  };

  // the small parts paint first, so they sit under the body: a ray comes out
  // from behind the disc and a drop out from under the cloud
  return [...home, ...out, morph];
}

export function duration(tracks: readonly Track[]): number {
  let last = 0;
  for (const tr of tracks) last = Math.max(last, tr.delay);
  return last + SETTLE;
}

/*
 * In oklab, so amber into blue passes through a muted grey rather than the
 * muddy brown an sRGB mix finds. A press mid-morph mixes from a colour that is
 * itself a mix, which `color-mix` nests without complaint.
 */
function blendColor(from: string, to: string, c: number): string {
  if (c <= 0 || from === to) return from;
  if (c >= 1) return to;
  return `color-mix(in oklab, ${from}, ${to} ${(c * 100).toFixed(1)}%)`;
}

/** A cubic-bezier easing, solved by bisection on x. */
function bezier(x1: number, y1: number, x2: number, y2: number) {
  const at = (a: number, b: number, s: number) => {
    const u = 1 - s;
    return 3 * u * u * s * a + 3 * u * s * s * b + s * s * s;
  };
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 24; i++) {
      const m = (lo + hi) / 2;
      if (at(x1, x2, m) < x) lo = m;
      else hi = m;
    }
    return at(y1, y2, (lo + hi) / 2);
  };
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/*
 * `clock` is seconds since the press. Each track reads it less its own delay.
 * The shape and the colour follow the ease, and the fades run on linear time and are done well before the
 * shape lands: a part coming out is solid by the time it has cleared its body,
 * and a part going home is gone by the time it is out of sight behind it.
 */
export function sample(tracks: readonly Track[], clock: number): Live[] {
  return tracks.map((tr) => {
    const local = Math.max(0, clock - tr.delay);
    const e = ease(Math.min(1, local / DURATION));
    const beat = local / BEAT;

    const pts = new Array<number>(K * 2);
    const P = tr.polar;
    if (P) {
      const cx = P.from[0] + (P.to[0] - P.from[0]) * e;
      const cy = P.from[1] + (P.to[1] - P.from[1]) * e;
      for (let i = 0; i < K; i++) {
        const r = P.r0[i] + (P.r1[i] - P.r0[i]) * e;
        const a = P.a0[i] + P.da[i] * e;
        pts[i * 2] = cx + r * Math.cos(a);
        pts[i * 2 + 1] = cy + r * Math.sin(a);
      }
    } else {
      const turn = tr.turn[0] + (tr.turn[1] - tr.turn[0]) * e;
      const cos = Math.cos(turn);
      const sin = Math.sin(turn);
      for (let i = 0; i < K; i++) {
        const x = tr.from[i * 2] + (tr.to[i * 2] - tr.from[i * 2]) * e - 60;
        const y =
          tr.from[i * 2 + 1] + (tr.to[i * 2 + 1] - tr.from[i * 2 + 1]) * e - 60;
        pts[i * 2] = 60 + x * cos + y * sin;
        pts[i * 2 + 1] = 60 - x * sin + y * cos;
      }
    }
    let shaped = pts;
    if (P) shaped = soften(pts, SOFTEN * Math.sin(Math.PI * Math.min(1, e)));
    // the carried motion runs on the press's own clock, so a part waiting on
    // its stagger keeps moving the way it was going rather than stopping
    if (tr.kick) {
      const k = clock * Math.exp(-clock / TAU);
      for (let i = 0; i < K * 2; i++) shaped[i] += tr.kick[i] * k;
    }

    const op =
      tr.kind === "body"
        ? tr.opFrom + (1 - tr.opFrom) * e
        : tr.kind === "out"
          ? smoothstep(0, 0.45, beat)
          : tr.opFrom * (1 - smoothstep(0.05, 0.55, beat));

    return {
      pts: shaped,
      color: blendColor(tr.color[0], tr.color[1], e),
      op,
      body: tr.kind === "body",
    };
  });
}

/*
 * Quadratic curves through the midpoints of the samples, with each sample as
 * the control point. Smooth everywhere, and a sharp corner, which the cloud's
 * two notches are, comes out softened by about one sample's length.
 */
export function toPath(pts: readonly number[]): string {
  const mid = (i: number) => {
    const j = (i + 1) % K;
    return `${((pts[i * 2] + pts[j * 2]) / 2).toFixed(2)} ${((pts[i * 2 + 1] + pts[j * 2 + 1]) / 2).toFixed(2)}`;
  };
  let d = `M${mid(K - 1)}`;
  for (let i = 0; i < K; i++) {
    d += `Q${pts[i * 2].toFixed(2)} ${pts[i * 2 + 1].toFixed(2)} ${mid(i)}`;
  }
  return `${d}Z`;
}
