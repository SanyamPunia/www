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

/**
 * Two mirrored threads wound around a straight core.
 *
 * Each half lobe is one quadratic, so a 500px shot costs about 45 curve
 * commands per path instead of the several hundred points a sampled sine needs.
 * A quadratic also ends pointed rather than round, which is the lens shape the
 * reference draws.
 *
 * `LENS` is a distance, not a count of lobes, so a long shot and a short one are
 * the same material rather than one drawing stretched to two lengths.
 */
export function strand(origin: Point, tip: Point): Strand {
  const dx = tip.x - origin.x;
  const dy = tip.y - origin.y;
  const length = Math.hypot(dx, dy);
  if (length < 1) return { core: "", left: "", right: "" };

  const ux = dx / length;
  const uy = dy / length;
  // perpendicular to the run, which is the axis the twist opens along
  const nx = -uy;
  const ny = ux;

  const at = (along: number, across: number) =>
    `${round(origin.x + ux * along + nx * across)} ${round(
      origin.y + uy * along + ny * across,
    )}`;

  const lobes = Math.max(1, Math.round(length / LENS));
  const step = length / lobes;

  const start = `M${at(0, 0)}`;
  let left = start;
  let right = start;

  for (let i = 0; i < lobes; i++) {
    const middle = (i + 0.5) * step;
    // a quadratic reaches half its control's offset at the midpoint, so the
    // control sits at twice the width the lobe should paint
    const reach =
      2 * AMPLITUDE * pinch(middle, length) * (i % 2 === 0 ? 1 : -1);
    const end = at((i + 1) * step, 0);
    left += `Q${at(middle, reach)} ${end}`;
    right += `Q${at(middle, -reach)} ${end}`;
  }

  return { core: `${start}L${at(length, 0)}`, left, right };
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
