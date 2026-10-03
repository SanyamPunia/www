/**
 * A book drawn as if by pen, and the camera it is seen through.
 *
 * The book is four boxes in world units: two cover boards, the page block
 * between them and the spine along the left. The camera is two angles, a turn
 * about the table's normal and a tilt away from looking straight down, and
 * the projection is orthographic, which is what an isometric drawing is. At
 * zero tilt every side face is edge on and the book is its cover. At the
 * isometric pose three faces show and it is a cuboid.
 *
 * Pure apart from the context it is handed. Every frame is drawn from
 * nothing: fills in painter's order, bottom board up, then each box's visible
 * edges as two loose pen strokes.
 */

export type Vec3 = readonly [number, number, number];

export interface Pt {
  x: number;
  y: number;
}

/** the camera, in radians: `yaw` about the table's normal, `tilt` off straight down */
export interface View {
  yaw: number;
  tilt: number;
}

/** the tokens a frame is drawn in, read off the stylesheet at mount */
export interface Ink {
  line: string;
  soft: string;
  faint: string;
  grid: string;
  paper: string;
}

/** world units. A portrait book lying on the table, spine along x = 0 */
export const BOOK = {
  w: 150,
  d: 200,
  h: 30,
  cover: 3,
  /** how far the boards overhang the page block on the three open sides */
  inset: 5,
  spine: 5,
} as const;

/**
 * The pose a hover turns to, true isometric: a 45 degree turn and a tilt of
 * `atan(sqrt 2)`, which is an elevation of 35.26 degrees. The turn is negative
 * so the spine is one of the two sides that face the reader.
 */
export const ISO: View = { yaw: -Math.PI / 4, tilt: Math.atan(Math.SQRT2) };

const { w: W, d: D, h: H, cover: C, inset: I, spine: S } = BOOK;

/**
 * Where the light comes from, unnormalised: above, behind and to the right.
 * Both sides that face the reader in the isometric pose face away from it,
 * so they are the hatched ones and the cover stays clean.
 */
const LIGHT: Vec3 = (() => {
  const l = [0.55, -0.45, 0.7];
  const n = Math.hypot(l[0], l[1], l[2]);
  return [l[0] / n, l[1] / n, l[2] / n] as const;
})();

/** how far the shadow reaches from the footprint, on the table */
const CAST = { x: -15, y: 12 } as const;

type Kind = "cover" | "pages" | "spine";

interface Box {
  id: number;
  kind: Kind;
  corners: Vec3[];
}

/**
 * Corner index is `x | y << 1 | z << 2`, each bit the max end of that axis.
 * A face lists its corners round the loop with `c1 - c0` along the face and
 * `c3 - c0` up it, so a side face's `u` is horizontal and its `v` is height.
 */
const FACES = [
  { n: [0, 0, 1], c: [4, 5, 7, 6] },
  { n: [0, 0, -1], c: [0, 1, 3, 2] },
  { n: [-1, 0, 0], c: [0, 2, 6, 4] },
  { n: [1, 0, 0], c: [1, 3, 7, 5] },
  { n: [0, -1, 0], c: [0, 1, 5, 4] },
  { n: [0, 1, 0], c: [2, 3, 7, 6] },
] as const;

const LEFT = 2;

function box(id: number, kind: Kind, min: Vec3, max: Vec3): Box {
  const corners: Vec3[] = [];
  for (let i = 0; i < 8; i++) {
    corners.push([
      i & 1 ? max[0] : min[0],
      i & 2 ? max[1] : min[1],
      i & 4 ? max[2] : min[2],
    ]);
  }
  return { id, kind, corners };
}

/**
 * Painter's order, which works because the camera only ever looks down: the
 * bottom board, the page block on it, the spine beside the block on the side
 * nearer the reader, and the top board over all three.
 */
