/*
 * The pixels, as a swarm of springs.
 *
 * Every pixel is a point on a spring to the cell it is going to. A morph hands
 * each one a new cell and a start time, and the start times run round the
 * shape, so the pixels leave one after another and stream into the new shape
 * as a line rather than jumping together. All lengths are device px.
 */

import { bayer, STOPS } from "./shapes";

/** spring stiffness and damping, per second squared and per second */
const STIFF = 120;
const DAMP = 2 * Math.sqrt(STIFF) * 0.68;
/** a sideways pull at the start of a flight, so a path curves, and how fast it fades */
const SWIRL = 75;
const SWIRL_FADE = 0.32;
/** a share of the ring the cells are turned by, so the whole shape twists into the next */
const TWIST = 0.09;
/** random spread on each start, in seconds */
const JITTER = 0.05;

export interface Swarm {
  n: number;
  px: Float32Array;
  py: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  /** the cell each pixel is going to */
  tx: Float32Array;
  ty: Float32Array;
  /** where each pixel waits until its start */
  hx: Float32Array;
  hy: Float32Array;
  start: Float32Array;
  /** each pixel's stop on the ramp, and the stop of the cell it is going to */
  tone: Uint8Array;
  next: Uint8Array;
  /** each pixel's shape palette, and the palette of the shape it is going to */
  palette: Uint8Array;
  nextPalette: Uint8Array;
  /** seconds since the last morph */
  age: number;
}

export interface Pointer {
  x: number;
  y: number;
  radius: number;
  push: number;
}

export function createSwarm(n: number): Swarm {
  const f = () => new Float32Array(n);
  return {
    n,
    px: f(),
    py: f(),
    vx: f(),
    vy: f(),
    tx: f(),
    ty: f(),
    hx: f(),
    hy: f(),
    start: f(),
    tone: new Uint8Array(n),
    next: new Uint8Array(n),
    palette: new Uint8Array(n),
    nextPalette: new Uint8Array(n),
    age: 0,
  };
}

/** throw every pixel somewhere random on the stage */
export function scatter(s: Swarm, w: number, h: number) {
  for (let i = 0; i < s.n; i++) {
    s.px[i] = Math.random() * w;
    s.py[i] = Math.random() * h;
    s.vx[i] = 0;
    s.vy[i] = 0;
  }
}

/** put every pixel on its cell at once */
export function settle(s: Swarm) {
  s.px.set(s.tx);
  s.py.set(s.ty);
  s.hx.set(s.tx);
  s.hy.set(s.ty);
  s.vx.fill(0);
  s.vy.fill(0);
  s.start.fill(0);
  s.tone.set(s.next);
  s.palette.set(s.nextPalette);
  s.age = 1e3;
}

/** indices ordered clockwise from the top, round their own centre */
function clockwise(xs: Float32Array, ys: Float32Array, n: number): Uint32Array {
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < n; i++) {
    cx += xs[i];
    cy += ys[i];
  }
  cx /= n;
  cy /= n;
  const angle = new Float32Array(n);
  for (let i = 0; i < n; i++) angle[i] = Math.atan2(xs[i] - cx, cy - ys[i]);
  const order = new Uint32Array(n);
  for (let i = 0; i < n; i++) order[i] = i;
  return order.sort((a, b) => angle[a] - angle[b]);
}

/**
 * Send the swarm to a new set of cells.
 *
 * Pixels and cells are both put in clockwise order and paired by rank, so a
 * pixel goes to a cell on the same side of the shape and paths rarely cross.
 * The pairing is turned by `TWIST`, so the shape twists as it changes. The
 * start times follow the same order, so the stream sets off at the top and
 * runs round.
 */
export function aim(
  s: Swarm,
  gx: Float32Array,
  gy: Float32Array,
  tones: Uint8Array,
  palette: number,
  spread: number,
) {
  s.nextPalette.fill(palette);
  const n = s.n;
  const from = clockwise(s.px, s.py, n);
  const to = clockwise(gx, gy, n);
  const shift = Math.round(n * TWIST);
  for (let i = 0; i < n; i++) {
    const p = from[i];
    const t = to[(i + shift) % n];
    s.tx[p] = gx[t];
    s.ty[p] = gy[t];
    s.next[p] = tones[t];
    s.hx[p] = s.px[p];
    s.hy[p] = s.py[p];
    s.start[p] = (i / n) * spread + Math.random() * JITTER;
  }
  s.age = 0;
}

