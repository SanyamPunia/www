import { bezier } from "@/lib/bezier";
import { type Point, type Rect, rng, type Shape, strokes } from "./doodle";
import { GLYPHS, UNITS } from "./hand";
import { HAND, INK, type Mark, type Segment } from "./notes";

/*
 * The note laid out and turned into a timeline: every stroke the pen makes, in
 * page pixels, with when it starts, how long it takes, and how wide the ink is
 * at each point along it. Pure, so a resize is the same call with a new width,
 * and the renderer only ever reads what this returns.
 */

export type Kind = "ink" | "pen" | "marker";

export interface Line {
  kind: Kind;
  /** the colour it lands in */
  color: string;
  /** the colour it dries to, for the handwriting only */
  dry: string | null;
  /** x, y pairs */
  xy: Float32Array;
  /** the ink's width at each point */
  w: Float32Array;
  /** where each point falls along the stroke's own clock, 0 to 1 */
  at: Float32Array;
  /** maps the stroke's time, 0 to 1, onto `at` */
  ease: (t: number) => number;
  /** ms from the start of the note */
  start: number;
  dur: number;
}

export interface Plan {
  lines: Line[];
  /** when the last stroke lifts, ms */
  end: number;
  /** the pen's top speed, px a ms, for the sound */
  speed: number;
}

/** how long each mark takes to draw, ms */
const DRAW: Record<Shape, number> = {
  circle: 850,
  underline: 450,
  double: 700,
  strike: 320,
  zigzag: 600,
  highlight: 550,
};

/** the share of a mark the hand waits out before it writes on */
const HOLD = 0.7;

/** the reference's pen curve: fast off the mark, a long soft landing */
const FLICK = bezier(0.3, 0.9, 0.1, 1);
const STEADY = (t: number) => t;

/** the pen's speed along a straight stroke, in ems a second */
const SPEED = 28;

/** the ink's width, as a share of the em */
const NIB = 0.058;

/** letters sit this far apart beyond their own advance, ems */
const TRACK = 0.02;

/** the gap a circled run keeps each side, ems, so the loop passes between words */
const AIR = 0.26;

/** the pauses a hand makes, ms */
const LIFT = 25;
const LETTER = 25;
const WORD = 80;
const COMMA = 200;
const STOP = 380;
const RETURN = 160;

interface Char {
  ch: string;
  mark: number;
}

interface Placed {
  ch: string;
  mark: number;
  x: number;
  line: number;
  adv: number;
}

function adv(ch: string, size: number): number {
  return ((GLYPHS[ch]?.adv ?? 300) / UNITS + TRACK) * size;
}

/**
 * Breaks the note at its spaces, greedily. A circled run is one unit whatever
 * spaces it holds, since a loop goes round one line, and it keeps `AIR` clear
 * each side.
 */
function wrap(
  chars: readonly Char[],
  marks: readonly Mark[],
  width: number,
  size: number,
): Placed[] {
  const circled = (i: number) =>
    i >= 0 && i < chars.length && isCircled(chars[i], marks);
  const same = (a: number, b: number) =>
    circled(b) && chars[a].mark === chars[b].mark;
  const before = (i: number) =>
    circled(i) && !same(i, i - 1) ? AIR * size : 0;
  const after = (i: number) => (circled(i) && !same(i, i + 1) ? AIR * size : 0);

  const units: number[][] = [];
  let word: number[] = [];
  chars.forEach((c, i) => {
    if (c.ch === " " && !circled(i)) {
      if (word.length) units.push(word);
      units.push([i]);
      word = [];
    } else word.push(i);
  });
  if (word.length) units.push(word);

  const out: Placed[] = [];
  let x = 0;
  let line = 0;
  for (const unit of units) {
    const first = chars[unit[0]];
    if (first.ch === " " && !circled(unit[0])) {
      if (x === 0) continue;
      const a = adv(" ", size);
      out.push({ ...first, x, line, adv: a });
      x += a;
      continue;
    }
    const w = unit.reduce(
      (sum, i) => sum + before(i) + adv(chars[i].ch, size) + after(i),
      0,
    );
    if (x > 0 && x + w > width) {
      // the space that ended the last line hangs off it
      while (out.length && out[out.length - 1].ch === " ") out.pop();
      x = 0;
      line++;
    }
    for (const i of unit) {
      x += before(i);
      const a = adv(chars[i].ch, size);
      out.push({ ...chars[i], x, line, adv: a });
      x += a + after(i);
    }
  }
  return out;
}

function isCircled(c: Char, marks: readonly Mark[]): boolean {
  return c.mark >= 0 && marks[c.mark].shape === "circle";
}

/**
 * Rounds a polyline's corners, two passes of Chaikin's corner cutting with the
 * ends held. The font's paths are straight segments, and at the size the hand
 * is set at their joints read as points rather than as a pen going round.
 */
