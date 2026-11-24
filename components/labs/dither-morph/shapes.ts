/*
 * The shapes, and the dithered cells that draw each one.
 *
 * A shape is an SVG path in a 100 box. It is rasterised onto the lab's grid,
 * lit as a bevelled slab, and dithered, and the result is every cell inside
 * the shape ranked by how much it wants ink. The swarm takes the first `n` of
 * that list, so every shape is drawn with the same number of pixels and a
 * morph only moves them.
 */

export interface Shape {
  slug: string;
  name: string;
  path: string;
  /** `evenodd` for a shape with a hole in it */
  rule?: CanvasFillRule;
  /**
   * The shape's own gradient: two four-stop ramps, darkest stop first, that
   * the shape mixes between from its left to its right. Scoped here and not
   * tokens. The palest stops are kept deep enough to read on the stage.
   */
  ramp: { from: readonly string[]; to: readonly string[] };
}

function star(points: number, outer: number, inner: number): string {
  const steps = points * 2;
  let d = "";
  for (let i = 0; i < steps; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i / steps) * Math.PI * 2;
    const x = 50 + r * Math.cos(a);
    const y = 53 + r * Math.sin(a);
    d += `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)} `;
  }
  return `${d}Z`;
}

export const SHAPES: readonly Shape[] = [
  {
    slug: "square",
    name: "Square",
    path: "M28 4H72A24 24 0 0 1 96 28V72A24 24 0 0 1 72 96H28A24 24 0 0 1 4 72V28A24 24 0 0 1 28 4Z",
    ramp: {
      from: ["#2b1660", "#7a2fd0", "#e0559f", "#f59a74"],
      to: ["#0e2a66", "#2f62e8", "#22a9d0", "#6fd3d8"],
    },
  },
  {
    slug: "circle",
    name: "Circle",
    path: "M4 50A46 46 0 1 0 96 50A46 46 0 1 0 4 50Z",
    ramp: {
      from: ["#4a1020", "#c2262e", "#f26a3d", "#ffb36b"],
      to: ["#3d1458", "#8a2cc0", "#d65bd0", "#f3a3e6"],
    },
  },
  {
    slug: "ring",
    name: "Ring",
    path: "M4 50A46 46 0 1 0 96 50A46 46 0 1 0 4 50ZM28 50A22 22 0 1 0 72 50A22 22 0 1 0 28 50Z",
    rule: "evenodd",
    ramp: {
      from: ["#06323a", "#0b7f86", "#1fc2a8", "#8be8c2"],
      to: ["#0b2559", "#1f5fd6", "#3aa0f0", "#9ad3ff"],
    },
  },
  {
    slug: "heart",
    name: "Heart",
    path: "M50 92C20 72 4 54 4 33C4 17 16 7 29 7C39 7 46 13 50 21C54 13 61 7 71 7C84 7 96 17 96 33C96 54 80 72 50 92Z",
    ramp: {
      from: ["#4d0b2a", "#c21d5a", "#f2508a", "#ffa3c0"],
      to: ["#5a0f12", "#d02a2a", "#ff6b5a", "#ffb19a"],
    },
  },
  {
    slug: "star",
    name: "Star",
    path: star(5, 49, 25),
    ramp: {
      from: ["#3f2a05", "#b5740b", "#f2b51f", "#ffd96a"],
      to: ["#4a1a05", "#c4500e", "#f58a24", "#ffbf73"],
    },
  },
  {
    slug: "bolt",
    name: "Bolt",
    path: "M62 2L10 58H43L35 98L90 38H57Z",
    ramp: {
      from: ["#141a5c", "#3a3df0", "#7c6cff", "#c3b8ff"],
      to: ["#03363f", "#0aa3c2", "#2fd6e8", "#a6f4ff"],
    },
  },
];

/**
 * Every shape is scaled toward one area, so a square and a bolt read as the
 * same size rather than the square swamping the stage. A shape smaller than
 * this is left at full size and never grown past its box.
 */
const AREA = 0.46;
const MIN_SCALE = 0.7;
/** the bevel's width, as a share of the grid */
const BEVEL = 0.15;
/** where the light comes from: up, left and toward the eye */
const LIGHT = normalise(-0.55, -0.68, 0.48);

/** how many tones the ramp has, darkest first */
export const STOPS = 4;

/**
 * Each shape's cells, ranked, with how many cells it has inside it. `tone` is
 * each cell's stop on the ramp, 0 for the darkest.
 */
export interface Layout {
  x: Uint16Array;
  y: Uint16Array;
  tone: Uint8Array;
  inside: number;
}

/**
 * The 8x8 Bayer threshold for a cell, 0..1, built from the 2x2 matrix applied
 * at three scales so there is no table. It is read from the cell's place on
 * the stage's grid, so every shape dithers against the same pattern.
 */
export function bayer(x: number, y: number): number {
  let v = 0;
  for (let i = 0; i < 3; i++) {
    const a = (x >> i) & 1;
    const b = (y >> i) & 1;
    v += (((a ^ b) << 1) | b) << (2 * (2 - i));
  }
  return (v + 0.5) / 64;
}

