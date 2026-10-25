import { type Light, tone } from "./scene";

/**
 * The four treatments, plus the plain render they all start from. Each one
 * samples `tone` on its own grid and spends the ink on its own marks.
 *
 * Everything is drawn in CSS pixels on a context already scaled by the device
 * pixel ratio. The layers that are rasterised first (plain, dither) are drawn
 * small and scaled up, which keeps the per-frame work to a few thousand
 * samples rather than one per device pixel.
 */

export type Rgb = readonly [number, number, number];

export interface Frame {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  dpr: number;
  ink: Rgb;
  light: Light;
}

/** Scene units to CSS pixels. The planet is about half the frame's height. */
export function mapping(w: number, h: number) {
  return { cx: w / 2, cy: h / 2, unit: Math.min(h / 2.1, w / 2.4) };
}

const rgba = (ink: Rgb, a: number) =>
  `rgba(${ink[0]},${ink[1]},${ink[2]},${a})`;

/**
 * Rasterises the scene into `layer`, one sample per `step` CSS pixels. `keep`
 * turns a sample's ink into the pixel's alpha, which is the only thing the
 * plain render and the dither do differently.
 */
function rasterize(
  layer: HTMLCanvasElement,
  f: Frame,
  step: number,
  keep: (t: number, i: number, j: number) => number,
) {
  const gw = Math.ceil(f.w / step);
  const gh = Math.ceil(f.h / step);
  if (layer.width !== gw || layer.height !== gh) {
    layer.width = gw;
    layer.height = gh;
  }
  const c = layer.getContext("2d");
  if (!c) return;
  const img = c.createImageData(gw, gh);
  const d = img.data;
  const { cx, cy, unit } = mapping(f.w, f.h);
  for (let j = 0; j < gh; j++) {
    const y = ((j + 0.5) * step - cy) / unit;
    for (let i = 0; i < gw; i++) {
      const t = tone(((i + 0.5) * step - cx) / unit, y, f.light);
      const k = (j * gw + i) * 4;
      d[k] = f.ink[0];
      d[k + 1] = f.ink[1];
      d[k + 2] = f.ink[2];
      d[k + 3] = keep(t, i, j) * 255;
    }
  }
  c.putImageData(img, 0, 0);
}

/** The smooth render samples every `STEP` CSS pixels. */
const STEP = 2;

export function plainLayer(layer: HTMLCanvasElement, f: Frame, gain = 1) {
  rasterize(layer, f, STEP, (t) => Math.min(1, t * gain));
}

/** Scales a plain layer up to the frame with smoothing on. */
export function drawPlain(f: Frame, layer: HTMLCanvasElement) {
  const { ctx } = f;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(layer, 0, 0, layer.width * STEP, layer.height * STEP);
}

/* ------------------------------------------------------------------ dither */

/**
 * The 8x8 Bayer matrix: every threshold from 0 to 63, spread as evenly as a
 * grid allows. Built by the recursion rather than typed out.
 */
const BAYER = (() => {
  let m = [0];
  for (let n = 1; n < 8; n *= 2) {
    const next: number[] = new Array(4 * n * n);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const v = 4 * m[y * n + x];
        next[y * 2 * n + x] = v;
        next[y * 2 * n + x + n] = v + 2;
        next[(y + n) * 2 * n + x] = v + 3;
        next[(y + n) * 2 * n + x + n] = v + 1;
      }
    }
    m = next;
  }
  return m;
})();

/**
 * Ordered dither. A cell is ink when its tone beats the matrix's threshold
 * for that cell, so a flat grey becomes a fixed pattern rather than noise.
 * The cell is a whole number of device pixels, or the squares blur.
 */
export function drawDither(f: Frame, layer: HTMLCanvasElement) {
  const cell = Math.max(2, Math.round(2 * f.dpr)) / f.dpr;
  rasterize(layer, f, cell, (t, i, j) =>
    t > (BAYER[(j & 7) * 8 + (i & 7)] + 0.5) / 64 ? 1 : 0,
  );
  f.ctx.imageSmoothingEnabled = false;
  f.ctx.drawImage(layer, 0, 0, layer.width * cell, layer.height * cell);
}

/* ------------------------------------------------------------------- grain */

/** A seeded generator, so the grain is the same on every load. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const GRAIN_TILE = 160;

/** One noise pixel per CSS pixel. Squaring the roll leaves most of it faint. */
export function grainTile(): HTMLCanvasElement {
  const tile = document.createElement("canvas");
  tile.width = GRAIN_TILE;
  tile.height = GRAIN_TILE;
  const c = tile.getContext("2d");
  if (!c) return tile;
  const img = c.createImageData(GRAIN_TILE, GRAIN_TILE);
  const rand = mulberry32(7);
  for (let k = 0; k < img.data.length; k += 4) {
    img.data[k + 3] = rand() ** 2 * 255;
  }
  c.putImageData(img, 0, 0);
  return tile;
}

