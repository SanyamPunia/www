/*
 * The track and the strand, pure and DOM-free, the split `document-pocket`
 * makes with `poses.ts`.
 *
 * The track is one circle whose lowest point is the button's own centre, so a
 * bubble enters the picture there and rides the circle clockwise, up the left
 * side and over the top. The bubbles are beads on that circle at a fixed
 * spacing, and the whole strand is carried by one scalar, `advance`, which is
 * how far the leader has travelled from the mouth in radians.
 *
 * So every bubble's angle, its scale and whether it is on screen at all come
 * off its own distance from the mouth, `advance - offset`, and one number
 * carries the press, the drag and the keyboard alike. There is no open state
 * and no per-bubble animation to keep in step with another.
 *
 * The scalar runs from 0, where the whole strand is inside the mouth, to
 * `OPEN`, where it is spread. Shutting runs it back down, so the bubbles
 * retract along the arc they came out on and the tail is home first. Carrying
 * them on round the rest of the lap instead was the first build and it is what
 * the reference does, and it reads as a second opening rather than as the menu
 * closing.
 */

/**
 * What rides the track, in strand order: the leader is the first one out of
 * the mouth and the one furthest along once the menu has settled.
 *
 * Each `size` is a share of the track's radius, so the whole arrangement
 * scales with the stage and no call site carries a pixel. The sequence is
 * irregular, big then tiny then middling, which is what makes a row of circles
 * read as an assortment rather than as a carousel of equal dots. It runs 2.5
 * to 1 rather than the reference's 4.4: at that spread the biggest ball is
 * wider than the track it rides and the dial reads as a clump of toys.
 *
 * `marbles.tsx` draws them, and the order here is the order they leave in, so
 * the kinds alternate as well as the sizes: nothing in the strand is beside
 * anything it could be mistaken for.
 */
export const RIDERS = [
  { marble: "corkscrew", size: 0.4 },
  { marble: "oxblood", size: 0.16 },
  { marble: "clearie", size: 0.25 },
  { marble: "catseye", size: 0.32 },
  { marble: "aggie", size: 0.21 },
] as const;

/** the button's radius, as a share of the track's */
const BUTTON = 0.34;

/**
 * Centre to centre between two neighbours, as a share of the two radii it
 * separates, so a big bubble is given more room than a small one and the
 * spacing is a fact about the sizes rather than a number picked by eye. It
 * carries the spread as well: the strand covers 218 degrees of the dial
 * whatever the balls are sized at, so taking them down leaves more ground
 * between them rather than bunching them into a shorter chain.
 */
const SPACING = 1.84;

/** one turn, which the crank needs to unwrap a bearing */
export const LAP = Math.PI * 2;

/**
 * The link between each bubble and the one ahead of it, and the sum of them,
 * which is how far behind the leader each one sits. A rail reads `OFFSET`, and
 * a chain reads `GAP` one link at a time.
 */
export const GAP: number[] = RIDERS.map((rider, i) =>
  i === 0 ? 0 : SPACING * (RIDERS[i - 1].size + rider.size),
);
const OFFSET: number[] = GAP.map((_, i) =>
  GAP.slice(0, i + 1).reduce((a, b) => a + b, 0),
);

/**
 * The settled pose: the leader ten degrees past the far side, which leaves the
 * strand running from the lower left, up and over the top, and down to the
 * right. It is bounded below by the strand's own 218 degrees plus the mouth,
 * so the tail is clear of the button, and above by the lap, so the leader has
 * not gone round. 0.78 of a lap sits in the middle of what is left.
 */
export const OPEN = LAP * 0.78;

/**
 * The arc a bubble's centre needs to travel before it is clear of the button's
 * disc, which is the chord equal to the button's radius. It is what the scale
 * ramps over, so a bubble is at full size exactly when it stops being
 * something the mouth is hiding. Independent of the stage, since both lengths
 * are shares of the same radius.
 */
export const MOUTH = 2 * Math.asin(BUTTON / 2);

/**
 * What a hover on the trigger shows, which is a sliver and not a pose. Three
 * fifths of the mouth, where the leader is two thirds grown and its centre is
 * still inside the button, so what stands past the rim is the top of a ball
 * behind the plus rather than a ball beside it. Measured on the lab column:
 * 10.9px of it, and nothing else has left the mouth at all.
 *
 * Two earlier values were both far too much. Reaching the second bubble takes
 * a whole strand gap, which carries the leader 84px out of the mouth, and
 * clearing it takes a gap and a mouth, which is 108px. Either is the menu
 * opening rather than a hint that it can.
 */
export const PEEK = MOUTH * 0.6;

/** one arrow key */
export const STEP = Math.PI / 12;

/**
 * The share of the stage's height the whole composition takes. The dial is the
 * subject and the stage is the room it stands in, so it is sized to leave
 * ground round it rather than to fill what it is given: at 1 it ran to both
 * edges and read as a poster of itself.
 */
const FILL = 0.7;
/** the least ground at the sides, for the case where the width is what binds */
const PAD = 16;

const smooth = (t: number) => {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return c * c * (3 - 2 * c);
};

/** where bubble `i` sits when the strand is rigid */
export const railAt = (advance: number, i: number) =>
  Math.max(0, advance - OFFSET[i]);

export const clamp = (value: number) =>
  value < 0 ? 0 : value > OPEN ? OPEN : value;

/**
 * Whether the menu is showing rather than shut or peeking, which is what the
 * trigger reports and what a press reverses. The peek is the floor rather than
 * zero, or hovering the plus would arm it to shut something it has not opened.
 */
export const spread = (advance: number) => advance > PEEK + 1e-3;

export interface Geometry {
  /** the track's centre and radius, in stage px */
  cx: number;
  cy: number;
  r: number;
  /** the button, centred on the track's lowest point */
  button: number;
  buttonY: number;
  /** each rider's radius */
  bubble: number[];
}

/**
 * The track sized to the stage. The composition is the biggest bubble's
 * overhang at the top, two radii of track, and the button's overhang at the
 * foot, so one division against the share of the height it is allowed gives
 * the radius, and the same sum centres it in what is left.
 */
export function geometry(w: number, h: number): Geometry {
  const big = Math.max(...RIDERS.map((rider) => rider.size));
  const tall = 2 + big + BUTTON;
  const r = Math.max(
    0,
    Math.min((h * FILL) / tall, (w - 2 * PAD) / (2 * (1 + big))),
  );
  const top = (h - r * tall) / 2;
  return {
    cx: w / 2,
    cy: top + r * (1 + big),
    r,
    button: r * BUTTON,
    buttonY: top + r * (2 + big),
    bubble: RIDERS.map((rider) => rider.size * r),
  };
}

export interface Pose {
  x: number;
  y: number;
  scale: number;
}

/**
 * Where a bubble that has travelled `d` from the mouth is. Zero is the
 * button's centre and the angle runs clockwise from there, up the left side,
 * over the top and down the right. The scale is how far through the mouth it
 * has come, so a bubble still inside paints nothing.
 */
export function poseAt(d: number, g: Geometry): Pose {
  return {
    x: g.cx - g.r * Math.sin(d),
    y: g.cy + g.r * Math.cos(d),
    scale: smooth(d / MOUTH),
  };
}

/**
 * The strand's own angle for a point on the stage, which is the inverse of
 * `poseAt`. A drag reads this rather than the pointer's travel in pixels, so
 * the hand and the leader turn together about one centre.
 */
export function angleAt(dx: number, dy: number): number {
  return Math.atan2(-dx, dy);
}