function normalise(x: number, y: number, z: number): [number, number, number] {
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
}

function raster(shape: Shape, cols: number, scale: number): Uint8Array {
  const canvas = document.createElement("canvas");
  canvas.width = cols;
  canvas.height = cols;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const mask = new Uint8Array(cols * cols);
  if (!ctx) return mask;
  const k = cols / 100;
  ctx.setTransform(k * scale, 0, 0, k * scale, cols / 2, cols / 2);
  ctx.translate(-50, -50);
  ctx.fill(new Path2D(shape.path), shape.rule ?? "nonzero");
  const alpha = ctx.getImageData(0, 0, cols, cols).data;
  for (let i = 0; i < mask.length; i++)
    mask[i] = alpha[i * 4 + 3] > 127 ? 1 : 0;
  return mask;
}

/** distance from each cell to the nearest cell outside, by a two-pass chamfer */
function distance(mask: Uint8Array, cols: number): Float32Array {
  const d = new Float32Array(cols * cols);
  for (let i = 0; i < d.length; i++) d[i] = mask[i] ? 1e6 : 0;
  const at = (x: number, y: number) =>
    x < 0 || y < 0 || x >= cols || y >= cols ? 0 : d[y * cols + x];
  for (let y = 0; y < cols; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      if (!d[i]) continue;
      d[i] = Math.min(
        d[i],
        at(x - 1, y) + 1,
        at(x, y - 1) + 1,
        at(x - 1, y - 1) + Math.SQRT2,
        at(x + 1, y - 1) + Math.SQRT2,
      );
    }
  }
  for (let y = cols - 1; y >= 0; y--) {
    for (let x = cols - 1; x >= 0; x--) {
      const i = y * cols + x;
      if (!d[i]) continue;
      d[i] = Math.min(
        d[i],
        at(x + 1, y) + 1,
        at(x, y + 1) + 1,
        at(x + 1, y + 1) + Math.SQRT2,
        at(x - 1, y + 1) + Math.SQRT2,
      );
    }
  }
  return d;
}

/**
 * The cells of one shape on a `cols` square grid, best first.
 *
 * The shape is a slab with a rounded bevel: its height rises over the bevel
 * and is flat on top, and a cell's ink is how far its surface faces away from
 * the light. The bevel's lit edge is pale and its far edge dark. The rim is
 * always inked, so the outline holds whatever the density. `x0` and `y0` are
 * where the grid sits on the stage's own grid, so the threshold matches
 * across shapes.
 */
export function layout(
  shape: Shape,
  cols: number,
  x0: number,
  y0: number,
): Layout {
  const full = raster(shape, cols, 1);
  let area = 0;
  for (const v of full) area += v;
  const scale = Math.min(
    1,
    Math.max(MIN_SCALE, Math.sqrt((AREA * cols * cols) / Math.max(1, area))),
  );
  const mask = scale === 1 ? full : raster(shape, cols, scale);
  const d = distance(mask, cols);
  const bevel = Math.max(2, cols * BEVEL);

  const h = new Float32Array(cols * cols);
  for (let i = 0; i < h.length; i++) {
    const t = Math.min(1, d[i] / bevel);
    h[i] = Math.sqrt(1 - (1 - t) * (1 - t)) * bevel;
  }
  const height = (x: number, y: number) =>
    x < 0 || y < 0 || x >= cols || y >= cols ? 0 : h[y * cols + x];

  const cells: number[] = [];
  const score = new Float32Array(cols * cols);
  const stop = new Uint8Array(cols * cols);
  for (let y = 0; y < cols; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      if (!mask[i]) continue;
      const [nx, ny, nz] = normalise(
        (height(x - 1, y) - height(x + 1, y)) / 2,
        (height(x, y - 1) - height(x, y + 1)) / 2,
        1,
      );
      const lit = Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
      // a faint fall across the top, so the flat face is not one flat grey
      const fall = ((x + y) / (2 * cols) - 0.5) * 0.3;
      const ink = 1 - lit + fall;
      const threshold = bayer(x0 + x, y0 + y);
      const rim = d[i] <= 1.5;
      score[i] = ink - threshold + (rim ? 4 : 0);
      // the cell steps between the two stops either side of its light, and
      // the same threshold picks which, so the tones dither as the ink does
      const level = Math.min(1, Math.max(0, 1 - ink)) * (STOPS - 1);
      const base = Math.floor(level);
      stop[i] = rim
        ? 0
        : Math.min(STOPS - 1, base + (level - base > threshold ? 1 : 0));
      cells.push(i);
    }
  }
  cells.sort((a, b) => score[b] - score[a]);
  const x = new Uint16Array(cells.length);
  const y = new Uint16Array(cells.length);
  const tone = new Uint8Array(cells.length);
  cells.forEach((i, k) => {
    x[k] = i % cols;
    y[k] = Math.floor(i / cols);
    tone[k] = stop[i];
  });
  return { x, y, tone, inside: cells.length };
}
