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
 * The front board is the one box that moves. It turns about the hinge at the
 * spine until its outer edge rests on the table, which uncovers the first page,
 * and the page then writes itself.
 *
 * Pure apart from the context it is handed. Every frame is drawn from
 * nothing: fills in painter's order, bottom board up, then each box's visible
 * edges as two passes of a pen.
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

/** everything that moves, as numbers */
export interface Frame {
  /** 0 for the top view, 1 for the isometric pose */
  turn: number;
  /** 0 for a shut book, 1 for the front board lying open on the table */
  lid: number;
  /** how much of the first page has been written, 0 to 1 */
  write: number;
  /** seconds into the drawing's first inking, `REVEAL_END` or more once it is done */
  ink: number;
  /** the camera's lean toward the hand, in radians */
  lean: View;
  /** a new value redraws every line with a fresh wobble */
  boil: number;
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

const { w: W, d: D, h: H, cover: C, inset: I, spine: S } = BOOK;

/**
 * The pose a hover turns to, true isometric: a 45 degree turn and a tilt of
 * `atan(sqrt 2)`, which is an elevation of 35.26 degrees. The turn is negative
 * so the spine is one of the two sides that face the reader.
 */
const ISO: View = { yaw: -Math.PI / 4, tilt: Math.atan(Math.SQRT2) };

/**
 * How far the camera moves once the book is open: round toward the front and
 * up toward overhead, so the first page faces the reader rather than lying
 * along the line of sight.
 */
const OPENED: View = { yaw: 0.2, tilt: -0.24 };

/** the camera for a frame, every pose and the hand's lean in one place */
export function pose(turn: number, lid: number, lean: View): View {
  const k = Math.min(Math.max(turn, 0), 1.1);
  return {
    yaw: (ISO.yaw + OPENED.yaw * lid) * turn + lean.yaw * k,
    tilt: Math.max(0, (ISO.tilt + OPENED.tilt * lid) * turn + lean.tilt * k),
  };
}

/**
 * Where the light comes from: above, behind and to the right. Both sides that
 * face the reader in the isometric pose face away from it, so they are the
 * hatched ones and the cover stays clean.
 */
const LIGHT: Vec3 = (() => {
  const l = [0.55, -0.45, 0.7];
  const n = Math.hypot(l[0], l[1], l[2]);
  return [l[0] / n, l[1] / n, l[2] / n] as const;
})();

/** how far the top of the book's shadow falls from the footprint, on the table */
const CAST = { x: -15, y: 12 } as const;

/* -------------------------------------------------------------------------- */
/* the boxes                                                                   */
/* -------------------------------------------------------------------------- */

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
] as const satisfies readonly { n: Vec3; c: readonly number[] }[];

const TOP = 0;
const BOTTOM = 1;
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
 * nearer the reader, and the front board over all three. Open, the board lies
 * to the left of the spine, which is the side nearer the reader, so it is
 * still the last thing drawn.
 */
const BACK = box(1, "cover", [0, 0, 0], [W, D, C]);
const PAGES = box(2, "pages", [S, I, C], [W - I, D - I, H - C]);
const SPINE = box(3, "spine", [0, 0, C], [S, D, H - C]);
const FRONT = box(4, "cover", [0, 0, H - C], [W, D, H]);

/** the height of the hinge the front board turns on, and of the first page */
const HINGE = H - C;

/**
 * How far past flat the board turns before its outer edge meets the table:
 * the angle below horizontal where `W sin a + C cos a` is the hinge's height.
 * Solved once, since nothing about the book changes.
 */
const DROOP = (() => {
  let a = 0;
  for (let i = 0; i < 8; i++) a = Math.asin((HINGE - C * Math.cos(a)) / W);
  return a;
})();

const OPEN_ANGLE = Math.PI + DROOP;

/** the front board's place for a lid value, and the turn its normals take */
interface Hinge {
  xf: (p: Vec3) => Vec3;
  nf: (n: Vec3) => Vec3;
}