const BOXES: Box[] = [
  box(1, "cover", [0, 0, 0], [W, D, C]),
  box(2, "pages", [S, I, C], [W - I, D - I, H - C]),
  box(3, "spine", [0, 0, C], [S, D, H - C]),
  box(4, "cover", [0, 0, H - C], [W, D, H]),
];

const OUTLINE = box(0, "cover", [0, 0, 0], [W, D, H]).corners;

/* -------------------------------------------------------------------------- */
/* the camera                                                                  */
/* -------------------------------------------------------------------------- */

interface Camera {
  cy: number;
  sy: number;
  ct: number;
  st: number;
  scale: number;
  ox: number;
  oy: number;
}

function raw(p: Vec3, cy: number, sy: number, ct: number, st: number): Pt {
  const x1 = p[0] * cy - p[1] * sy;
  const y1 = p[0] * sy + p[1] * cy;
  return { x: x1, y: y1 * ct - p[2] * st };
}

function bounds(view: View) {
  const cy = Math.cos(view.yaw);
  const sy = Math.sin(view.yaw);
  const ct = Math.cos(view.tilt);
  const st = Math.sin(view.tilt);
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const p of OUTLINE) {
    const q = raw(p, cy, sy, ct, st);
    x0 = Math.min(x0, q.x);
    x1 = Math.max(x1, q.x);
    y0 = Math.min(y0, q.y);
    y1 = Math.max(y1, q.y);
  }
  return { x0, x1, y0, y1 };
}

const REST_BOX = bounds({ yaw: 0, tilt: 0 });
const ISO_BOX = bounds(ISO);

/**
 * One scale for every pose, picked so both the cover and the cuboid fit, and
 * the book recentred on its own projection every frame, so the turn reads as
 * the camera going round the book rather than the book sliding off.
 */
function camera(view: View, w: number, h: number): Camera {
  const fit = (b: typeof REST_BOX) =>
    Math.min((w * 0.62) / (b.x1 - b.x0), (h * 0.66) / (b.y1 - b.y0));
  const scale = Math.min(fit(REST_BOX), fit(ISO_BOX));
  const b = bounds(view);
  const cy = Math.cos(view.yaw);
  const sy = Math.sin(view.yaw);
  const ct = Math.cos(view.tilt);
  const st = Math.sin(view.tilt);
  return {
    cy,
    sy,
    ct,
    st,
    scale,
    ox: w / 2 - ((b.x0 + b.x1) / 2) * scale,
    oy: h / 2 - ((b.y0 + b.y1) / 2) * scale,
  };
}

function to(cam: Camera, p: Vec3): Pt {
  const q = raw(p, cam.cy, cam.sy, cam.ct, cam.st);
  return { x: q.x * cam.scale + cam.ox, y: q.y * cam.scale + cam.oy };
}

/** how squarely a face with normal `n` faces the camera, 0 when edge on */
function facing(cam: Camera, n: readonly number[]): number {
  return (n[0] * cam.sy + n[1] * cam.cy) * cam.st + n[2] * cam.ct;
}

/* -------------------------------------------------------------------------- */
/* the pen                                                                     */
/* -------------------------------------------------------------------------- */

