/*
 * The shapes, as point clouds in unit space, and the one frame of drawing.
 *
 * Pure apart from the context `paint` is handed and the offscreen canvas the
 * word is sampled from, the split `halftone-ripple` makes with `ripple.ts`.
 * `index.tsx` owns the stage, the pointer and the loop.
 *
 * Every shape is `n` points in roughly -1 to 1 on each axis, **sorted by
 * height**. Dot i goes to point i of whatever shape comes next, so sorting
 * every cloud the same way is what makes a morph carry the top of a sphere to
 * the top of a helix instead of throwing every dot across the room.
 */

export type ShapeKey = "sphere" | "ring" | "helix" | "word";

export interface Cloud {
  x: Float32Array;
  y: Float32Array;
  z: Float32Array;
  /**
   * How much of the stage's spin a point takes, 0 or 1. The word does not
   * spin, since a word turned edge on says nothing, so it sways instead and
   * this is what blends the two through a morph.
   */
  spin: Float32Array;
}

/** a small integer hash, so a reload lays the same dots in the same places */
export function hash(i: number, salt: number): number {
  let h = (i * 374761393 + salt * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function cloud(n: number): Cloud {
  return {
    x: new Float32Array(n),
    y: new Float32Array(n),
    z: new Float32Array(n),
    spin: new Float32Array(n),
  };
}

/** sorts a cloud by height in place, through an index array */
function sortByHeight(c: Cloud): Cloud {
  const n = c.x.length;
  const order = Array.from({ length: n }, (_, i) => i);
  order.sort((a, b) => c.y[a] - c.y[b]);
  const out = cloud(n);
  order.forEach((from, to) => {
    out.x[to] = c.x[from];
    out.y[to] = c.y[from];
    out.z[to] = c.z[from];
    out.spin[to] = c.spin[from];
  });
  return out;
}

/** a Fibonacci sphere, which spaces points evenly without a grid's poles */
function sphere(n: number): Cloud {
  const c = cloud(n);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n;
    const r = Math.sqrt(1 - y * y);
    const a = i * golden;
    // a hair of depth off the surface, so the shell reads as dust and not wire
    const s = 0.97 + hash(i, 1) * 0.06;
    c.x[i] = Math.cos(a) * r * s;
    c.y[i] = y * s;
    c.z[i] = Math.sin(a) * r * s;
    c.spin[i] = 1;
  }
  return c;
}

/**
 * A torus tilted toward the viewer, so the spin turns it like a halo rather
 * than flipping a coin edge on. Uniform in both angles, which crowds the inner
 * rim slightly, and that crowding is what reads as the ring having a hole.
 */
function ring(n: number): Cloud {
  const c = cloud(n);
  const tilt = 0.42;
  const [ct, st] = [Math.cos(tilt), Math.sin(tilt)];
  for (let i = 0; i < n; i++) {
    const u = hash(i, 2) * Math.PI * 2;
    const v = hash(i, 3) * Math.PI * 2;
    const r = 0.86 + 0.13 * Math.cos(v);
    const x = Math.cos(u) * r;
    const z = Math.sin(u) * r;
    const y = 0.13 * Math.sin(v);
    c.x[i] = x;
    c.y[i] = y * ct - z * st;
    c.z[i] = y * st + z * ct;
    c.spin[i] = 1;
  }
  return c;
}

/**
 * How tall the helix stands, as a half height in radii. At 1 its near end is
 * magnified past the radius by the perspective and it ran off the top of the
 * stage and down through the floor.
 */
const HELIX_HALF = 0.82;

/** two strands and the rungs between them, a fifth of the dots on the rungs */
function helix(n: number): Cloud {
  const c = cloud(n);
  const turns = 2.1;
  const radius = 0.5;
  const rungs = 22;
  for (let i = 0; i < n; i++) {
    const onRung = hash(i, 4) < 0.2;
    if (onRung) {
      const k = Math.floor(hash(i, 5) * rungs);
      const t = (k + 0.5) / rungs;
      const a = t * turns * Math.PI * 2;
      const s = hash(i, 6) * 2 - 1;
      c.x[i] = Math.cos(a) * radius * s;
      c.z[i] = Math.sin(a) * radius * s;
      c.y[i] = (t * 2 - 1) * HELIX_HALF;
    } else {
      const t = hash(i, 7);
      const strand = hash(i, 8) < 0.5 ? 0 : Math.PI;
      const a = t * turns * Math.PI * 2 + strand;
      // a round tube rather than a line, 0.05 across
      const j = hash(i, 9) * Math.PI * 2;
      const w = 0.05 * Math.sqrt(hash(i, 10));
      c.x[i] = Math.cos(a) * radius + Math.cos(j) * w;
      c.z[i] = Math.sin(a) * radius + Math.sin(j) * w;
      c.y[i] = (t * 2 - 1) * HELIX_HALF + Math.sin(j) * w;
    }
    c.spin[i] = 1;
  }
  return c;
}

/**
 * A word, sampled from its own glyphs on an offscreen canvas. Every filled
 * pixel is a place a dot may land, and the dots are dealt across them by hash,
 * so the letters fill evenly whatever `n` is. It is laid out wider than it is
 * tall and capped at `WORD_HALF` across, so it stays clear of the copy.
 */
const WORD = "hi";
const WORD_HALF = 1.05;

function word(n: number): Cloud {
  const c = cloud(n);
  const w = 360;
  const h = 240;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return sphere(n);
  ctx.fillStyle = "#000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `600 ${h * 0.92}px Inter, ui-sans-serif, system-ui, sans-serif`;
  ctx.fillText(WORD, w / 2, h * 0.56);

  const data = ctx.getImageData(0, 0, w, h).data;
  const filled: number[] = [];
  let [minX, maxX, minY, maxY] = [w, 0, h, 0];
  for (let py = 0; py < h; py += 2) {
    for (let px = 0; px < w; px += 2) {
      if (data[(py * w + px) * 4 + 3] > 128) {
        filled.push(px, py);
        minX = Math.min(minX, px);
        maxX = Math.max(maxX, px);
        minY = Math.min(minY, py);
        maxY = Math.max(maxY, py);
      }
    }
  }
  if (filled.length === 0) return sphere(n);

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const scale = (WORD_HALF * 2) / Math.max(maxX - minX, (maxY - minY) * 1.1);
  const count = filled.length / 2;
  for (let i = 0; i < n; i++) {
    const k = Math.floor(hash(i, 11) * count) * 2;
    // up to half a sample of jitter, so the dots do not sit on the grid
    c.x[i] = (filled[k] + hash(i, 12) * 2 - 1 - cx) * scale;
    c.y[i] = -(filled[k + 1] + hash(i, 13) * 2 - 1 - cy) * scale;
    c.z[i] = (hash(i, 14) * 2 - 1) * 0.1;
    c.spin[i] = 0;
  }
  return c;
}

export function build(key: ShapeKey, n: number): Cloud {
  const make = { sphere, ring, helix, word }[key];
  return sortByHeight(make(n));
}

export const ORDER: readonly ShapeKey[] = ["sphere", "ring", "helix", "word"];

/** how far a point sits from the camera, in unit radii */
const CAMERA = 3.4;

/** the farthest dots, at depth -1, keep this much of their opacity */
const FAR = 0.2;

/** opacity bands, so a frame is a handful of fills rather than one per dot */
const BANDS = 10;

export interface View {
  /** where the shape's centre sits on the stage, and its radius, in px */
  cx: number;
  cy: number;
  r: number;
  /** yaw from the spin, and the lean toward the pointer, in radians */
  yaw: number;
  sway: number;
  leanX: number;
  leanY: number;
}

/**
 * Projects every dot and paints it. `pos` is each dot's place in unit space
 * after the morph, `size` its base diameter in px, and `ox`/`oy` the screen
 * offset the pointer has pushed it by. `sx`/`sy` are written back with where
 * each dot landed on screen, so the scatter can test against the frame the
 * reader is actually looking at.
 */
export function paint(
  ctx: CanvasRenderingContext2D,
  view: View,
  pos: Cloud,
  size: Float32Array,
  ox: Float32Array,
  oy: Float32Array,
  sx: Float32Array,
  sy: Float32Array,
  ink: string,
): void {
  const n = pos.x.length;
  const [cxl, sxl] = [Math.cos(view.leanX), Math.sin(view.leanX)];
  const [cyl, syl] = [Math.cos(view.leanY), Math.sin(view.leanY)];
  const paths: Path2D[] = Array.from({ length: BANDS }, () => new Path2D());

  for (let i = 0; i < n; i++) {
    // the spin, or the sway for a point that does not spin, blended by `spin`
    const a = view.yaw * pos.spin[i] + view.sway * (1 - pos.spin[i]);
    const [ca, sa] = [Math.cos(a), Math.sin(a)];
    let x = pos.x[i] * ca + pos.z[i] * sa;
    let z = -pos.x[i] * sa + pos.z[i] * ca;
    let y = pos.y[i];

    // lean about y, then about x, so the near face turns to the pointer
    const x1 = x * cyl + z * syl;
    z = -x * syl + z * cyl;
    x = x1;
    const y1 = y * cxl - z * sxl;
    z = y * sxl + z * cxl;
    y = y1;

    const f = CAMERA / (CAMERA - z);
    const px = view.cx + x * view.r * f + ox[i];
    const py = view.cy - y * view.r * f + oy[i];
    sx[i] = px;
    sy[i] = py;

    const depth = Math.min(1, Math.max(0, (z + 1) / 2));
    const band = Math.min(BANDS - 1, Math.floor(depth * BANDS));
    const radius = (size[i] * f) / 2;
    const path = paths[band];
    path.moveTo(px + radius, py);
    path.arc(px, py, radius, 0, Math.PI * 2);
  }

  ctx.fillStyle = ink;
  for (let b = 0; b < BANDS; b++) {
    ctx.globalAlpha = FAR + (1 - FAR) * ((b + 0.5) / BANDS);
    ctx.fill(paths[b]);
  }
  ctx.globalAlpha = 1;
}

/**
 * The floor: an endless grid in perspective, vanishing on the shape's own
 * centre line, fading out toward the horizon so it never ends on an edge.
 * `stops` are `[offset, alpha]` pairs down the floor's depth, so a phone can
 * let the grid die before it reaches the copy. `rgb` is the stroke token as
 * three channels, since a gradient stop cannot take a `var()`.
 */
export function floor(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  horizon: number,
  vx: number,
  rgb: string,
  stops: readonly (readonly [number, number])[],
): void {
  const depth = h - horizon;
  const grad = ctx.createLinearGradient(0, horizon, 0, h);
  for (const [at, alpha] of stops) {
    grad.addColorStop(at, `rgb(${rgb} / ${alpha})`);
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, horizon, w, depth);
  ctx.clip();
  ctx.strokeStyle = grad;
  ctx.lineWidth = 1;
  ctx.beginPath();

  // rails running away from the reader, spaced evenly at the front edge
  const spacing = w / 9;
  for (let k = -14; k <= 14; k++) {
    const near = vx + k * spacing * 1.6;
    ctx.moveTo(vx + (near - vx) * 0.02, horizon);
    ctx.lineTo(near, h);
  }
  // cross lines at even steps of depth, stopping short of the horizon, where
  // the next few would stack into one grey band however faint each one is
  for (let d = 1; d <= 9; d++) {
    const y = horizon + depth / d ** 0.9;
    const yy = Math.round(y) + 0.5;
    ctx.moveTo(0, yy);
    ctx.lineTo(w, yy);
  }
  ctx.stroke();
  ctx.restore();
}