/**
 * Advance the swarm by `dt` seconds. Returns whether anything is still
 * moving, so the loop can stop when nothing is. A pixel the pointer is
 * holding off its cell, at rest, does not count as moving.
 */
export function step(s: Swarm, dt: number, pointer: Pointer | null): boolean {
  s.age += dt;
  let moving = false;
  const r2 = pointer ? pointer.radius * pointer.radius : 0;
  for (let i = 0; i < s.n; i++) {
    const t = s.age - s.start[i];
    const gx = t > 0 ? s.tx[i] : s.hx[i];
    const gy = t > 0 ? s.ty[i] : s.hy[i];
    const dx = gx - s.px[i];
    const dy = gy - s.py[i];
    let ax = STIFF * dx - DAMP * s.vx[i];
    let ay = STIFF * dy - DAMP * s.vy[i];
    if (t > 0) {
      // a pixel takes its new tone and its new shape's colours as it sets off
      s.tone[i] = s.next[i];
      s.palette[i] = s.nextPalette[i];
      const curl = SWIRL * Math.exp(-t / SWIRL_FADE);
      ax -= dy * curl;
      ay += dx * curl;
    } else {
      moving = true;
    }
    let pushed = false;
    if (pointer) {
      const rx = s.px[i] - pointer.x;
      const ry = s.py[i] - pointer.y;
      const d2 = rx * rx + ry * ry;
      if (d2 < r2 && d2 > 0.01) {
        const d = Math.sqrt(d2);
        const f = (1 - d / pointer.radius) ** 2 * pointer.push;
        ax += (rx / d) * f;
        ay += (ry / d) * f;
        pushed = true;
      }
    }
    s.vx[i] += ax * dt;
    s.vy[i] += ay * dt;
    s.px[i] += s.vx[i] * dt;
    s.py[i] += s.vy[i] * dt;
    const still = s.vx[i] * s.vx[i] + s.vy[i] * s.vy[i] < 4;
    if (!still) {
      moving = true;
    } else if (!pushed) {
      if (Math.abs(dx) < 0.3 && Math.abs(dy) < 0.3) {
        // on the cell exactly, so a settled shape is a clean grid
        s.px[i] = gx;
        s.py[i] = gy;
        s.vx[i] = 0;
        s.vy[i] = 0;
      } else {
        moving = true;
      }
    }
  }
  return moving;
}

/**
 * Draw the swarm. A pixel's colour is its shape's palette, its stop on the
 * ramp, and a hue band read from where it is in the shape's box, `span`
 * square from `left` and `top`, so the hue slides as the pixels move. The
 * band is dithered by the same threshold as the shapes, so it steps rather
 * than stripes. `colours` is one block of `bands` rows of `STOPS` per
 * palette. Pixels are bucketed by colour with a counting sort, so each
 * colour in use is one path.
 */
export function paint(
  ctx: CanvasRenderingContext2D,
  s: Swarm,
  size: number,
  w: number,
  h: number,
  colours: readonly string[],
  bands: number,
  left: number,
  top: number,
  span: number,
) {
  ctx.clearRect(0, 0, w, h);
  const key = new Uint16Array(s.n);
  const count = new Uint32Array(colours.length + 1);
  for (let i = 0; i < s.n; i++) {
    const x = Math.round(s.px[i]);
    const y = Math.round(s.py[i]);
    // left to right across the box, leaning a little with the height
    const t = Math.min(
      1,
      Math.max(0, (x - left) / span + ((y - top) / span - 0.5) * 0.2),
    );
    const band = Math.min(
      bands - 1,
      Math.floor(
        t * (bands - 1) +
          bayer(Math.floor(x / size) + 3, Math.floor(y / size) + 5),
      ),
    );
    const k = (s.palette[i] * bands + band) * STOPS + s.tone[i];
    key[i] = k;
    count[k + 1]++;
  }
  for (let k = 1; k <= colours.length; k++) count[k] += count[k - 1];
  const order = new Uint32Array(s.n);
  const at = count.slice();
  for (let i = 0; i < s.n; i++) order[at[key[i]]++] = i;
  for (let k = 0; k < colours.length; k++) {
    if (count[k + 1] === count[k]) continue;
    ctx.beginPath();
    for (let j = count[k]; j < count[k + 1]; j++) {
      const i = order[j];
      ctx.rect(Math.round(s.px[i]), Math.round(s.py[i]), size, size);
    }
    ctx.fillStyle = colours[k];
    ctx.fill();
  }
}
