/*
 * The flag's geometry, pure and DOM-free: the swallowtail outline, the warp a
 * gust applies to it, and the path strings the component writes per frame.
 *
 * Everything is in the SVG's own units. The cloth is described once in its
 * own coordinates, `u` along it from the pole (0) to the tails (1) and `v`
 * across it from the top edge (0) to the bottom (1), and every point drawn is
 * that pair pushed through `warp`. So the outline, the solid fill, the halftone
 * dots and the spots the splashes leave from all bend by the same rule and
 * cannot disagree.
 */

/** the pole, a vertical line with a knob on top */
export const POLE = { x: 11, top: 3.2, bottom: 45 };

/** the cloth's length along the pole's normal, its height, and the notch */
const L = 29;
const H = 18;
const NOTCH = 21;

/** where the cloth's top edge sits when the flag is up */
export const MAST = 5;

/** how far below the top it sits when it is down */
export const DROP = 4;

/** the most a gust pushes an edge out, before the tails' own flare */
const SWELL = 4.2;

/**
 * The swell's width in `u`, ahead of its peak and behind it. The trailing half
 * is longer, so the cloth closes back up a beat after the gust has passed
 * rather than snapping flat behind it.
 */
const AHEAD = 0.2;
const BEHIND = 0.34;

/** how far the tails stretch along the cloth while the swell is on them */
const STRETCH = 1.4;

/** outline sample spacing on the straight runs */
const STEP = 1;

export interface Pose {
  /** the cloth's offset below the top of the pole, 0 when up */
  lift: number;
  /** where the swell's peak is, in `u` */
  front: number;
  /** how much of the swell there is, 0 to 1 */
  amp: number;
  /** how far the flutter's wave has travelled, in radians */
  phase: number;
  /** how much flutter there is: 1 is a raised flag in still air, more is wind */
  flutter: number;
  /** a push across the cloth from the pointer's wind, -1 up to 1 down */
  lean: number;
}

/**
 * The flutter: a wave that never stops running from the pole to the tails
 * while the flag is up.
 *
 * **A raised flag that sits dead still is the least flag-like thing a flag can
 * do.** Air is never still at the top of a pole, so the cloth always carries a
 * slow travelling wave, and the press gust rides on top of it rather than
 * starting from a dead stop. It moves the whole cross-section, both edges the
 * same way, where the gust's swell moves them apart. The pole holds the hoist
 * edge here too, so the wave's height grows along the cloth, and 1.15 waves
 * fit on it so there is always one crest and one trough in view.
 */
const FLUTTER = 1.3;
const WAVES = 1.15;

/** how far the pointer's wind can push the tails across, at full lean */
const LEAN = 3;

const TAU = Math.PI * 2;

/** the flutter's offset across the cloth at `u` */
function flutter(u: number, pose: Pose): number {
  const k = Math.max(0, u);
  const wave = pose.flutter * FLUTTER * k ** 1.3;
  return (
    wave * Math.sin(TAU * WAVES * u - pose.phase) + pose.lean * LEAN * k ** 1.5
  );
}

