import { RIDGES, VIEW } from "./ridges";

/*
 * The ink. The print is split into seven portions, the core and six around
 * it, and a press floods the portion under it outward from the point that was
 * pressed. Every ridge is sampled once along its own outline, each sample
 * belongs to the portion whose seed is nearest it, and a flood gives each of
 * that portion's samples an arrival time from its distance to the press. A
 * sample then grows a disc clipped to its own ridge. So one press inks a patch
 * of several ridges as a spreading stain, and a ridge that crosses two
 * portions is half inked until the second one is pressed.
 *
 * Everything is in the print's own 74.54 by 74.87 units. `measure` is the one
 * function that touches the DOM, since `getPointAtLength` is the only reliable
 * way to walk an arbitrary path.
 */

export interface Ridge {
  path: Path2D;
  xs: Float32Array;
  ys: Float32Array;
  /** the portion each sample belongs to */
  portion: Uint8Array;
  /** absolute arrival time of each sample's ink, Infinity until inked */
  at: Float32Array;
  /** when the last disc on this ridge has grown in, Infinity until then */
  settled: number;
}

/**
 * The seeds the print is divided round. Placed by hand rather than on a
 * regular wheel, so the boundaries fall at odd angles through the ridges and
 * the portions read as patches of a print rather than slices of a pie.
 */
export const SEEDS: readonly { x: number; y: number }[] = [
  { x: 37, y: 38 },
  { x: 36, y: 11 },
  { x: 60, y: 23 },
  { x: 63, y: 51 },
  { x: 41, y: 67 },
  { x: 15, y: 57 },
  { x: 12, y: 27 },
];

/** sample pitch along an outline, in print units */
const STEP = 0.5;
/**
 * A disc's radius. The ridges are about 1.5 units wide, so a disc on one edge
 * has to reach right across the ridge. The clip keeps it off every other ridge.
 */
const RADIUS = 2.2;
/** print units a second: a portion floods in about half a second */
export const SPEED = 60;
/** seconds for one disc to grow in, eased out */
const GROW = 0.14;
/** a press further than this from the print's middle is off the print */
const EDGE = 39;

const TAU = Math.PI * 2;
const CENTRE = { x: VIEW.w / 2, y: VIEW.h / 2 };

export function portionAt(x: number, y: number): number {
  if (Math.hypot(x - CENTRE.x, y - CENTRE.y) > EDGE) return -1;
  let best = Number.POSITIVE_INFINITY;
  let hit = -1;
  for (let i = 0; i < SEEDS.length; i++) {
    const d = (SEEDS[i].x - x) ** 2 + (SEEDS[i].y - y) ** 2;
    if (d < best) {
      best = d;
      hit = i;
    }
  }
  return hit;
}

export function measure(): Ridge[] {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.style.cssText = "position:absolute;width:0;height:0;visibility:hidden";
  document.body.append(svg);

  const ridges = RIDGES.map((d) => {
    const el = document.createElementNS(ns, "path");
    el.setAttribute("d", d);
    svg.append(el);
    const length = el.getTotalLength();
    const n = Math.max(2, Math.ceil(length / STEP));
    const xs = new Float32Array(n);
    const ys = new Float32Array(n);
    const portion = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const p = el.getPointAtLength((i / n) * length);
      xs[i] = p.x;
      ys[i] = p.y;
      // every sample is on the print, so this never comes back -1
      portion[i] = Math.max(0, portionAt(p.x, p.y));
    }
    const at = new Float32Array(n).fill(Number.POSITIVE_INFINITY);
    return {
      path: new Path2D(d),
      xs,
      ys,
      portion,
      at,
      settled: Number.POSITIVE_INFINITY,
    };
  });

  svg.remove();
  return ridges;
}

/**
 * Floods one portion from a point, starting at `now`. Returns when the last
 * disc in it has grown in. Under reduced motion every sample arrives at once.
 */
export function flood(
  ridges: readonly Ridge[],
  portion: number,
  x: number,
  y: number,
  now: number,
  still: boolean,
): number {
  let last = now;
  for (const ridge of ridges) {
    let touched = false;
    for (let i = 0; i < ridge.at.length; i++) {
      if (ridge.portion[i] !== portion) continue;
      const t = still
        ? now
        : now + Math.hypot(ridge.xs[i] - x, ridge.ys[i] - y) / SPEED;
      ridge.at[i] = t;
      if (t > last) last = t;
      touched = true;
    }
    if (touched) {
      let settled = 0;
      for (const t of ridge.at) if (t > settled) settled = t;
      ridge.settled = settled + (still ? 0 : GROW);
    }
  }
  return last + (still ? 0 : GROW);
}

