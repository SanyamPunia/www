/**
 * The sheet, pure and DOM-free: where every bubble is, how much air it holds,
 * and what a finger pressing on it does to that air.
 *
 * A bubble is a dome of film, `h = H (1 - r²/a²)^PROFILE`, sealed round its
 * rim with a fixed amount of air inside it. A finger is a sphere coming down on
 * it, and the film cannot pass through the finger, so the film's height is the
 * lower of the two. That takes volume away, and the air answers by Boyle's law:
 * the same air in less room is at a higher pressure. The film answers the
 * pressure by stretching, which pushes the part of the dome the finger is not
 * on further up. So the bubble tightens and bulges as it is squeezed, and it
 * bursts when the pressure passes what its film can hold.
 *
 * Nothing here is animated by a clock. A pop is the pressure crossing a
 * threshold on the frame the finger got deep enough, so a slow press pops late
 * and a fast one pops early, and a finger dragged across a row at depth pops
 * them one after another.
 */

export const COLS = 13;
export const ROWS = 8;
export const COUNT = COLS * ROWS;

/** a bubble's radius as a share of the pitch between centres */
export const RADIUS = 0.42;
/** a full dome's height as a share of its radius */
export const RISE = 0.56;
/** the dome's profile, `h = H (1 - r²/a²)^PROFILE`: under 1 is a soft base */
export const PROFILE = 0.62;
/** the film past the outer bubbles, as a share of the pitch */
const BORDER = 0.32;
/** rows sit this far apart, since the grid is hexagonal */
export const ROW_H = Math.sqrt(3) / 2;

/**
 * How stiff the film is once it is taut, `P - 1 = STRETCH (s - 1)`, where `s`
 * is how far the dome has grown past its rest height. At 3.2 a bubble bursting
 * at 1.9 atmospheres has bulged by 28% first, which is the tightening a thumb
 * feels before the pop.
 */
export const STRETCH = 3.2;
/** what a bubble can hold, in atmospheres, before its film gives */
const BURST_MIN = 1.62;
const BURST_SPREAD = 0.62;
/** a share of bubbles come off the roll with a pinhole and never pop */
const DUDS = 0.06;
/** a dud lets air out past this pressure rather than bursting */
const DUD_CAP = 1.28;
/**
 * A dud squeezed below this much air is spent, and counts as done. A thumb at
 * the box still leaves about 0.4 of a dome's volume round its rim, which caps a
 * dud at about half its air, so this has to sit above that.
 */
const DUD_SPENT = 0.6;
/** how long a burst dome takes to fall in, in seconds */
export const COLLAPSE = 0.055;
/** a bubble's wobble after a pop beside it or a press coming off it */
const WOBBLE_HZ = 11;
const WOBBLE_TAU = 0.19;

/** the sheet's tilt on the box, in radians, since nobody lays it square */
const TILT = -0.036;