function smooth(pts: Point[]): Point[] {
  let out = pts;
  for (let pass = 0; pass < 2 && out.length > 2; pass++) {
    const next: Point[] = [out[0]];
    for (let i = 0; i < out.length - 1; i++) {
      const [x0, y0] = out[i];
      const [x1, y1] = out[i + 1];
      if (i > 0) next.push([0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1]);
      if (i < out.length - 2)
        next.push([0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1]);
    }
    next.push(out[out.length - 1]);
    out = next;
  }
  return out;
}

/** more points along a polyline, so the width can change inside a long segment */
function resample(pts: readonly Point[], step: number): Point[] {
  const out: Point[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let k = 1; k <= n; k++) {
      out.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n]);
    }
  }
  return out;
}

/**
 * One stroke of the hand. The pen slows into a turn, so a point's time is its
 * distance plus a cost for how sharply the path bends there, and the ink is
 * heavier where the pen is slow: pooled where it lands, thinner where it lifts.
 */
function handLine(
  pts: Point[],
  size: number,
  start: number,
  color: string,
  dry: string,
  press: number,
): Line {
  const n = pts.length;
  const xy = new Float32Array(n * 2);
  const w = new Float32Array(n);
  const at = new Float32Array(n);
  const dist = new Float32Array(n);
  const bend = new Float32Array(n);
  let cost = 0;
  const costs = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    xy[i * 2] = pts[i][0];
    xy[i * 2 + 1] = pts[i][1];
    if (i === 0) continue;
    const len = Math.hypot(
      pts[i][0] - pts[i - 1][0],
      pts[i][1] - pts[i - 1][1],
    );
    dist[i] = dist[i - 1] + len;
    if (i < n - 1) {
      const a = Math.atan2(
        pts[i][1] - pts[i - 1][1],
        pts[i][0] - pts[i - 1][0],
      );
      const b = Math.atan2(
        pts[i + 1][1] - pts[i][1],
        pts[i + 1][0] - pts[i][0],
      );
      let turn = Math.abs(b - a);
      if (turn > Math.PI) turn = 2 * Math.PI - turn;
      bend[i] = turn;
    }
    cost += len * (1 + (1.6 * (bend[i - 1] + bend[i])) / Math.PI);
    costs[i] = cost;
  }
  const total = dist[n - 1];
  const nib = NIB * size * press;
  for (let i = 0; i < n; i++) {
    at[i] = cost > 0 ? costs[i] / cost : i / Math.max(1, n - 1);
    const fromStart = dist[i];
    const toEnd = total - dist[i];
    const pool = 1 + 0.12 * Math.exp(-fromStart / (0.05 * size));
    const taper = 0.82 + 0.18 * Math.min(1, toEnd / (0.16 * size));
    const slow = 1 + 0.08 * Math.min(1, bend[i] / 0.8);
    w[i] = nib * pool * taper * slow;
  }
  // a dot is all landing
  if (total < 0.06 * size) w.fill(nib * 1.25);
  const dur = Math.max(45, ((cost / size) * 1000) / SPEED);
  return { kind: "ink", color, dry, xy, w, at, ease: STEADY, start, dur };
}

/** a mark's stroke: the pen's own curve over its length, tapering at both ends */
function markLine(
  pts: Point[],
  width: number,
  kind: Kind,
  color: string,
  start: number,
  dur: number,
): Line {
  const n = pts.length;
  const xy = new Float32Array(n * 2);
  const w = new Float32Array(n);
  const at = new Float32Array(n);
  const dist = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    xy[i * 2] = pts[i][0];
    xy[i * 2 + 1] = pts[i][1];
    if (i)
      dist[i] =
        dist[i - 1] +
        Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  }
  const total = dist[n - 1] || 1;
  for (let i = 0; i < n; i++) {
    at[i] = dist[i] / total;
    if (kind === "marker") {
      w[i] = width;
      continue;
    }
    const edge = Math.min(dist[i], total - dist[i]);
    w[i] = width * (0.55 + 0.45 * Math.min(1, edge / (3 * width)));
  }
  return { kind, color, dry: null, xy, w, at, ease: FLICK, start, dur };
}

/** `#rrggbb` mixed toward white, for a pen's second, lighter pass */
function lighten(hex: string, amount: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `rgb(${r} ${g} ${b})`;
}

/** the gap between baselines, and how far an ascender reaches above one, ems */
const LEADING = 1.42;
const ASCENT = 0.98;

/**
 * The page's grid of baselines: one every `LEADING`, phased off the middle of
 * the box. It depends on the box and the size alone and never on the note, so
 * the ruled lines hold still from note to note and every note snaps onto them.
 */
export function grid(
  box: { top: number; height: number },
  size: number,
): { leading: number; origin: number } {
  return { leading: size * LEADING, origin: box.top + box.height / 2 };
}