function hash(n: number): number {
  let x = n | 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

function rand(seed: number, i: number): number {
  return hash(Math.imul(seed, 374761393) + Math.imul(i, 668265263));
}

/**
 * One pen line from `a` to `b`, added to the current path.
 *
 * Every wobble is a share of the line's own length with a pixel cap, so a line
 * shrinking to nothing as its face turns edge on shrinks its wobble with it
 * rather than leaving a scribble behind. Each pass overshoots both ends a
 * little and bows once, which is what a fast hand does with a ruler it is not
 * using. Two passes is the double stroke of a pen going over a line twice.
 */
function pen(
  ctx: CanvasRenderingContext2D,
  a: Pt,
  b: Pt,
  seed: number,
  passes: number,
) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 0.5) return;
  const ux = dx / len;
  const uy = dy / len;
  const over = Math.min(len * 0.05, 2.4);
  const shake = Math.min(len * 0.015, 0.9);
  const bow = Math.min(len * 0.012, 1.6);
  for (let k = 0; k < passes; k++) {
    const r = (i: number) => rand(seed, k * 8 + i);
    const s = (i: number) => r(i) * 2 - 1;
    const e0 = over * (0.2 + 0.8 * r(0));
    const e1 = over * (0.2 + 0.8 * r(1));
    const j0 = shake * s(2);
    const j1 = shake * s(3);
    const sx = a.x - ux * e0 - uy * j0;
    const sy = a.y - uy * e0 + ux * j0;
    const ex = b.x + ux * e1 - uy * j1;
    const ey = b.y + uy * e1 + ux * j1;
    const m = bow * s(4);
    const mx = (sx + ex) / 2 - uy * m;
    const my = (sy + ey) / 2 + ux * m;
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(mx, my, ex, ey);
  }
}

/** a pen line between two world points */
function line3(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  a: Vec3,
  b: Vec3,
  seed: number,
  passes: number,
) {
  pen(ctx, to(cam, a), to(cam, b), seed, passes);
}

function strokeWith(
  ctx: CanvasRenderingContext2D,
  color: string,
  width: number,
  alpha: number,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.globalAlpha = alpha;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function polygon(ctx: CanvasRenderingContext2D, pts: Pt[]) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
}

const add = (a: Vec3, b: Vec3, k = 1): Vec3 => [
  a[0] + b[0] * k,
  a[1] + b[1] * k,
  a[2] + b[2] * k,
];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

/* -------------------------------------------------------------------------- */
/* the table                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * A dot grid on the table, which is square from above and goes isometric with
 * the book, so the page around it says what the camera did. It fades with
 * distance from the book in four bands, one fill each.
 */
function grid(ctx: CanvasRenderingContext2D, cam: Camera, ink: Ink) {
  const STEP = 20;
  const REACH = 240;
  const bands: Path2D[] = [
    new Path2D(),
    new Path2D(),
    new Path2D(),
    new Path2D(),
  ];
  const r = Math.max(0.7, cam.scale * 0.75);
  for (let gx = -120; gx <= W + 120; gx += STEP) {
    for (let gy = -120; gy <= D + 120; gy += STEP) {
      const d = Math.hypot(gx - W / 2, gy - D / 2);
      const a = (REACH - d) / 110;
      if (a <= 0) continue;
      const band = Math.min(3, Math.floor(a * 4));
      const p = to(cam, [gx, gy, 0]);
      bands[band].moveTo(p.x + r, p.y);
      bands[band].arc(p.x, p.y, r, 0, Math.PI * 2);
    }
  }
  ctx.fillStyle = ink.grid;
  for (let i = 0; i < 4; i++) {
    ctx.globalAlpha = (i + 1) / 4;
    ctx.fill(bands[i]);
  }
  ctx.globalAlpha = 1;
}

/** the convex hull of a handful of ground points, counter-clockwise */
function hull(points: Pt[]): Pt[] {
  const p = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Pt, a: Pt, b: Pt) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Pt[] = [];
  for (const q of p) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0
    )
      lower.pop();
    lower.push(q);
  }
  const upper: Pt[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0
    )
      upper.pop();
    upper.push(q);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

const SHADOW = hull(
  [
    [0, 0],
    [W, 0],
    [W, D],
    [0, D],
  ].flatMap(([x, y]) => [
    { x, y },
    { x: x + CAST.x, y: y + CAST.y },
  ]),
);

/**
 * The shadow is hatching on the table, laid in world space so it lies flat and
 * turns with the table rather than staying a screen pattern.
 */