/** an integer hash to [0, 1), since `Math.sin` hashes degenerate on small ints */
export function hash(n: number): number {
  let x = (n | 0) ^ 0x9e3779b9;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

export interface Layout {
  stageW: number;
  stageH: number;
  pitch: number;
  radius: number;
  /** the sheet's own size */
  w: number;
  h: number;
  /** the sheet's centre on the stage */
  cx: number;
  cy: number;
  angle: number;
  cos: number;
  sin: number;
  /** the first bubble's centre, in sheet coordinates */
  x0: number;
  y0: number;
}

/**
 * The sheet takes 84% of the stage's width or 74% of its height, whichever
 * binds first, and sits a little left of centre and a little low, so the
 * label it lies over peeks out past its right edge.
 */
export function layout(stageW: number, stageH: number): Layout {
  const across = COLS + 0.5 - 1 + 2 * BORDER + 2 * RADIUS;
  const down = (ROWS - 1) * ROW_H + 2 * BORDER + 2 * RADIUS;
  const pitch = Math.min((stageW * 0.84) / across, (stageH * 0.74) / down);
  const radius = pitch * RADIUS;
  return {
    stageW,
    stageH,
    pitch,
    radius,
    w: pitch * across,
    h: pitch * down,
    cx: stageW * 0.485,
    cy: stageH * 0.51,
    angle: TILT,
    cos: Math.cos(TILT),
    sin: Math.sin(TILT),
    x0: pitch * BORDER + radius,
    y0: pitch * BORDER + radius,
  };
}

/** a point on the stage, in the sheet's own coordinates */
export function toSheet(
  l: Layout,
  x: number,
  y: number,
  slide = 0,
): [number, number] {
  const dx = x - l.cx - slide;
  const dy = y - l.cy;
  return [
    l.cos * dx + l.sin * dy + l.w / 2,
    -l.sin * dx + l.cos * dy + l.h / 2,
  ];
}

/** a point on the sheet, on the stage */
export function toStage(l: Layout, x: number, y: number): [number, number] {
  const dx = x - l.w / 2;
  const dy = y - l.h / 2;
  return [l.cx + l.cos * dx - l.sin * dy, l.cy + l.sin * dx + l.cos * dy];
}

export function onSheet(l: Layout, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x <= l.w && y <= l.h;
}

export interface Bubble {
  col: number;
  row: number;
  x: number;
  y: number;
  a: number;
  seed: number;
  /** air held, 1 for a full bubble */
  m: number;
  /** the dome's height as a share of its rest height */
  s: number;
  /** pressure, in atmospheres */
  p: number;
  burst: number;
  dud: boolean;
  popped: boolean;
  poppedAt: number;
  /** its height when it went, so the collapse starts from there */
  sAtPop: number;
  /** a dud squeezed flat */
  spent: boolean;
  wob: number;
  wobAt: number;
  /** the most volume the current press took, 0 to 1 */
  squeeze: number;
  /** a finger was on it last frame */
  touched: boolean;
  /** it has hissed in this press */
  hissed: boolean;
}

/**
 * A fresh sheet. `round` reseeds it, so every new sheet has its duds and its
 * strong bubbles somewhere else. Each bubble is moulded a few percent off true,
 * in size and place, since a sheet off a real roll is.
 */
export function sheet(l: Layout, round: number): Bubble[] {
  const out: Bubble[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const i = row * COLS + col;
      const k = round * 1009 + i * 7;
      const dud = hash(k + 1) < DUDS;
      out.push({
        col,
        row,
        x:
          l.x0 +
          l.pitch * (col + (row % 2) * 0.5) +
          (hash(k + 2) - 0.5) * l.pitch * 0.035,
        y: l.y0 + l.pitch * ROW_H * row + (hash(k + 3) - 0.5) * l.pitch * 0.035,
        a: l.radius * (0.975 + 0.05 * hash(k + 4)),
        seed: hash(k + 5),
        m: dud ? 0.8 + 0.1 * hash(k + 6) : 1,
        s: dud ? 0.8 + 0.1 * hash(k + 6) : 1,
        p: 1,
        burst: BURST_MIN + BURST_SPREAD * hash(k + 7),
        dud,
        popped: false,
        poppedAt: 0,
        sAtPop: 1,
        spent: false,
        wob: 0,
        wobAt: 0,
        squeeze: 0,
        touched: false,
        hissed: false,
      });
    }
  }
  return out;
}

/** a fingertip: a sphere of radius `r` whose lowest point is `z` off the box */
export interface Contact {
  x: number;
  y: number;
  z: number;
  r: number;
}

/*
 * The volume under a dome is summed on a polar grid over the unit disc: seven
 * rings, sixteen spokes, each sample weighted by the area it stands for. 112
 * samples is far more than the shape needs and costs nothing, since only the
 * few bubbles under a finger are ever summed.
 */