export function clear(ridges: readonly Ridge[]) {
  for (const ridge of ridges) {
    ridge.at.fill(Number.POSITIVE_INFINITY);
    ridge.settled = Number.POSITIVE_INFINITY;
  }
}

export interface Frame {
  now: number;
  ghost: string;
  lit: string;
  ink: string;
  done: string;
  /**
   * How lit each portion is by a pointer that has not pressed yet, 0 to 1. A
   * level per portion rather than one index, so moving across the print
   * crossfades one patch out as the next comes up instead of switching.
   */
  hover: Float32Array;
  /** the ink's alpha, which a reset takes down to nothing */
  alpha: number;
  /** everything above this line has been read and is in `done` */
  seal: number;
  /** the centre of the scanning light, or null when nothing is scanning */
  band: number | null;
}

const BAND = 12;
const GHOST = 0.4;

/** discs for every sample of a ridge that passes `keep`, clipped to the ridge */
function discs(
  ctx: CanvasRenderingContext2D,
  ridge: Ridge,
  keep: (i: number) => number,
) {
  ctx.save();
  ctx.clip(ridge.path);
  ctx.beginPath();
  const { xs, ys } = ridge;
  for (let i = 0; i < xs.length; i++) {
    const g = keep(i);
    if (g <= 0) continue;
    const rad = RADIUS * g;
    ctx.moveTo(xs[i] + rad, ys[i]);
    ctx.arc(xs[i], ys[i], rad, 0, TAU);
  }
  ctx.fill();
  ctx.restore();
}

/** Paints one frame. The caller sets the transform to print units. */
export function paint(
  ctx: CanvasRenderingContext2D,
  ridges: readonly Ridge[],
  all: Path2D,
  f: Frame,
) {
  ctx.clearRect(0, 0, VIEW.w, VIEW.h);

  // the impression is the muted tone at a fraction, since on the grey stage
  // even `stroke-strong` sits too close to the ground to read as a print
  ctx.globalAlpha = GHOST;
  ctx.fillStyle = f.ghost;
  ctx.fill(all);
  ctx.globalAlpha = 1;

  // the portion a press would ink, a step darker than the impression
  ctx.fillStyle = f.lit;
  for (let p = 0; p < f.hover.length; p++) {
    const level = f.hover[p];
    if (level <= 0) continue;
    ctx.globalAlpha = level;
    for (const ridge of ridges) {
      if (!ridge.portion.includes(p)) continue;
      discs(ctx, ridge, (i) => (ridge.portion[i] === p ? 1 : 0));
    }
  }

  ctx.globalAlpha = f.alpha;
  ctx.fillStyle = f.ink;
  for (const ridge of ridges) {
    if (f.now >= ridge.settled) {
      ctx.fill(ridge.path);
      continue;
    }
    if (
      ridge.settled === Number.POSITIVE_INFINITY &&
      !ridge.at.some((t) => t <= f.now)
    ) {
      continue;
    }
    discs(ctx, ridge, (i) => {
      const a = f.now - ridge.at[i];
      if (a <= 0) return 0;
      return a >= GROW ? 1 : 1 - (1 - a / GROW) ** 3;
    });
  }

  if (f.seal > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, VIEW.w, f.seal);
    ctx.clip();
    ctx.fillStyle = f.done;
    ctx.fill(all);
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  if (f.band !== null) {
    ctx.save();
    ctx.clip(all);
    const g = ctx.createLinearGradient(0, f.band - BAND, 0, f.band + BAND);
    g.addColorStop(0, "rgb(255 255 255 / 0)");
    g.addColorStop(0.5, "rgb(255 255 255 / 0.9)");
    g.addColorStop(1, "rgb(255 255 255 / 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, f.band - BAND, VIEW.w, BAND * 2);
    ctx.restore();
  }
}

/** where the band starts and stops, so it enters and leaves off the print */
export const SCAN_FROM = -BAND;
export const SCAN_TO = VIEW.h + BAND;
