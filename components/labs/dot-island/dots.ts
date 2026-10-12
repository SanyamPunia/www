import type { Item, Tone } from "./scenes";

/**
 * The lit dots and how they get from one scene to the next. Pure apart from the
 * contexts `paint` is handed.
 *
 * A dot lives in cell units, so the panel can be any size and nothing here
 * knows about pixels until it paints. Every move is a straight line with a
 * slight bow, eased out, and it lands on a cell: in flight a dot can be
 * anywhere, at rest it is always on the grid.
 */

export type RGBA = [number, number, number, number];

export interface Dot {
  key: string;
  fx: number;
  fy: number;
  tx: number;
  ty: number;
  /** when the move starts, after its stagger, and how long it takes */
  start: number;
  dur: number;
  /** how far the path bows sideways at its middle, in cells */
  bow: number;
  /** 1 for a dot that comes from nothing, so it grows as it travels */
  born: boolean;
  /** a dot that merges into another at the end of its move and is gone */
  die: boolean;
  c0: RGBA;
  c1: RGBA;
  cStart: number;
  tone: Tone;
  /** whether landing should tick: it moved, and the move was not a quiet one */
  ticks: boolean;
  landed: boolean;
}

export interface Snap {
  x: number;
  y: number;
  c: RGBA;
  scale: number;
}

/** how long a tone takes to change, which is an LED fading rather than a cut */
const TONE_MS = 160;

const ease = (t: number) => 1 - (1 - t) ** 3;

function mix(a: RGBA, b: RGBA, k: number): RGBA {
  return [
    a[0] + (b[0] - a[0]) * k,
    a[1] + (b[1] - a[1]) * k,
    a[2] + (b[2] - a[2]) * k,
    a[3] + (b[3] - a[3]) * k,
  ];
}

export function progress(d: Dot, now: number): number {
  if (d.dur <= 0) return now >= d.start ? 1 : 0;
  return Math.min(1, Math.max(0, (now - d.start) / d.dur));
}

export function snap(d: Dot, now: number): Snap {
  const e = ease(progress(d, now));
  const dx = d.tx - d.fx;
  const dy = d.ty - d.fy;
  const len = Math.hypot(dx, dy) || 1;
  const arc = Math.sin(Math.PI * e) * d.bow;
  const k = Math.min(1, Math.max(0, (now - d.cStart) / TONE_MS));
  let scale = 1;
  if (d.born) scale = Math.min(1, e * 1.4);
  /* a dying dot holds its size most of the way and shrinks into its target */
  if (d.die) scale = 1 - Math.max(0, (e - 0.55) / 0.45);
  return {
    x: d.fx + dx * e - (dy / len) * arc,
    y: d.fy + dy * e + (dx / len) * arc,
    c: mix(d.c0, d.c1, k),
    scale,
  };
}

export function inFlight(d: Dot, now: number): boolean {
  return progress(d, now) < 1;
}

interface Source {
  x: number;
  y: number;
  c: RGBA;
}

interface Target {
  x: number;
  y: number;
  tone: Tone;
}

export interface MorphOptions {
  now: number;
  palette: Record<Tone, RGBA>;
  /** the left-to-right sweep across the whole move, in ms */
  spread: number;
  /** no tick when these land, for a timer turning over */
  quiet: boolean;
}