const RINGS = 7;
const SPOKES = 16;
const SU: number[] = [];
const SV: number[] = [];
const SW: number[] = [];
const SB: number[] = [];
let REST = 0;
for (let i = 0; i < RINGS; i++) {
  const r0 = i / RINGS;
  const r1 = (i + 1) / RINGS;
  const r = (r0 + r1) / 2;
  const area = (r1 * r1 - r0 * r0) / SPOKES;
  for (let j = 0; j < SPOKES; j++) {
    const t = ((j + (i % 2) * 0.5) / SPOKES) * Math.PI * 2;
    SU.push(Math.cos(t) * r);
    SV.push(Math.sin(t) * r);
    SW.push(area);
    const base = (1 - r * r) ** PROFILE;
    SB.push(base);
    REST += area * base;
  }
}

/** the film's height under a fingertip at a point, or Infinity off it */
function finger(c: Contact, x: number, y: number): number {
  const dx = x - c.x;
  const dy = y - c.y;
  const d2 = dx * dx + dy * dy;
  if (d2 >= c.r * c.r) return Number.POSITIVE_INFINITY;
  return c.z + c.r - Math.sqrt(c.r * c.r - d2);
}

/** the dome's volume at height scale `s` with these fingers on it, 1 at rest */
function volume(b: Bubble, s: number, contacts: readonly Contact[]): number {
  const top = b.a * RISE;
  let v = 0;
  for (let k = 0; k < SW.length; k++) {
    const x = b.x + SU[k] * b.a;
    const y = b.y + SV[k] * b.a;
    let h = top * s * SB[k];
    for (const c of contacts) {
      const f = finger(c, x, y);
      if (f < h) h = f;
    }
    if (h > 0) v += SW[k] * h;
  }
  return v / (top * REST);
}

/**
 * Where a squeezed bubble settles: the dome height at which the air's pressure,
 * `m / V`, is what the stretched film pushes back with. The left side falls as
 * the dome grows and the right side rises, so there is one crossing and a
 * bisection finds it. A slack bubble, holding less air than its rest volume,
 * settles lower than its rest height at one atmosphere.
 */
function settle(
  b: Bubble,
  contacts: readonly Contact[],
): { s: number; p: number; v: number } {
  let lo = 0.02;
  let hi = 2.6;
  for (let k = 0; k < 16; k++) {
    const mid = (lo + hi) / 2;
    const v = Math.max(volume(b, mid, contacts), 1e-4);
    const f = b.m / v - (1 + STRETCH * Math.max(0, mid - 1));
    if (f > 0) lo = mid;
    else hi = mid;
  }
  const s = (lo + hi) / 2;
  const v = Math.max(volume(b, s, contacts), 1e-4);
  return { s, p: b.m / v, v };
}

export type BubbleEvent =
  | { kind: "pop"; i: number; strength: number }
  | { kind: "hiss"; i: number }
  | { kind: "spent"; i: number };

/** whether a fingertip is low enough and near enough to be on a dome */
function reaches(b: Bubble, c: Contact): boolean {
  const dx = b.x - c.x;
  const dy = b.y - c.y;
  const reach = b.a + c.r;
  return dx * dx + dy * dy < reach * reach && c.z < b.a * RISE * 1.6;
}

/**
 * One frame of every bubble a finger is on. Returns whether anything is still
 * moving, so the loop knows when to stop asking for frames.
 */