function shadow(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  ink: Ink,
  boil: number,
) {
  ctx.save();
  polygon(
    ctx,
    SHADOW.map((p) => to(cam, [p.x, p.y, 0])),
  );
  ctx.clip();
  ctx.beginPath();
  let k = 0;
  for (let c = -D - 40; c <= W + 40; c += 3.6) {
    line3(
      ctx,
      cam,
      [c, -30, 0],
      [c + D + 60, D + 30, 0],
      5000 + k++ + boil * 131,
      1,
    );
  }
  strokeWith(ctx, ink.faint, 0.6, 0.55);
  ctx.restore();
}

/* -------------------------------------------------------------------------- */
/* the book                                                                    */
/* -------------------------------------------------------------------------- */

const HATCH = 3;
const LEAF = 2.3;

/** diagonal hatching across one side face, clipped to it */
function hatch(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  o: Vec3,
  u: Vec3,
  v: Vec3,
  outline: Pt[],
  ink: Ink,
  seed: number,
  alpha: number,
) {
  const lu = Math.hypot(...u);
  const lv = Math.hypot(...v);
  const uh: Vec3 = [u[0] / lu, u[1] / lu, u[2] / lu];
  ctx.save();
  polygon(ctx, outline);
  ctx.clip();
  ctx.beginPath();
  let k = 0;
  for (let c = -lv; c <= lu; c += HATCH) {
    const a = add(o, uh, c);
    pen(ctx, to(cam, a), to(cam, add(add(a, uh, lv), v)), seed + k++, 1);
  }
  strokeWith(ctx, ink.faint, 0.6, alpha);
  ctx.restore();
}

/** one line per leaf along a side of the page block, each a little short */
function leaves(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  o: Vec3,
  u: Vec3,
  v: Vec3,
  ink: Ink,
  seed: number,
) {
  const lu = Math.hypot(...u);
  const lv = Math.hypot(...v);
  const uh: Vec3 = [u[0] / lu, u[1] / lu, u[2] / lu];
  const vh: Vec3 = [v[0] / lv, v[1] / lv, v[2] / lv];
  ctx.beginPath();
  let k = 0;
  for (let z = LEAF; z < lv - 0.8; z += LEAF) {
    const a0 = 1 + 6 * rand(seed, k * 2);
    const a1 = 1 + 6 * rand(seed, k * 2 + 1);
    const row = add(o, vh, z);
    line3(ctx, cam, add(row, uh, a0), add(row, uh, lu - a1), seed + 40 + k, 1);
    k++;
  }
  strokeWith(ctx, ink.faint, 0.6, 0.9);
}

function drawBox(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  b: Box,
  ink: Ink,
  boil: number,
) {
  const pts = b.corners.map((p) => to(cam, p));
  const seen = FACES.map((f) => facing(cam, f.n) > 1e-3);

  ctx.fillStyle = ink.paper;
  FACES.forEach((f, i) => {
    if (!seen[i]) return;
    polygon(
      ctx,
      f.c.map((c) => pts[c]),
    );
    ctx.fill();
  });

  /* what is on a side: leaves on the page block, hatching where it is dark */
  FACES.forEach((f, i) => {
    if (!seen[i] || f.n[2] !== 0) return;
    const o = b.corners[f.c[0]];
    const u = sub(b.corners[f.c[1]], o);
    const v = sub(b.corners[f.c[3]], o);
    const seed = b.id * 1000 + i * 100 + boil * 7919;
    if (b.kind === "pages") {
      leaves(ctx, cam, o, u, v, ink, seed);
      return;
    }
    const shade = f.n[0] * LIGHT[0] + f.n[1] * LIGHT[1] + f.n[2] * LIGHT[2];
    if (shade >= -0.1) return;
    hatch(
      ctx,
      cam,
      o,
      u,
      v,
      f.c.map((c) => pts[c]),
      ink,
      seed,
      Math.min(1, -shade * 1.5),
    );
  });

  /*
   * Each edge once, however many visible faces share it. A box is convex, so
   * an edge of any visible face is a visible edge.
   */
  ctx.beginPath();
  const done = new Uint8Array(64);
  FACES.forEach((f, i) => {
    if (!seen[i]) return;
    for (let k = 0; k < 4; k++) {
      const a = f.c[k];
      const z = f.c[(k + 1) % 4];
      const key = Math.min(a, z) * 8 + Math.max(a, z);
      if (done[key]) continue;
      done[key] = 1;
      pen(ctx, pts[a], pts[z], b.id * 211 + key + boil * 977, 2);
    }
  });
  strokeWith(ctx, ink.line, 1, 0.9);
}