function hinge(lid: number): Hinge {
  const a = lid * OPEN_ANGLE;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return {
    xf: (p) => {
      const dz = p[2] - HINGE;
      return [p[0] * c - dz * s, p[1], p[0] * s + dz * c + HINGE];
    },
    nf: (n) => [n[0] * c - n[2] * s, n[1], n[0] * s + n[2] * c],
  };
}

const STILL: Hinge = { xf: (p) => p, nf: (n) => n };

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

interface Bounds {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

const BODY = box(0, "cover", [0, 0, 0], [W, D, HINGE]).corners;

function bounds(view: View, board: Hinge): Bounds {
  const cy = Math.cos(view.yaw);
  const sy = Math.sin(view.yaw);
  const ct = Math.cos(view.tilt);
  const st = Math.sin(view.tilt);
  const b = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
  const take = (p: Vec3) => {
    const x = p[0] * cy - p[1] * sy;
    const y = (p[0] * sy + p[1] * cy) * ct - p[2] * st;
    b.x0 = Math.min(b.x0, x);
    b.x1 = Math.max(b.x1, x);
    b.y0 = Math.min(b.y0, y);
    b.y1 = Math.max(b.y1, y);
  };
  for (const p of BODY) take(p);
  for (const p of FRONT.corners) take(board.xf(p));
  return b;
}

function fit(b: Bounds, w: number, h: number, share: number) {
  return Math.min((w * share) / (b.x1 - b.x0), (h * share) / (b.y1 - b.y0));
}

const NO_LEAN: View = { yaw: 0, tilt: 0 };
const REST_BOUNDS = bounds(pose(0, 0, NO_LEAN), STILL);
const ISO_BOUNDS = bounds(pose(1, 0, NO_LEAN), STILL);
const OPEN_BOUNDS = bounds(pose(1, 1, NO_LEAN), hinge(1));

/**
 * One scale for the shut book, picked so both the cover and the cuboid fit,
 * easing out to the open book's as the board turns, so opening it is the
 * camera stepping back rather than the book running off the stage. The book is
 * recentred on its own projection every frame, so the turn reads as the camera
 * going round the book rather than the book sliding.
 */
function camera(
  view: View,
  board: Hinge,
  lid: number,
  w: number,
  h: number,
): Camera {
  const shut = Math.min(
    fit(REST_BOUNDS, w, h, 0.64),
    fit(ISO_BOUNDS, w, h, 0.64),
  );
  const open = fit(OPEN_BOUNDS, w, h, 0.78);
  const k = Math.min(Math.max(lid, 0), 1);
  const scale = shut + (Math.min(shut, open) - shut) * k;
  const b = bounds(view, board);
  return {
    cy: Math.cos(view.yaw),
    sy: Math.sin(view.yaw),
    ct: Math.cos(view.tilt),
    st: Math.sin(view.tilt),
    scale,
    ox: w / 2 - ((b.x0 + b.x1) / 2) * scale,
    oy: h / 2 - ((b.y0 + b.y1) / 2) * scale,
  };
}

function to(cam: Camera, p: Vec3): Pt {
  const x = p[0] * cam.cy - p[1] * cam.sy;
  const y = (p[0] * cam.sy + p[1] * cam.cy) * cam.ct - p[2] * cam.st;
  return { x: x * cam.scale + cam.ox, y: y * cam.scale + cam.oy };
}

/** how squarely a face with normal `n` faces the camera, 0 when edge on */
function facing(cam: Camera, n: Vec3): number {
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
 * How hard the pen presses at a share `s` of the way along its stroke. It
 * lands heavy, which pools ink at the start and so at every corner a stroke
 * leaves from, carries with a slow wave of pressure, and lifts off thin.
 */
function pressure(s: number, seed: number): number {
  const land = 1 + 0.4 * Math.max(0, 1 - s / 0.07);
  const lift = s < 0.62 ? 1 : 1 - 0.78 * ((s - 0.62) / 0.38) ** 1.4;
  const wave = 0.86 + 0.28 * (0.5 + 0.5 * Math.sin(s * 8 + seed * 40));
  return land * lift * wave;
}

/**
 * One pen stroke through `pts`, added to the current path as a filled ribbon
 * whose width follows the pen's pressure. `ss` is how far along the whole
 * stroke each point is, so a stroke still being drawn keeps the pressure it
 * will have when it is finished. Every ribbon winds the same way, so a batch of
 * them filled under `nonzero` is their union.
 */
function ribbon(
  ctx: CanvasRenderingContext2D,
  pts: Pt[],
  ss: number[],
  width: number,
  seed: number,
) {
  const n = pts.length;
  if (n < 2) return;
  const p = rand(seed, 97);
  const left: Pt[] = [];
  const right: Pt[] = [];
  let nx = 0;
  let ny = -1;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l = Math.hypot(dx, dy);
    if (l > 1e-6) {
      nx = -dy / l;
      ny = dx / l;
    }
    const half = Math.max(0.16, (width * pressure(ss[i], p)) / 2);
    left.push({ x: pts[i].x + nx * half, y: pts[i].y + ny * half });
    right.push({ x: pts[i].x - nx * half, y: pts[i].y - ny * half });
  }
  ctx.moveTo(left[0].x, left[0].y);
  for (let i = 1; i < n; i++) ctx.lineTo(left[i].x, left[i].y);
  for (let i = n - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
  ctx.closePath();
}

/**
 * One pen line from `a` to `b`, `draw` of the way along.
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
  width: number,
  draw = 1,
) {
  if (draw <= 0) return;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 0.5) return;
  const ux = dx / len;
  const uy = dy / len;
  const over = Math.min(len * 0.05, 2.4);
  const shake = Math.min(len * 0.015, 0.9);
  const bow = Math.min(len * 0.012, 1.6);
  const steps = Math.max(3, Math.min(18, Math.ceil(len / 6)));
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
    const pts: Pt[] = [];
    const ss: number[] = [];
    const last = Math.max(1, Math.ceil(steps * draw));
    for (let i = 0; i <= last; i++) {
      const q = Math.min(draw, i / steps);
      const o = 1 - q;
      pts.push({
        x: o * o * sx + 2 * o * q * mx + q * q * ex,
        y: o * o * sy + 2 * o * q * my + q * q * ey,
      });
      ss.push(q);
    }
    ribbon(ctx, pts, ss, width, seed + k * 31);
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
  width: number,
  draw = 1,
) {
  pen(ctx, to(cam, a), to(cam, b), seed, passes, width, draw);
}

function inkWith(ctx: CanvasRenderingContext2D, color: string, alpha: number) {
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  ctx.fill();
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
const unit = (v: Vec3): Vec3 => {
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
};

/* -------------------------------------------------------------------------- */
/* the first inking                                                            */
/* -------------------------------------------------------------------------- */

/** a group of strokes inked in order: when the first starts, the gap between starts, how long each takes */
type Beat = readonly [start: number, stagger: number, dur: number];

/**
 * The order the drawing inks itself in when it first comes into view, in
 * seconds. The cover's outline, then the paper filling in behind it, the
 * crease and frame, the label, the stamp, and the shadow last, the way a
 * sketch is built up. The sides are inked too, early, for a hand that turns
 * the book before the drawing has finished.
 */
const REVEAL = {
  grid: [0, 0, 0.5],
  paper: [0.35, 0, 0.6],
  edges: [0.05, 0.1, 0.3],
  body: [0.45, 0.025, 0.22],
  frame: [0.5, 0.1, 0.3],
  label: [0.95, 0.08, 0.22],
  stamp: [1.42, 0, 0.45],
  spine: [0.8, 0.05, 0.2],
  leaves: [0.9, 0.012, 0.2],
  hatch: [1.0, 0.004, 0.15],
  shadow: [1.62, 0.0045, 0.18],
} as const satisfies Record<string, Beat>;

export const REVEAL_END = 2.5;

/** how much of stroke `k` in a beat is down at `ink` seconds */
function at(ink: number, beat: Beat, k = 0): number {
  const v = (ink - beat[0] - beat[1] * k) / beat[2];
  return v <= 0 ? 0 : v >= 1 ? 1 : v;
}

/* -------------------------------------------------------------------------- */
/* the table                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * A dot grid on the table, which is square from above and goes isometric with
 * the book, so the page around it says what the camera did. It fades with
 * distance from the book in four bands, one fill each.
 */
function grid(ctx: CanvasRenderingContext2D, cam: Camera, ink: Ink, f: Frame) {
  const fade = at(f.ink, REVEAL.grid);
  if (fade <= 0) return;
  const STEP = 20;
  const REACH = 300;
  const bands = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
  const r = Math.max(0.7, cam.scale * 0.75);
  for (let gx = -W - 120; gx <= W + 120; gx += STEP) {
    for (let gy = -120; gy <= D + 120; gy += STEP) {
      const d = Math.hypot(gx - W / 2, gy - D / 2);
      const a = (REACH - d) / 140;
      if (a <= 0) continue;
      const band = Math.min(3, Math.floor(a * 4));
      const p = to(cam, [gx, gy, 0]);
      bands[band].moveTo(p.x + r, p.y);
      bands[band].arc(p.x, p.y, r, 0, Math.PI * 2);
    }
  }
  ctx.fillStyle = ink.grid;
  for (let i = 0; i < 4; i++) {
    ctx.globalAlpha = ((i + 1) / 4) * fade;
    ctx.fill(bands[i]);
  }
  ctx.globalAlpha = 1;
}

/** the convex hull of a handful of ground points */
function hull(points: Pt[]): Pt[] {
  const p = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Pt, a: Pt, b: Pt) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const chain = (list: Pt[]) => {
    const out: Pt[] = [];
    for (const q of list) {
      while (
        out.length >= 2 &&
        cross(out[out.length - 2], out[out.length - 1], q) <= 0
      )
        out.pop();
      out.push(q);
    }
    return out;
  };
  const lower = chain(p);
  const upper = chain([...p].reverse());
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/**
 * The shadow is hatching on the table, laid in world space so it lies flat and
 * turns with the table rather than staying a screen pattern. Every corner of
 * the book falls on the table along the light, so the shadow follows the board
 * as it opens.
 */
function shadow(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  board: Hinge,
  ink: Ink,
  f: Frame,
) {
  /*
   * Height is capped at a little over the book's, or the board standing
   * upright mid-turn throws a shadow five books long across the stage for the
   * fraction of a second it is up.
   */
  const fall = (p: Vec3): Pt => {
    const z = Math.min(p[2], H * 1.6);
    return { x: p[0] + (CAST.x * z) / H, y: p[1] + (CAST.y * z) / H };
  };
  const ground = hull([
    ...BODY.map(fall),
    ...FRONT.corners.map((p) => fall(board.xf(p))),
  ]);

  let lo = Infinity;
  let hi = -Infinity;
  let far = -Infinity;
  for (const p of ground) {
    lo = Math.min(lo, p.x - p.y);
    hi = Math.max(hi, p.x - p.y);
    far = Math.max(far, p.y);
  }

  ctx.save();
  polygon(
    ctx,
    ground.map((p) => to(cam, [p.x, p.y, 0])),
  );
  ctx.clip();
  ctx.beginPath();
  const reach = far + 80;
  let k = 0;
  for (let c = lo - 40; c <= hi - 40; c += 3.6) {
    const draw = at(f.ink, REVEAL.shadow, k);
    line3(
      ctx,
      cam,
      [c, -40, 0],
      [c + reach, reach - 40, 0],
      5000 + k++ + f.boil * 131,
      1,
      0.75,
      draw,
    );
  }
  inkWith(ctx, ink.faint, 0.55);
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
  f: Frame,
) {
  const lu = Math.hypot(...u);
  const lv = Math.hypot(...v);
  const uh = unit(u);
  ctx.save();
  polygon(ctx, outline);
  ctx.clip();
  ctx.beginPath();
  let k = 0;
  for (let c = -lv; c <= lu; c += HATCH) {
    const a = add(o, uh, c);
    const draw = at(f.ink, REVEAL.hatch, k);
    pen(
      ctx,
      to(cam, a),
      to(cam, add(add(a, uh, lv), v)),
      seed + k++,
      1,
      0.7,
      draw,
    );
  }
  inkWith(ctx, ink.faint, alpha);
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
  f: Frame,
) {
  const lu = Math.hypot(...u);
  const lv = Math.hypot(...v);
  const uh = unit(u);
  const vh = unit(v);
  ctx.beginPath();
  let k = 0;
  for (let z = LEAF; z < lv - 0.8; z += LEAF) {
    const a0 = 1 + 6 * rand(seed, k * 2);
    const a1 = 1 + 6 * rand(seed, k * 2 + 1);
    const row = add(o, vh, z);
    const draw = at(f.ink, REVEAL.leaves, k);
    line3(
      ctx,
      cam,
      add(row, uh, a0),
      add(row, uh, lu - a1),
      seed + 40 + k,
      1,
      0.65,
      draw,
    );
    k++;
  }
  inkWith(ctx, ink.faint, 0.9);
}

/**
 * One box: its visible faces in paper, what is on its dark sides, then each
 * visible edge once. `board` places the corners and turns the normals, which is
 * only ever not the identity for the front board.
 */
function drawBox(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  b: Box,
  board: Hinge,
  ink: Ink,
  f: Frame,
  edges: Beat,
) {
  const world = b.corners.map(board.xf);
  const pts = world.map((p) => to(cam, p));
  const normals = FACES.map((face) => board.nf(face.n));
  const seen = normals.map((n) => facing(cam, n) > 1e-3);

  ctx.fillStyle = ink.paper;
  ctx.globalAlpha = at(f.ink, REVEAL.paper);
  FACES.forEach((face, i) => {
    if (!seen[i]) return;
    polygon(
      ctx,
      face.c.map((c) => pts[c]),
    );
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  /* what is on a side: leaves on the page block, hatching where it is dark */
  FACES.forEach((face, i) => {
    if (!seen[i] || face.n[2] !== 0) return;
    const o = world[face.c[0]];
    const u = sub(world[face.c[1]], o);
    const v = sub(world[face.c[3]], o);
    const seed = b.id * 1000 + i * 100 + f.boil * 7919;
    if (b.kind === "pages") {
      leaves(ctx, cam, o, u, v, ink, seed, f);
      return;
    }
    const n = normals[i];
    const shade = n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2];
    if (shade >= -0.1) return;
    hatch(
      ctx,
      cam,
      o,
      u,
      v,
      face.c.map((c) => pts[c]),
      ink,
      seed,
      Math.min(1, -shade * 1.5),
      f,
    );
  });

  /*
   * Each edge once, however many visible faces share it. A box is convex, so
   * an edge of any visible face is a visible edge.
   */
  ctx.beginPath();
  const done = new Uint8Array(64);
  let k = 0;
  FACES.forEach((face, i) => {
    if (!seen[i]) return;
    for (let e = 0; e < 4; e++) {
      const a = face.c[e];
      const z = face.c[(e + 1) % 4];
      const key = Math.min(a, z) * 8 + Math.max(a, z);
      if (done[key]) continue;
      done[key] = 1;
      const draw = at(f.ink, edges, k++);
      pen(ctx, pts[a], pts[z], b.id * 211 + key + f.boil * 977, 2, 1.1, draw);
    }
  });
  inkWith(ctx, ink.line, 0.9);
  return seen;
}

/** two bands and a title rule down the spine, drawn on its outer face */
function spine(ctx: CanvasRenderingContext2D, cam: Camera, ink: Ink, f: Frame) {
  if (facing(cam, FACES[LEFT].n) <= 1e-3) return;
  const lo = C + 0.8;
  const hi = H - C - 0.8;
  const s = 7000 + f.boil * 613;
  ctx.beginPath();
  for (const [i, y] of [20, 25, D - 25, D - 20].entries()) {
    line3(
      ctx,
      cam,
      [0, y, lo],
      [0, y, hi],
      s + i,
      2,
      0.85,
      at(f.ink, REVEAL.spine, i),
    );
  }
  line3(
    ctx,
    cam,
    [0, 62, H / 2 + 2.5],
    [0, 138, H / 2 + 2.5],
    s + 10,
    1,
    0.85,
    at(f.ink, REVEAL.spine, 4),
  );
  line3(
    ctx,
    cam,
    [0, 76, H / 2 - 2.5],
    [0, 124, H / 2 - 2.5],
    s + 11,
    1,
    0.85,
    at(f.ink, REVEAL.spine, 5),
  );
  inkWith(ctx, ink.soft, 0.9);
}

/** a ruled rectangle on a plane, four pen lines in reading order */
function rect(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  xf: (p: Vec3) => Vec3,
  z: number,
  r: readonly [number, number, number, number],
  seed: number,
  width: number,
  beat: Beat,
  ink: number,
  from: number,
) {
  const [x0, y0, x1, y1] = r;
  const corners: Vec3[] = [
    [x0, y0, z],
    [x1, y0, z],
    [x1, y1, z],
    [x0, y1, z],
  ];
  for (let i = 0; i < 4; i++) {
    line3(
      ctx,
      cam,
      xf(corners[i]),
      xf(corners[(i + 1) % 4]),
      seed + i,
      2,
      width,
      at(ink, beat, from + i),
    );
  }
}

/**
 * A circle drawn in one go on a plane, which overruns where it started and
 * spirals out a little, the way a hand closes one.
 */
function loop(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  xf: (p: Vec3) => Vec3,
  centre: Vec3,
  radius: number,
  seed: number,
  width: number,
  draw: number,
) {
  if (draw <= 0) return;
  const start = rand(seed, 50) * Math.PI * 2;
  const sweep = Math.PI * 2 + 0.45;
  const N = 40;
  const pts: Pt[] = [];
  const ss: number[] = [];
  const last = Math.ceil(N * draw);
  for (let i = 0; i <= last; i++) {
    const q = Math.min(draw, i / N);
    const a = start + sweep * q;
    const r =
      radius * (1 + 0.035 * Math.sin(a * 3 + rand(seed, 51) * 6)) + q * 1.6;
    pts.push(
      to(
        cam,
        xf([
          centre[0] + Math.cos(a) * r,
          centre[1] + Math.sin(a) * r,
          centre[2],
        ]),
      ),
    );
    ss.push(q);
  }
  ribbon(ctx, pts, ss, width, seed);
}

/**
 * The front board's outside: the crease the hinge folds on, a ruled frame, a
 * title label with two lines of nothing written on it, and a stamp. All on
 * the board's own plane, so they foreshorten and turn with it.
 */
function cover(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  xf: (p: Vec3) => Vec3,
  ink: Ink,
  f: Frame,
) {
  const z = H;
  const s = 9000 + f.boil * 397;

  ctx.beginPath();
  line3(
    ctx,
    cam,
    xf([12, 4, z]),
    xf([12, D - 4, z]),
    s,
    2,
    0.9,
    at(f.ink, REVEAL.frame, 0),
  );
  rect(
    ctx,
    cam,
    xf,
    z,
    [26, 16, W - 14, D - 16],
    s + 10,
    0.9,
    REVEAL.frame,
    f.ink,
    1,
  );
  inkWith(ctx, ink.soft, 0.85);

  ctx.beginPath();
  rect(
    ctx,
    cam,
    xf,
    z,
    [46, 46, W - 34, 88],
    s + 20,
    1,
    REVEAL.label,
    f.ink,
    0,
  );
  line3(
    ctx,
    cam,
    xf([56, 60, z]),
    xf([W - 48, 60, z]),
    s + 30,
    1,
    0.9,
    at(f.ink, REVEAL.label, 4),
  );
  line3(
    ctx,
    cam,
    xf([56, 74, z]),
    xf([W - 66, 74, z]),
    s + 31,
    1,
    0.9,
    at(f.ink, REVEAL.label, 5),
  );
  loop(
    ctx,
    cam,
    xf,
    [W / 2 + 6, D - 60, z],
    15,
    s,
    1.1,
    at(f.ink, REVEAL.stamp),
  );
  inkWith(ctx, ink.line, 0.85);
}

/** the inside of the front board, seen once it is open: a frame and a bookplate */
function pastedown(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  xf: (p: Vec3) => Vec3,
  ink: Ink,
  f: Frame,
) {
  const z = HINGE;
  const s = 11000 + f.boil * 211;
  ctx.beginPath();
  rect(
    ctx,
    cam,
    xf,
    z,
    [14, 12, W - 10, D - 12],
    s,
    0.8,
    REVEAL.frame,
    Infinity,
    0,
  );
  rect(
    ctx,
    cam,
    xf,
    z,
    [44, 128, W - 40, 168],
    s + 10,
    0.9,
    REVEAL.frame,
    Infinity,
    0,
  );
  inkWith(ctx, ink.faint, 0.9);
  ctx.beginPath();
  script(ctx, cam, xf, z, BOOKPLATE, 1, s);
  inkWith(ctx, ink.soft, 0.9);
}

/* -------------------------------------------------------------------------- */
/* the first page                                                              */
/* -------------------------------------------------------------------------- */

type Stroke = { pts: [number, number][]; width: number };

/** points every half unit along a straight line, so it can carry pressure */
function segment(a: [number, number], b: [number, number]): [number, number][] {
  const n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.6));
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    out.push([a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n]);
  }
  return out;
}