export function step(
  bubbles: Bubble[],
  contacts: readonly Contact[],
  now: number,
  reduce: boolean,
  events: BubbleEvent[],
): boolean {
  let moving = contacts.length > 0;
  for (let i = 0; i < bubbles.length; i++) {
    const b = bubbles[i];
    const on = contacts.filter((c) => reaches(b, c));

    if (b.popped) {
      if (now - b.poppedAt < COLLAPSE) moving = true;
    } else if (on.length > 0) {
      const { s, p, v } = settle(b, on);
      b.s = s;
      b.p = p;
      b.squeeze = Math.max(b.squeeze, 1 - Math.min(1, v / Math.max(b.m, 1e-3)));
      if (b.dud) {
        /* a pinhole: past its cap the air goes out rather than the film */
        if (p > DUD_CAP) {
          b.m *= DUD_CAP / p;
          b.p = DUD_CAP;
          if (!b.hissed) {
            b.hissed = true;
            events.push({ kind: "hiss", i });
          }
        }
        if (!b.spent && b.m < DUD_SPENT) {
          b.spent = true;
          events.push({ kind: "spent", i });
        }
      } else if (p > b.burst) {
        b.popped = true;
        b.poppedAt = now;
        b.sAtPop = s;
        b.m = 0;
        b.p = 1;
        events.push({
          kind: "pop",
          i,
          strength: Math.min(1, 0.55 + (b.burst - BURST_MIN) / BURST_SPREAD),
        });
        if (!reduce) knock(bubbles, i, now);
      }
      b.touched = true;
    } else if (b.touched) {
      /* the finger came off: the dome springs back and rings */
      b.touched = false;
      b.hissed = false;
      b.s = Math.min(b.m, 1);
      b.p = 1;
      if (!reduce && b.squeeze > 0.04) {
        b.wob = 0.1 * b.squeeze;
        b.wobAt = now;
      }
      b.squeeze = 0;
    }
    if (b.wob > 0) {
      if (b.wob * Math.exp(-(now - b.wobAt) / WOBBLE_TAU) < 0.002) b.wob = 0;
      else moving = true;
    }
  }
  return moving;
}

/** a burst is a shock through the sheet, and the bubbles beside it quiver */
function knock(bubbles: Bubble[], i: number, now: number): void {
  const src = bubbles[i];
  const pitch = src.a / RADIUS;
  for (const b of bubbles) {
    if (b === src || b.popped) continue;
    const d = Math.hypot(b.x - src.x, b.y - src.y) / pitch;
    if (d > 2.3) continue;
    b.wob = Math.max(b.wob, 0.055 / d);
    b.wobAt = now;
  }
}

/** the dome's height as the shader should draw it right now */
export function shown(b: Bubble, now: number): number {
  if (b.popped) return b.sAtPop;
  if (b.wob === 0) return b.s;
  const t = now - b.wobAt;
  return (
    b.s *
    (1 +
      b.wob * Math.sin(2 * Math.PI * WOBBLE_HZ * t) * Math.exp(-t / WOBBLE_TAU))
  );
}

/** how far a burst dome has fallen in, 0 to 1, eased */
export function fallen(b: Bubble, now: number, reduce: boolean): number {
  if (!b.popped) return 0;
  if (reduce) return 1;
  const t = Math.min(1, (now - b.poppedAt) / COLLAPSE);
  return 1 - (1 - t) ** 3;
}

/** bubbles still worth pressing: not popped, and not a dud squeezed flat */
export function left(bubbles: readonly Bubble[]): number {
  let n = 0;
  for (const b of bubbles) if (!b.popped && !b.spent) n++;
  return n;
}

/** the film's height at a point, for where a fresh press lands */
export function filmHeight(
  bubbles: readonly Bubble[],
  x: number,
  y: number,
): number {
  for (const b of bubbles) {
    const r2 = ((x - b.x) ** 2 + (y - b.y) ** 2) / (b.a * b.a);
    if (r2 >= 1) continue;
    const top = b.a * RISE;
    if (b.popped) return top * 0.14;
    return top * b.s * (1 - r2) ** PROFILE;
  }
  return 0;
}

/** the bubble under a point, or -1 */
export function under(
  bubbles: readonly Bubble[],
  x: number,
  y: number,
): number {
  for (let i = 0; i < bubbles.length; i++) {
    const b = bubbles[i];
    if ((x - b.x) ** 2 + (y - b.y) ** 2 < b.a * b.a) return i;
  }
  return -1;
}
