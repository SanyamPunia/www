/**
 * The geometry behind the tether: where a web can anchor on the button, the
 * twisted strand between the hand and that anchor, and the splat at its end.
 *
 * Pure functions in stage pixels. The SVG they feed carries no `viewBox`, so one
 * user unit is one pixel and none of this needs a scale correction.
 */

export interface Point {
  x: number;
  y: number;
}

/** the button, in coordinates relative to the stage */
interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const clamp = (v: number, min: number, max: number) =>
  Math.min(Math.max(v, min), max);

/** two decimals. A path rebuilt every frame does not need more. */
const round = (v: number) => Math.round(v * 100) / 100;

/**
 * The point inside the rect inset by its own radius that is nearest `p`, and
 * that radius clamped to what the box can actually carry.
 *
 * This one clamp answers both questions asked of the button's shape. The
 * distance from here to `p` is the distance to the rounded rect's boundary, so
 * comparing it against the radius says whether `p` is inside, and stepping the
 * radius along it lands on the boundary itself.
 */
function nearestInner(box: Box, radius: number, p: Point) {
  const r = Math.min(radius, box.width / 2, box.height / 2);
  return {
    r,
    x: clamp(p.x, box.x + r, box.x + box.width - r),
    y: clamp(p.y, box.y + r, box.y + box.height - r),
  };
}

/**
 * Inside the rounded rect, corners included, which is what decides whether a
 * press shoots a web or is just a press.
 *
 * The radius matters here rather than the bounding box. A pill 35px tall carries
 * a 17.6px radius, so the four corners the box claims and the shape does not add
 * up to about a tenth of it. Testing the box alone meant pressing beside the
 * pill's end registered as pressing the button, and no web came out.
 */
export function contains(box: Box, radius: number, p: Point): boolean {
  const near = nearestInner(box, radius, p);
  return Math.hypot(p.x - near.x, p.y - near.y) <= near.r;
}

/**
 * The nearest point on a rounded rect's boundary, which is where the web
 * anchors. Not the centre: the strand has to stop at the edge it reaches, or it
 * reads as passing through the button rather than sticking to it.
 *
 * An edge clamps one axis, so the direction out is axis aligned and the point
 * lands square on that edge. A corner clamps both, so it lands on the arc. One
 * formula covers all eight cases.
 */
export function anchorOn(box: Box, radius: number, from: Point): Point {
  const near = nearestInner(box, radius, from);

  const dx = from.x - near.x;
  const dy = from.y - near.y;
  const away = Math.hypot(dx, dy);
  if (away === 0) return { x: near.x, y: near.y };

  return {
    x: near.x + (dx / away) * near.r,
    y: near.y + (dy / away) * near.r,
  };
}

/** half the width of the twist, in px */
const AMPLITUDE = 2;
/** axial distance between two crossings, so one lens is this long */
const LENS = 11;
/** px over which the twist opens at each tip, so both ends converge to a point */
const PINCH = 7;

interface Strand {
  core: string;
  left: string;
  right: string;
}

/** how much of the slack becomes bow at the spine's middle */
const SAG_RATIO = 0.5;
/** the bow's ceiling, as a fraction of the run it spans */
const MAX_BOW = 0.6;

/**
 * Two mirrored threads wound around a spine.
 *
 * Each half lobe is one quadratic, so a 500px shot costs about 45 curve
 * commands per path instead of the several hundred points a sampled sine needs.
 * A quadratic also ends pointed rather than round, which is the lens shape the
 * reference draws.
 *
 * `LENS` is a distance, not a count of lobes, so a long shot and a short one are
 * the same material rather than one drawing stretched to two lengths.
 *
 * `slack` is how much more strand there is than gap to span, and it bows the
 * spine. Without it the tether is a straight line at every length, which is what
 * gives away a redrawn line rather than a rope: bringing the hand back toward the
 * anchor should leave silk hanging, not shorten the run.
 */