/**
 * A word of joined-up handwriting, as a trochoid: the pen moves along the line
 * while circling, and wherever the circle is faster than the line it loops.
 * The loops sit at the top of each stroke, which is an `e` or an `l`. At the
 * baseline they read as a row of `m`s. Now and then a letter rises to an
 * ascender.
 */
function word(x0: number, base: number, len: number, xh: number, seed: number) {
  const period = xh * 1.05;
  const w = (Math.PI * 2) / period;
  const a = period * 0.24;
  const out: [number, number][] = [];
  const ph = rand(seed, 1) * 7;
  for (let s = 0; s <= len; s += 0.45) {
    const tall = Math.max(0, Math.sin(s * 0.5 + ph)) ** 8;
    const h = xh * (1 + 1.4 * tall);
    out.push([
      x0 + s + a * Math.sin(w * s),
      base - h * (0.5 - 0.5 * Math.cos(w * s)),
    ]);
  }
  return out;
}

/** a line of words from `x0`, stopping before `x1` */
function sentence(
  x0: number,
  x1: number,
  base: number,
  xh: number,
  seed: number,
): Stroke[] {
  const out: Stroke[] = [];
  let x = x0;
  let k = 0;
  while (true) {
    const len = 8 + 18 * rand(seed, k * 3);
    if (x + len > x1) break;
    out.push({
      pts: word(x, base + (rand(seed, k * 3 + 1) - 0.5), len, xh, seed + k),
      width: 0.8,
    });
    x += len + 4.5 + 2 * rand(seed, k * 3 + 2);
    k++;
  }
  return out;
}