/**
 * Lays the note out in a box and writes the timeline. `size` is the em the hand
 * is set at, and `seed` keeps the hand's wobble the same on every visit.
 */
export function plan(
  note: readonly Segment[],
  box: { left: number; top: number; width: number; height: number },
  size: number,
  seed: string,
): Plan {
  const marks: Mark[] = [];
  const chars: Char[] = [];
  for (const s of note) {
    const text = (typeof s === "string" ? s : s.text).toLowerCase();
    const mark = typeof s === "string" ? -1 : marks.push(s.mark) - 1;
    for (const ch of text) chars.push({ ch, mark });
  }

  const placed = wrap(chars, marks, box.width, size);
  const lines = (placed[placed.length - 1]?.line ?? 0) + 1;
  const { leading, origin } = grid(box, size);
  // centred in the box, then snapped onto the page's own grid of baselines
  const centred = box.top + (box.height - lines * leading) / 2 + size * ASCENT;
  const baseline = origin + Math.round((centred - origin) / leading) * leading;
  const r = rng(seed);
  const s = size / UNITS;

  // each line drifts a little off the ruled line, as a hand does across a page
  const drift = Array.from({ length: lines }, () => (r() - 0.5) * 0.014);

  const out: Line[] = [];
  let t = 0;
  let row = 0;

  placed.forEach((p, i) => {
    if (p.line !== row) {
      row = p.line;
      t += RETURN;
    }
    const base = baseline + p.line * leading + drift[p.line] * p.x;
    const glyph = GLYPHS[p.ch];

    if (glyph?.strokes.length) {
      // no two letters the same: a nudge, a lean and a size
      const dx = (r() - 0.5) * 0.02 * size;
      const dy = (r() - 0.5) * 0.035 * size;
      const tilt = (r() - 0.5) * 0.06;
      const k = s * (0.96 + r() * 0.08);
      const cos = Math.cos(tilt);
      const sin = Math.sin(tilt);
      const press = 0.92 + r() * 0.16;
      const dry = HAND.dry[Math.floor(r() * HAND.dry.length)];
      const ox = box.left + p.x + dx;
      glyph.strokes.forEach((flat, j) => {
        if (j) t += LIFT;
        const pts: Point[] = [];
        for (let q = 0; q < flat.length; q += 2) {
          const gx = flat[q] * k;
          const gy = -flat[q + 1] * k;
          pts.push([ox + gx * cos - gy * sin, base + dy + gx * sin + gy * cos]);
        }
        const line = handLine(
          resample(smooth(pts), 1.5),
          size,
          t,
          HAND.wet,
          dry,
          press,
        );
        out.push(line);
        t += line.dur;
      });
      t += LETTER + r() * 25;
    } else if (p.ch === " ") {
      t += WORD + r() * 50;
    }
    if (p.ch === ",") t += COMMA;
    if (p.ch === "." || p.ch === "!" || p.ch === "?") t += STOP;

    // the pen goes back over a run once its last letter is down
    const next = placed[i + 1];
    if (p.mark >= 0 && next?.mark !== p.mark) {
      const mark = marks[p.mark];
      const rows = new Map<number, Rect>();
      for (const c of placed) {
        if (c.mark !== p.mark || c.ch === " ") continue;
        // a loop goes round the whole word, ascenders and descenders, where a
        // line only has to know where the x-height sits
        const loop = mark.shape === "circle";
        const y = baseline + c.line * leading - (loop ? 0.86 : 0.71) * size;
        const h = (loop ? 1.12 : 0.91) * size;
        const pad = loop ? 0.07 * size : 0;
        const x0 = box.left + c.x - pad;
        const x1 = box.left + c.x + c.adv + pad;
        const row = rows.get(c.line);
        if (!row) rows.set(c.line, { x: x0, y, w: x1 - x0, h });
        else row.w = Math.max(row.x + row.w, x1) - Math.min(row.x, x0);
      }
      const from = t + 110;
      const dur = DRAW[mark.shape];
      for (const st of strokes(
        mark.shape,
        [...rows.values()],
        size * 0.91,
        `${seed}:${p.mark}`,
      )) {
        const kind: Kind = mark.shape === "highlight" ? "marker" : "pen";
        const color =
          st.opacity < 1 ? lighten(INK[mark.ink], 0.3) : INK[mark.ink];
        out.push(
          markLine(
            resample(st.points, 2),
            st.width,
            kind,
            color,
            from + st.at * dur,
            st.span * dur,
          ),
        );
      }
      t = Math.max(t, from + dur * HOLD);
    }
  });

  const end = out.reduce((m, l) => Math.max(m, l.start + l.dur), 0);
  return { lines: out, end, speed: (SPEED * size) / 1000 };
}