export function strand(origin: Point, end: Point, slack = 0): Strand {
  const dx = end.x - origin.x;
  const dy = end.y - origin.y;
  const chord = Math.hypot(dx, dy);
  if (chord < 1) return { core: "", left: "", right: "" };

  const ux = dx / chord;
  const uy = dy / chord;
  // the perpendicular that points down the screen, so slack hangs rather than
  // arching over the top
  const down = ux < 0 ? -1 : 1;
  const nx = -uy * down;
  const ny = ux * down;

  /*
   * How far the spine bows at its middle.
   *
   * Scaled by that perpendicular's own downward component, so a horizontal run
   * hangs fully and a vertical one does not bow at all, which is what slack rope
   * hanging straight down looks like. Capped against the run as well: a hand
   * brought right up to the anchor leaves the whole rest length hanging, and
   * drawing that honestly is a loop several times longer than the gap it spans.
   */
  const bow = Math.min(slack * SAG_RATIO * Math.abs(ny), chord * MAX_BOW);

  // a quadratic reaches half its control's offset at the midpoint
  const cx = origin.x + ux * (chord / 2) + nx * bow * 2;
  const cy = origin.y + uy * (chord / 2) + ny * bow * 2;

  const at = (t: number) => {
    const u = 1 - t;
    return {
      x: u * u * origin.x + 2 * u * t * cx + t * t * end.x,
      y: u * u * origin.y + 2 * u * t * cy + t * t * end.y,
    };
  };

  /** the unit normal to the spine at `t`, which is the axis a lobe opens along */
  const normalAt = (t: number) => {
    const tx = 2 * (1 - t) * (cx - origin.x) + 2 * t * (end.x - cx);
    const ty = 2 * (1 - t) * (cy - origin.y) + 2 * t * (end.y - cy);
    const len = Math.hypot(tx, ty) || 1;
    return { x: -ty / len, y: tx / len };
  };

  // the spine's length, not the chord, or a bowed strand stretches its lobes.
  // The usual cheap estimate for a quadratic.
  const arc =
    (2 * chord +
      Math.hypot(cx - origin.x, cy - origin.y) +
      Math.hypot(end.x - cx, end.y - cy)) /
    3;

  const lobes = Math.max(1, Math.round(arc / LENS));
  const step = 1 / lobes;

  const point = (p: Point) => `${round(p.x)} ${round(p.y)}`;

  const head = `M${point(origin)}`;
  let left = head;
  let right = head;

  for (let i = 0; i < lobes; i++) {
    const middle = (i + 0.5) * step;
    const spine = at(middle);
    const n = normalAt(middle);
    // a quadratic reaches half its control's offset at the midpoint, so the
    // control sits at twice the width the lobe should paint
    const reach =
      2 * AMPLITUDE * pinch(middle * arc, arc) * (i % 2 === 0 ? 1 : -1);
    const tail = point(at((i + 1) * step));
    left += `Q${point({ x: spine.x + n.x * reach, y: spine.y + n.y * reach })} ${tail}`;
    right += `Q${point({ x: spine.x - n.x * reach, y: spine.y - n.y * reach })} ${tail}`;
  }

  return {
    core: `${head}Q${point({ x: cx, y: cy })} ${point(end)}`,
    left,
    right,
  };
}

/**
 * The twist closes at both tips, so the strand converges into the hand and into
 * the splat rather than ending on a full width lobe.
 *
 * A distance rather than a fraction of the run. As a fraction the convergence
 * grew with the shot, and three strokes overlapping over 13px read as a blob
 * stuck to the hand instead of a taper.
 */
function pinch(along: number, length: number): number {
  return Math.min(1, along / PINCH, (length - along) / PINCH);
}

const SPOKES = 8;
/**
 * Per spoke length, as a fraction of the radius. A web spun to the same radius
 * on every spoke reads as a machine part. These are fixed rather than random, so
 * the splat is the same shape on every render.
 */
const SPOKE_SCALE = [1, 0.93, 1.04, 0.96, 1, 0.95, 1.02, 0.98];
/** how far a ring sags toward the centre between two spokes */
const SAG = 0.8;
/**
 * Ring radii, as fractions of the splat's own radius. Two, not the three or four
 * a web that size carries, because the whole splat is 20px across here: three
 * rings at a 1px stroke leaves 3px of white between them and the web reads as a
 * grey disc.
 */
const RINGS = [0.55, 0.93];
/**
 * Where a spoke starts, as a fraction of the radius. Eight strokes meeting at one
 * point paint a clot, and the strand's own taper lands there too, so the spokes
 * leave a hub open instead.
 */
const HUB = 0.3;

/**
 * The radius of that open hub, in px. The strand stops here rather than at the
 * anchor: its own taper sitting inside an empty hub reads as a smudge across the
 * middle of the web.
 */
export const splatHub = (radius: number) => radius * HUB;

/**
 * The splat at the anchor: spokes out of the centre, and rings sagging between
 * them.
 *
 * `rotation` is the strand's own direction, so one spoke continues the line into
 * the button and the web reads as the end of that line rather than a sticker
 * placed near it.
 */
export function splat(center: Point, radius: number, rotation: number): string {
  const angle = (i: number) => rotation + ((i % SPOKES) / SPOKES) * Math.PI * 2;
  const reach = (i: number) => radius * SPOKE_SCALE[i % SPOKES];
  const tip = (i: number, r: number) =>
    `${round(center.x + Math.cos(angle(i)) * r)} ${round(
      center.y + Math.sin(angle(i)) * r,
    )}`;

  let d = "";

  for (let i = 0; i < SPOKES; i++) {
    d += `M${tip(i, reach(i) * HUB)}L${tip(i, reach(i))}`;
  }

  for (const ring of RINGS) {
    for (let i = 0; i < SPOKES; i++) {
      const from = reach(i) * ring;
      const to = reach(i + 1) * ring;
      // the control sits on the bisector between the two spokes, pulled in,
      // which is what makes the thread hang rather than run straight
      const bisector = angle(i) + Math.PI / SPOKES;
      const pull = ((from + to) / 2) * SAG;
      const control = `${round(center.x + Math.cos(bisector) * pull)} ${round(
        center.y + Math.sin(bisector) * pull,
      )}`;
      d += `M${tip(i, from)}Q${control} ${tip(i + 1, to)}`;
    }
  }

  return d;
}