/**
 * What is written on the first page, in the page's own coordinates: a title
 * and its underline, six lines of writing, and a small sketch of a cuboid in
 * the corner, since this is a book about one.
 */
const FIRST_PAGE: Stroke[] = (() => {
  const out: Stroke[] = [];
  out.push(...sentence(22, 112, 34, 7, 101).map((s) => ({ ...s, width: 1 })));
  out.push({ pts: segment([20, 40], [104, 39]), width: 0.9 });
  const ends = [132, 128, 134, 120, 131, 86];
  ends.forEach((end, i) => {
    out.push(
      ...sentence(i === 0 ? 30 : 20, end, 64 + i * 15, 4.6, 200 + i * 17),
    );
  });
  const cx = 104;
  const cy = 170;
  const r = 13;
  const v = (deg: number): [number, number] => [
    cx + r * Math.cos((deg * Math.PI) / 180),
    cy + r * Math.sin((deg * Math.PI) / 180),
  ];
  const ring = [30, 90, 150, 210, 270, 330, 30].map(v);
  out.push({
    pts: ring.slice(0, -1).flatMap((p, i) => segment(p, ring[i + 1])),
    width: 0.85,
  });
  for (const deg of [210, 330, 90])
    out.push({ pts: segment([cx, cy], v(deg)), width: 0.85 });
  return out;
})();