/** two bands and a title rule down the spine, drawn on its outer face */
function spine(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  ink: Ink,
  boil: number,
) {
  if (facing(cam, FACES[LEFT].n) <= 1e-3) return;
  const lo = C + 0.8;
  const hi = H - C - 0.8;
  const s = 7000 + boil * 613;
  ctx.beginPath();
  for (const [i, y] of [20, 25, D - 25, D - 20].entries()) {
    line3(ctx, cam, [0, y, lo], [0, y, hi], s + i, 2);
  }
  line3(ctx, cam, [0, 62, H / 2 + 2.5], [0, 138, H / 2 + 2.5], s + 10, 1);
  line3(ctx, cam, [0, 76, H / 2 - 2.5], [0, 124, H / 2 - 2.5], s + 11, 1);
  strokeWith(ctx, ink.soft, 0.8, 0.9);
}

/**
 * The front board: the crease the hinge folds on, a ruled frame, a title label
 * with two lines of nothing written on it, and a stamp. All on the board's own
 * plane, so they foreshorten with it.
 */
function cover(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  ink: Ink,
  boil: number,
) {
  const z = H;
  const s = 9000 + boil * 397;
  const rect = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    seed: number,
  ) => {
    line3(ctx, cam, [x0, y0, z], [x1, y0, z], seed, 2);
    line3(ctx, cam, [x1, y0, z], [x1, y1, z], seed + 1, 2);
    line3(ctx, cam, [x1, y1, z], [x0, y1, z], seed + 2, 2);
    line3(ctx, cam, [x0, y1, z], [x0, y0, z], seed + 3, 2);
  };

  ctx.beginPath();
  line3(ctx, cam, [12, 4, z], [12, D - 4, z], s, 2);
  rect(26, 16, W - 14, D - 16, s + 10);
  strokeWith(ctx, ink.soft, 0.8, 0.85);

  ctx.beginPath();
  rect(46, 46, W - 34, 88, s + 20);
  line3(ctx, cam, [56, 60, z], [W - 48, 60, z], s + 30, 1);
  line3(ctx, cam, [56, 74, z], [W - 66, 74, z], s + 31, 1);

  /* a circle drawn in one go, which overruns where it started */
  const cx = W / 2 + 6;
  const cy = D - 60;
  const R = 15;
  const start = rand(s, 50) * Math.PI * 2;
  const sweep = Math.PI * 2 + 0.45;
  const N = 30;
  for (let i = 0; i <= N; i++) {
    const a = start + (sweep * i) / N;
    const r =
      R * (1 + 0.035 * Math.sin(a * 3 + rand(s, 51) * 6)) + (i / N) * 1.6;
    const p = to(cam, [cx + Math.cos(a) * r, cy + Math.sin(a) * r, z]);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  strokeWith(ctx, ink.line, 0.9, 0.85);
}

/**
 * One frame. `boil` is the hand: a new value redraws every line with a fresh
 * wobble, which is what a drawing animated a frame at a time looks like.
 */
export function paint(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  view: View,
  ink: Ink,
  boil: number,
) {
  ctx.clearRect(0, 0, w, h);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const cam = camera(view, w, h);
  grid(ctx, cam, ink);
  shadow(ctx, cam, ink, boil);
  for (const b of BOXES) {
    drawBox(ctx, cam, b, ink, boil);
    if (b.kind === "spine") spine(ctx, cam, ink, boil);
  }
  cover(ctx, cam, ink, boil);
}