function smooth(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * How much of the swell a point at `u` may take.
 *
 * **The pole holds the hoist edge**, so this is zero at `u` of 0 and climbs
 * over the first few units rather than starting at full strength, which is the
 * one place a flag must differ from the bookmark it came from: there the top
 * swelled the most, and here that edge is tied to something. The weight then
 * grows toward the free end, and the tails take extra on top of it, since a
 * loose corner is what a gust throws hardest.
 */
function hold(u: number): number {
  const x = Math.max(0, u);
  return (1 - Math.exp(-x / 0.1)) * (0.45 + 0.55 * x) + 0.5 * smooth(0.7, 1, x);
}

/** the swell's profile at `d` from its peak, an asymmetric gaussian */
function profile(d: number): number {
  const s = d > 0 ? AHEAD : BEHIND;
  return Math.exp(-((d / s) ** 2));
}

/** a cloth point `(u, v)` to SVG units under `pose` */
export function warp(u: number, v: number, pose: Pose): [number, number] {
  const g = pose.amp * profile(u - pose.front);
  const b = g * SWELL * hold(u);
  const top = MAST + pose.lift - b;
  const bottom = MAST + pose.lift + H + b;
  const x = POLE.x + u * L + g * STRETCH * Math.max(0, u) ** 2;
  return [x, top + v * (bottom - top) + flutter(u, pose)];
}

/**
 * The rest outline, sampled densely in cloth coordinates, once.
 *
 * Built in real units first so the rounded corners are round, then divided
 * into `(u, v)`. Each corner is a quadratic through the vertex, cut back by its
 * radius along both edges. The hoist corners take none, since they are on the
 * pole. Dense sampling is the whole trick: a swell can only bend an edge that
 * has points along it, which is why the reference's own path repeats
 * `10 35.428 10 30.743` down each side of a straight line.
 */
const OUTLINE: ReadonlyArray<readonly [number, number]> = (() => {
  const corners: Array<[number, number, number]> = [
    [0, 0, 0],
    [L, 0, 3],
    [NOTCH, H / 2, 1.2],
    [L, H, 3],
    [0, H, 0],
  ];
  const out: Array<[number, number]> = [];
  const n = corners.length;

  const cut = (i: number, towards: number): [number, number] => {
    const [x, y, r] = corners[i];
    const [tx, ty] = corners[towards];
    const len = Math.hypot(tx - x, ty - y);
    return [x + ((tx - x) / len) * r, y + ((ty - y) / len) * r];
  };

  for (let i = 0; i < n; i++) {
    const prev = (i - 1 + n) % n;
    const next = (i + 1) % n;
    const [px, py] = corners[i];
    const a = cut(i, prev);
    const b = cut(i, next);

    for (let k = 0; k <= 6; k++) {
      const s = k / 6;
      out.push([
        (1 - s) ** 2 * a[0] + 2 * (1 - s) * s * px + s * s * b[0],
        (1 - s) ** 2 * a[1] + 2 * (1 - s) * s * py + s * s * b[1],
      ]);
    }

    const c = cut(next, i);
    const steps = Math.ceil(Math.hypot(c[0] - b[0], c[1] - b[1]) / STEP);
    for (let k = 1; k < steps; k++) {
      const s = k / steps;
      out.push([b[0] + (c[0] - b[0]) * s, b[1] + (c[1] - b[1]) * s]);
    }
  }

  return out.map(([x, y]) => [x / L, y / H] as const);
})();

/** the notch's apex, in cloth coordinates */
const APEX: readonly [number, number] = [NOTCH / L, 0.5];

const f = (n: number) => Math.round(n * 100) / 100;

/** the cloth's outline under `pose`, one closed path */
export function outline(pose: Pose): string {
  let d = "";
  for (let i = 0; i < OUTLINE.length; i++) {
    const [x, y] = warp(OUTLINE[i][0], OUTLINE[i][1], pose);
    d += `${i === 0 ? "M" : "L"}${f(x)} ${f(y)}`;
  }
  return `${d}Z`;
}

/**
 * The fill, as a solid run up to `fill` and a halftone band ahead of it.
 *
 * `fill` is a position in `u`. Behind it the cloth is solid. Ahead of it,
 * columns of dots shrink over `BAND` until there is nothing, so the edge of the
 * fill is a screen print running out of ink rather than a line. The first
 * column's dots are wider than half the pitch, so they merge with each other
 * and with the solid into the scalloped edge the reference has.
 *
 * Both are laid out in cloth coordinates and warped, so the dots ride the swell
 * with the cloth they are printed on. The component clips both to the outline,
 * which is why the solid can be a loose quad that overhangs the cloth.
 */
const PITCH = 2.3;
const ROWS = 8;
const BAND = 0.34;
const LEVELS = 5;
const DOT = PITCH * 0.62;

export function fillPaths(
  pose: Pose,
  fill: number,
): { solid: string; dots: string } {
  let solid = "";
  if (fill > -0.05) {
    const end = Math.min(fill, 1.3);
    const top: string[] = [];
    const bottom: string[] = [];
    for (let u = -0.05; ; u += 0.025) {
      const at = Math.min(u, end);
      const [tx, ty] = warp(at, -0.3, pose);
      const [bx, by] = warp(at, 1.3, pose);
      top.push(`${f(tx)} ${f(ty)}`);
      bottom.unshift(`${f(bx)} ${f(by)}`);
      if (at >= end) break;
    }
    solid = `M${top.join("L")}L${bottom.join("L")}Z`;
  }

  let dots = "";
  const pu = PITCH / L;
  for (let i = 0; ; i++) {
    const u = (i + 0.5) * pu;
    if (u > 1.05) break;
    const dist = u - fill;
    if (dist <= 0 || dist >= BAND) continue;
    const level = Math.ceil((1 - dist / BAND) * LEVELS) / LEVELS;
    const r = f(DOT * level);
    for (let j = 0; j < ROWS; j++) {
      const [x, y] = warp(u, (j + 0.5) / ROWS, pose);
      dots += `M${f(x + r)} ${f(y)}a${r} ${r} 0 1 0 ${-2 * r} 0a${r} ${r} 0 1 0 ${2 * r} 0`;
    }
  }

  return { solid, dots };
}

/**
 * The light on the folds, as halftone.
 *
 * **The dots stay after the fill, and turn into the cloth's shading.** Where
 * the flutter tilts the cloth down and away from a light above it, the solid
 * part is punched with dots of the ground colour, sized by how far it tilts.
 * So the screen that ran the fill in is still there on a raised flag, as the
 * shadow in each trough, and the folds read as folds rather than as an outline
 * wobbling. The tilt is the flutter's own slope, measured off `flutter`, so the
 * shading cannot drift from the shape.
 *
 * The dots sit on the fill's grid and stay under half the pitch, so they never
 * merge: a shadow in a halftone is a denser screen, never a hole.
 */
const SHADE = PITCH * 0.4;
const SHADE_LEVELS = 4;
/** the slope, in cloth units across per unit along, that is full shadow */
const SHADE_SLOPE = 5;

export function shadePath(pose: Pose, fill: number): string {
  if (pose.flutter <= 0.01 && pose.lean === 0) return "";
  let d = "";
  const pu = PITCH / L;
  const e = 0.01;
  for (let i = 0; ; i++) {
    const u = (i + 0.5) * pu;
    if (u > 1.05 || u > fill - pu) break;
    const slope = (flutter(u + e, pose) - flutter(u - e, pose)) / (2 * e);
    const level =
      Math.round(Math.min(1, Math.max(0, slope / SHADE_SLOPE)) * SHADE_LEVELS) /
      SHADE_LEVELS;
    /* the smallest step is a speck, and a speck on a fold reads as dust */
    if (level <= 1 / SHADE_LEVELS) continue;
    const r = f(SHADE * level);
    for (let j = 0; j < ROWS; j++) {
      const [x, y] = warp(u, (j + 0.5) / ROWS, pose);
      d += `M${f(x + r)} ${f(y)}a${r} ${r} 0 1 0 ${-2 * r} 0a${r} ${r} 0 1 0 ${2 * r} 0`;
    }
  }
  return d;
}

/** the fill positions the component animates between */
export const EMPTY = -0.4;
export const FULL = 1.3;

/**
 * Where the three splashes leave from under `pose`, and which way they go: one
 * off each tail tip, angled out, and one straight out of the notch between
 * them. The reference throws its three off the bookmark's two corners and its
 * notch, and a swallowtail has the same three points turned on their side.
 *
 * `start` is how far out from the point the drop first shows and `travel` how
 * much further it goes. The notch sits 8 units behind the tips, so its drop
 * starts further out and travels further, and all three finish level.
 */
export interface Drop {
  x: number;
  y: number;
  dx: number;
  dy: number;
  start: number;
  travel: number;
}

const SPREAD = (32 * Math.PI) / 180;

export function drops(pose: Pose): Drop[] {
  const [ax, ay] = warp(1, 0, pose);
  const [nx, ny] = warp(APEX[0], APEX[1], pose);
  const [bx, by] = warp(1, 1, pose);
  return [
    {
      x: ax,
      y: ay,
      dx: Math.cos(SPREAD),
      dy: -Math.sin(SPREAD),
      start: 2.2,
      travel: 7.5,
    },
    { x: nx, y: ny, dx: 1, dy: 0, start: 7.2, travel: 9 },
    {
      x: bx,
      y: by,
      dx: Math.cos(SPREAD),
      dy: Math.sin(SPREAD),
      start: 2.2,
      travel: 7.5,
    },
  ];
}

/**
 * The splashes at `t` of their life, one path of three segments.
 *
 * A drop is a round-capped segment whose head runs out on an ease-out and
 * whose tail follows it a beat later. At `t` of 0 both ends sit on one point,
 * which a round cap paints as a dot, so each splash is born as a drop coming
 * off the corner and stretches into a dash as the head outruns the tail, then
 * shortens as the tail catches up. That is the reference's frames seven and
 * eight: dots just off the corners, then dashes further out.
 */
export function splashPath(list: Drop[], t: number): string {
  const out = (x: number) => 1 - (1 - Math.min(1, Math.max(0, x))) ** 3;
  const head = out(t);
  const tail = out((t - 0.34) / 0.66);
  let d = "";
  for (const p of list) {
    const a = p.start + p.travel * tail;
    const b = p.start + p.travel * head;
    d += `M${f(p.x + p.dx * a)} ${f(p.y + p.dy * a)}L${f(p.x + p.dx * b)} ${f(p.y + p.dy * b)}`;
  }
  return d;
}