/** what is written on the bookplate */
const BOOKPLATE: Stroke[] = sentence(54, W - 48, 152, 5, 900);

function lengthOf(s: Stroke): number {
  let l = 0;
  for (let i = 1; i < s.pts.length; i++) {
    l += Math.hypot(
      s.pts[i][0] - s.pts[i - 1][0],
      s.pts[i][1] - s.pts[i - 1][1],
    );
  }
  return l;
}

/**
 * Write `progress` of a list of strokes, in order, as one hand at one speed:
 * each stroke takes its share of the time by its length.
 */
function script(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  xf: (p: Vec3) => Vec3,
  z: number,
  strokes: Stroke[],
  progress: number,
  seed: number,
) {
  const lens = strokes.map(lengthOf);
  const total = lens.reduce((a, b) => a + b, 0);
  let left = progress * total;
  strokes.forEach((s, i) => {
    if (left <= 0) return;
    const draw = Math.min(1, left / lens[i]);
    left -= lens[i];
    const n = s.pts.length;
    const last = Math.max(1, Math.ceil((n - 1) * draw));
    const pts: Pt[] = [];
    const ss: number[] = [];
    for (let j = 0; j <= last; j++) {
      const p = s.pts[j];
      pts.push(to(cam, xf([p[0], p[1], z])));
      ss.push(j / (n - 1));
    }
    ribbon(ctx, pts, ss, s.width, seed + i);
  });
}