/** a small stable hash, so the stagger's jitter and the bows never shimmer */
function hash(a: number, b: number): number {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const byX = (p: { x: number; y: number }, q: { x: number; y: number }) =>
  p.x - q.x || p.y - q.y;

function nearest<T extends { x: number; y: number }>(
  list: T[],
  x: number,
  y: number,
): T {
  let best = 0;
  let bestD = Number.POSITIVE_INFINITY;
  for (let i = 0; i < list.length; i++) {
    const d = (list[i].x - x) ** 2 + (list[i].y - y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return list[best];
}

/**
 * One planned move, before the stagger is known. `born` and `die` are decided
 * here, since they depend on how the two sets paired.
 */
interface Plan {
  key: string;
  from: Source;
  to: Target;
  born: boolean;
  die: boolean;
}

/**
 * Pair a set of dots with a set of cells.
 *
 * - **A dot already on a cell it is wanted on stays there.** That is what lets a
 *   timer turn `5` into `6` by moving only the cells that differ.
 * - **The rest are paired by rank, left to right.** Sorting both sides on x and
 *   pairing in order means no two dots cross on the horizontal, so a word
 *   turning into another word reads as its columns reshuffling rather than as a
 *   swarm. Vertical crossings are allowed, and at seven rows they do not read.
 * - **Uneven counts split and merge, they never pop.** More cells than dots and
 *   some dots are used twice, the second copy growing out of the first. More
 *   dots than cells and the spare ones fly to a cell already taken and shrink
 *   into it. Every new dot comes from somewhere and every old one goes somewhere.
 */
function pair(
  key: string,
  sources: Source[],
  targets: Target[],
  out: Plan[],
): void {
  const free = new Map<string, Source[]>();
  for (const s of sources) {
    if (Math.abs(s.x - Math.round(s.x)) > 1e-3) continue;
    if (Math.abs(s.y - Math.round(s.y)) > 1e-3) continue;
    const id = `${Math.round(s.x)},${Math.round(s.y)}`;
    const list = free.get(id);
    if (list) list.push(s);
    else free.set(id, [s]);
  }
  const used = new Set<Source>();
  const left: Target[] = [];
  for (const t of targets) {
    const s = free.get(`${t.x},${t.y}`)?.pop();
    if (s) {
      used.add(s);
      out.push({ key, from: s, to: t, born: false, die: false });
    } else left.push(t);
  }
  const rest = sources.filter((s) => !used.has(s)).sort(byX);
  left.sort(byX);

  if (left.length === 0) {
    /* nothing left to go to: merge into the nearest cell kept, or fade */
    for (const s of rest) {
      const t = targets.length
        ? nearest(targets, s.x, s.y)
        : { x: Math.round(s.x), y: Math.round(s.y), tone: "on" as Tone };
      out.push({ key, from: s, to: t, born: false, die: true });
    }
    return;
  }
  if (rest.length === 0) {
    /* nothing left to come from: grow out of the nearest dot, or in place */
    for (const t of left) {
      const s = sources.length
        ? nearest(sources, t.x, t.y)
        : ({ x: t.x, y: t.y, c: [0, 0, 0, 0] } as Source);
      out.push({ key, from: s, to: t, born: true, die: false });
    }
    return;
  }
  if (left.length >= rest.length) {
    let last = -1;
    left.forEach((t, j) => {
      const i = Math.floor((j * rest.length) / left.length);
      out.push({ key, from: rest[i], to: t, born: i === last, die: false });
      last = i;
    });
  } else {
    let last = -1;
    rest.forEach((s, i) => {
      const j = Math.floor((i * left.length) / rest.length);
      out.push({ key, from: s, to: left[j], born: false, die: j === last });
      last = j;
    });
  }
}

/**
 * Move the panel from the dots it has to the items it is asked for.
 *
 * Items whose key is already on the panel pair with their own dots. What is
 * left on both sides, the dots of items that are going and the cells of items
 * that are new, pairs as one pool. `only` limits the move to a few keys and
 * leaves every other dot where it is, which is how a timer digit turns over
 * without the rest of the panel noticing.
 */
export function morph(
  dots: Dot[],
  items: Item[],
  options: MorphOptions,
  only?: Set<string>,
): Dot[] {
  const { now, palette, spread, quiet } = options;
  const kept: Dot[] = [];
  const byKey = new Map<string, Source[]>();
  for (const d of dots) {
    /* a dot still merging away finishes on its own and is never reused */
    if (d.die || (only && !only.has(d.key))) {
      kept.push(d);
      continue;
    }
    const s = snap(d, now);
    const list = byKey.get(d.key) ?? [];
    list.push({ x: s.x, y: s.y, c: s.c });
    byKey.set(d.key, list);
  }

  const plans: Plan[] = [];
  const pool: Source[] = [];
  const fresh: Target[] = [];
  const freshKeys: string[] = [];
  const wanted = only ? items.filter((i) => only.has(i.key)) : items;
  const keys = new Set(wanted.map((i) => i.key));

  for (const item of wanted) {
    const targets = item.cells.map(([x, y], i) => ({
      x,
      y,
      tone: item.tones[i],
    }));
    const sources = byKey.get(item.key);
    if (sources?.length) pair(item.key, sources, targets, plans);
    else
      for (const t of targets) {
        fresh.push(t);
        freshKeys.push(item.key);
      }
  }
  for (const [key, sources] of byKey) if (!keys.has(key)) pool.push(...sources);

  /*
   * The pool pairs as one set, and each new dot takes its target's key. When
   * one side of it is empty the other still has to go somewhere: dots of a
   * row that is leaving with nothing new to become merge into the cells that
   * stay, and cells of a new item with nothing leaving grow out of the nearest
   * dot on the panel. Either way nothing pops in or out in place, which is
   * what a row dropping out of a menu did before this.
   */
  const pooled: Plan[] = [];
  const everywhere = [...byKey.values()].flat();
  if (pool.length && fresh.length) pair("", pool, fresh, pooled);
  else if (fresh.length)
    for (const t of fresh) {
      const s = everywhere.length
        ? nearest(everywhere, t.x, t.y)
        : ({ x: t.x, y: t.y, c: [0, 0, 0, 0] } as Source);
      pooled.push({ key: "", from: s, to: t, born: true, die: false });
    }
  else if (pool.length) {
    const ends = wanted
      .flatMap((item) =>
        item.cells.map(([x, y], i) => ({ x, y, tone: item.tones[i] })),
      )
      .sort(byX);
    pool.sort(byX).forEach((s, i) => {
      const to = ends.length
        ? ends[Math.floor((i * ends.length) / pool.length)]
        : { x: Math.round(s.x), y: Math.round(s.y), tone: "on" as Tone };
      pooled.push({ key: "", from: s, to, born: false, die: true });
    });
  }
  for (const p of pooled) {
    const i = fresh.indexOf(p.to);
    if (i >= 0) p.key = freshKeys[i];
    plans.push(p);
  }

  /* the sweep runs left to right across everything that moves */
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const p of plans) {
    min = Math.min(min, p.to.x);
    max = Math.max(max, p.to.x);
  }
  const span = Math.max(1, max - min);

  const next = kept;
  for (const p of plans) {
    const dist = Math.hypot(p.to.x - p.from.x, p.to.y - p.from.y);
    const moves = dist > 0.01 || p.born;
    const delay = moves
      ? ((p.to.x - min) / span) * spread + hash(p.to.x, p.to.y) * spread * 0.25
      : 0;
    const target = palette[p.to.tone];
    next.push({
      key: p.key,
      fx: p.from.x,
      fy: p.from.y,
      tx: p.to.x,
      ty: p.to.y,
      start: now + delay,
      /* a longer trip takes longer, but by its square root, so a dot crossing
         the panel is not four times slower than one moving a letter over */
      dur: moves ? Math.min(520, 220 + 60 * Math.sqrt(dist)) : 0,
      bow: (hash(p.to.y, p.to.x) - 0.5) * Math.min(3, dist * 0.18),
      born: p.born,
      die: p.die,
      c0: p.born ? [target[0], target[1], target[2], 0] : p.from.c,
      c1: target,
      cStart: now + delay,
      tone: p.to.tone,
      ticks: moves && !quiet && !p.die,
      landed: !moves,
    });
  }
  return next;
}

/** Swap one item's cells in a single frame: an LED flipbook. */
export function cut(
  dots: Dot[],
  item: Item,
  now: number,
  palette: Record<Tone, RGBA>,
): Dot[] {
  const next = dots.filter((d) => d.key !== item.key || d.die);
  item.cells.forEach(([x, y], i) => {
    const c = palette[item.tones[i]];
    next.push({
      key: item.key,
      fx: x,
      fy: y,
      tx: x,
      ty: y,
      start: now,
      dur: 0,
      bow: 0,
      born: false,
      die: false,
      c0: c,
      c1: c,
      cStart: now - TONE_MS,
      tone: item.tones[i],
      ticks: false,
      landed: true,
    });
  });
  return next;
}

/** Fade one item's dots to new tones, where they stand. */
export function retone(
  dots: Dot[],
  item: Item,
  now: number,
  palette: Record<Tone, RGBA>,
): void {
  const want = new Map<string, Tone>();
  item.cells.forEach(([x, y], i) => {
    want.set(`${x},${y}`, item.tones[i]);
  });
  for (const d of dots) {
    if (d.key !== item.key || d.die) continue;
    const tone = want.get(`${d.tx},${d.ty}`);
    if (!tone || tone === d.tone) continue;
    d.c0 = snap(d, now).c;
    d.c1 = palette[tone];
    d.cStart = now;
    d.tone = tone;
  }
}

/** drop dots that have merged away */
export function prune(dots: Dot[], now: number): Dot[] {
  return dots.some((d) => d.die && !inFlight(d, now))
    ? dots.filter((d) => !(d.die && !inFlight(d, now)))
    : dots;
}

export interface Pill {
  /** the pill's size in cells, animated */
  w: number;
  h: number;
}

export interface Geometry {
  /** css px per cell */
  pitch: number;
  /** the stage's middle, and the pill's top edge, in css px */
  cx: number;
  top: number;
  dpr: number;
}

/** the share of a cell a lit square covers */
export const SQUARE = 0.74;

/** the pill's corner: a stadium while it is short, a fixed curve once tall */
export function radius(pill: Pill, pitch: number): number {
  return Math.min((pill.h * pitch) / 2, 6.5 * pitch);
}

export function pillRect(pill: Pill, g: Geometry) {
  const w = pill.w * g.pitch;
  const h = pill.h * g.pitch;
  return { x: g.cx - w / 2, y: g.top, w, h, r: radius(pill, g.pitch) };
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  r: { x: number; y: number; w: number; h: number; r: number },
) {
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, Math.min(r.r, r.w / 2, r.h / 2));
}

/** whether a square at (x, y) of half size `s` sits wholly inside the pill */
function inside(
  x: number,
  y: number,
  s: number,
  r: { x: number; y: number; w: number; h: number; r: number },
): boolean {
  const left = r.x + s;
  const right = r.x + r.w - s;
  const top = r.y + s;
  const bottom = r.y + r.h - s;
  if (x < left || x > right || y < top || y > bottom) return false;
  const rad = Math.max(0, Math.min(r.r, r.w / 2, r.h / 2) - s);
  const ix = Math.min(Math.max(x, left + rad), right - rad);
  const iy = Math.min(Math.max(y, top + rad), bottom - rad);
  return (x - ix) ** 2 + (y - iy) ** 2 <= rad * rad;
}

export interface Panel {
  /** the base glow of an unlit cell, and one more per hovered row region */
  base: number;
  regions: { x: number; y: number; w: number; h: number; level: number }[];
  flash: number;
}

const css = (c: RGBA) =>
  `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${c[3].toFixed(3)})`;

/**
 * Paint a frame. The pill and its unlit cells go on `ctx`, the lit dots go on
 * both `ctx` and `glow`, which the page blurs into the bloom round each LED.
 */
export function paint(
  ctx: CanvasRenderingContext2D,
  glow: CanvasRenderingContext2D,
  width: number,
  height: number,
  dots: Dot[],
  pill: Pill,
  g: Geometry,
  panel: Panel,
  ground: string,
  now: number,
): void {
  ctx.clearRect(0, 0, width, height);
  glow.clearRect(0, 0, width, height);
  const rect = pillRect(pill, g);
  if (rect.w < 1 || rect.h < 1) return;

  /* the slab, with a contact line and a soft cast under it */
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.16)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = ground;
  roundRect(ctx, rect);
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundRect(ctx, rect);
  ctx.clip();

  const p = g.pitch;
  const px = (v: number) => Math.round(v * g.dpr) / g.dpr;
  const size = px(p * SQUARE);
  const half = size / 2;

  /*
   * The unlit cells, the panel's own LEDs switched off. Batched into one path
   * per brightness, since a hovered row's region is a step brighter than the
   * rest and nothing else on the panel varies.
   */
  const cols = Math.ceil(pill.w / 2) + 1;
  const rows = Math.ceil(pill.h) + 1;
  const levels = panel.regions.map(() => new Path2D());
  const rest = new Path2D();
  for (let r = 0; r < rows; r++) {
    const y = g.top + (r + 0.5) * p;
    for (let c = -cols; c <= cols; c++) {
      const x = g.cx + c * p;
      if (!inside(x, y, half, rect)) continue;
      let path = rest;
      for (let i = 0; i < panel.regions.length; i++) {
        const reg = panel.regions[i];
        if (
          c >= reg.x &&
          c < reg.x + reg.w &&
          r >= reg.y &&
          r < reg.y + reg.h
        ) {
          path = levels[i];
          break;
        }
      }
      path.rect(px(x - half), px(y - half), size, size);
    }
  }
  const lift = panel.flash * 0.55;
  ctx.fillStyle = `rgba(255,255,255,${(panel.base + lift).toFixed(3)})`;
  ctx.fill(rest);
  panel.regions.forEach((reg, i) => {
    ctx.fillStyle = `rgba(255,255,255,${(panel.base + reg.level + lift).toFixed(3)})`;
    ctx.fill(levels[i]);
  });

  glow.save();
  roundRect(glow, rect);
  glow.clip();
  for (const d of dots) {
    if (now < d.start && d.born) continue;
    const s = snap(d, now);
    if (s.scale <= 0.02 || s.c[3] <= 0.01) continue;
    const x = g.cx + s.x * p;
    const y = g.top + (s.y + 0.5) * p;
    const w = size * s.scale;
    const color = css(s.c);
    ctx.fillStyle = color;
    ctx.fillRect(px(x - w / 2), px(y - w / 2), px(w), px(w));
    glow.fillStyle = color;
    glow.fillRect(x - w / 2, y - w / 2, w, w);
  }
  glow.restore();
  ctx.restore();

  /* a hairline of light on the slab's rim, which is what reads as its edge */
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = 1;
  roundRect(ctx, {
    x: rect.x + 0.5,
    y: rect.y + 0.5,
    w: rect.w - 1,
    h: rect.h - 1,
    r: rect.r - 0.5,
  });
  ctx.stroke();
  ctx.restore();
}