/**
 * Film grain. The smooth render is drawn darker than plain, then the tile
 * removes ink at random. `destination-out` only takes ink away, so the page
 * itself never greys.
 */
export function drawGrain(
  f: Frame,
  layer: HTMLCanvasElement,
  tile: HTMLCanvasElement,
  ox: number,
  oy: number,
) {
  drawPlain(f, layer);
  const { ctx } = f;
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.imageSmoothingEnabled = false;
  for (let y = -oy; y < f.h; y += GRAIN_TILE) {
    for (let x = -ox; x < f.w; x += GRAIN_TILE) ctx.drawImage(tile, x, y);
  }
  ctx.restore();
}

/* ------------------------------------------------------------------- ascii */

/** Lightest first. Index 0 is a space, which draws nothing. */
const RAMP = " .,:;-=+*#%@";
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";
const SIZE = 11;

/** One character per cell, picked by how much ink the cell's centre wants. */
export function drawAscii(f: Frame) {
  const { ctx, w, h } = f;
  ctx.font = `600 ${SIZE}px ${MONO}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const cw = ctx.measureText("M").width;
  const ch = SIZE * 1.15;
  const cols = Math.floor(w / cw);
  const rows = Math.floor(h / ch);
  const ox = (w - cols * cw) / 2;
  const oy = (h - rows * ch) / 2;
  const { cx, cy, unit } = mapping(w, h);
  for (let j = 0; j < rows; j++) {
    const py = oy + (j + 0.5) * ch;
    for (let i = 0; i < cols; i++) {
      const px = ox + (i + 0.5) * cw;
      const raw = tone((px - cx) / unit, (py - cy) / unit, f.light);
      // the faint wash would scatter dots over the whole frame
      if (raw < 0.09) continue;
      // lifted, so the lit side gets a character rather than a dot
      const t = raw ** 0.8;
      const k = Math.max(
        1,
        Math.min(RAMP.length - 1, Math.floor(t * RAMP.length)),
      );
      ctx.fillStyle = rgba(f.ink, 0.5 + 0.5 * t);
      ctx.fillText(RAMP[k], px, py);
    }
  }
}

/* -------------------------------------------------------------- line screen */

const PITCH = 6;
const BLOCK = 7;

export interface Lens {
  x: number;
  y: number;
  r: number;
}

/**
 * Vertical stripes cut into blocks, each block's bar as wide as its ink. Under
 * the lens the blocks open onto the plain render, and the ring of blocks just
 * outside it is drawn hollow, so the mask's stepped edge reads as cut.
 */
export function drawLines(
  f: Frame,
  plain: HTMLCanvasElement,
  lens: Lens | null,
) {
  const { ctx, w, h } = f;
  const cols = Math.ceil(w / PITCH);
  const rows = Math.ceil(h / BLOCK);
  const ox = (w - cols * PITCH) / 2;
  const oy = (h - rows * BLOCK) / 2;
  const { cx, cy, unit } = mapping(w, h);
  const reveal = new Path2D();
  let opened = false;
  ctx.fillStyle = rgba(f.ink, 1);
  ctx.strokeStyle = rgba(f.ink, 1);
  ctx.lineWidth = 1 / f.dpr;
  for (let i = 0; i < cols; i++) {
    const px = ox + (i + 0.5) * PITCH;
    for (let j = 0; j < rows; j++) {
      const py = oy + (j + 0.5) * BLOCK;
      const t = tone((px - cx) / unit, (py - cy) / unit, f.light);
      if (lens) {
        const d = Math.hypot(px - lens.x, py - lens.y);
        if (d < lens.r) {
          reveal.rect(ox + i * PITCH, oy + j * BLOCK, PITCH, BLOCK);
          opened = true;
          continue;
        }
        if (d < lens.r + 9 && t > 0.04) {
          ctx.globalAlpha = 0.3 + 0.6 * t;
          ctx.strokeRect(px - 2, oy + j * BLOCK + 1, 4, BLOCK - 2);
          continue;
        }
      }
      const bw = t * (PITCH - 1);
      if (bw < 0.5) continue;
      ctx.globalAlpha = 0.5 + 0.5 * t;
      ctx.fillRect(px - bw / 2, oy + j * BLOCK + 0.5, bw, BLOCK - 1);
    }
  }
  ctx.globalAlpha = 1;
  if (opened) {
    ctx.save();
    ctx.clip(reveal);
    drawPlain(f, plain);
    ctx.restore();
  }
}