/** the ruled lines are printed, and are there before anything is written */
function page(ctx: CanvasRenderingContext2D, cam: Camera, ink: Ink, f: Frame) {
  const z = HINGE;
  const id = (p: Vec3) => p;
  ctx.beginPath();
  for (let i = 0; i < 7; i++) {
    const y = 49 + i * 15;
    line3(ctx, cam, [16, y, z], [W - 14, y, z], 12000 + i, 1, 0.55);
  }
  line3(ctx, cam, [16, 44, z], [16, D - 14, z], 12010, 1, 0.55);
  inkWith(ctx, ink.grid, 1);

  ctx.beginPath();
  script(ctx, cam, id, z + 0.01, FIRST_PAGE, f.write, 13000);
  inkWith(ctx, ink.line, 0.88);
}

/* -------------------------------------------------------------------------- */
/* a frame                                                                     */
/* -------------------------------------------------------------------------- */

export function paint(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  f: Frame,
  ink: Ink,
) {
  ctx.clearRect(0, 0, w, h);
  const lid = Math.min(Math.max(f.lid, 0), 1);
  const board = hinge(lid);
  const view = pose(f.turn, lid, f.lean);
  const cam = camera(view, board, lid, w, h);

  grid(ctx, cam, ink, f);
  shadow(ctx, cam, board, ink, f);
  drawBox(ctx, cam, BACK, STILL, ink, f, REVEAL.body);
  drawBox(ctx, cam, PAGES, STILL, ink, f, REVEAL.body);
  if (lid > 0.01) page(ctx, cam, ink, f);
  drawBox(ctx, cam, SPINE, STILL, ink, f, REVEAL.body);
  spine(ctx, cam, ink, f);
  const seen = drawBox(ctx, cam, FRONT, board, ink, f, REVEAL.edges);
  if (seen[TOP]) cover(ctx, cam, board.xf, ink, f);
  else if (seen[BOTTOM]) pastedown(ctx, cam, board.xf, ink, f);
}
