/**
 * The hold, as numbers. Pure and DOM-free, the split `document-pocket` makes
 * with `poses.ts`.
 *
 * One value, `p`, runs 0 to 1. Holding adds to it at one rate, so it measures
 * time honestly: a linear fill is the only curve that does not lie about how
 * long is left. Letting go drains it on an exponential, so the cancel is fast
 * and gentle at once, and a press during the drain catches `p` where it is.
 * Nothing restarts from zero.
 */

/** how long a hold takes, from empty to deleted */
export const HOLD = 1.2;

/** the drain's time constant. `p` is under 3% of itself after 250ms */
export const DRAIN = 0.07;

/** a release this soon after the press is a tap, which earns the hint */
export const TAP_MS = 240;

/** how far a pointer may wander off the button before the hold lets go */
export const SLIP = 16;

/** the ratchet: how many ticks a full hold makes */
export const TICKS = 12;

/** the lid's widest opening, in degrees, and where it starts to rattle */
export const LID_OPEN = 34;
export const RATTLE_AT = 0.8;

/** how long the undo stays offered */
export const UNDO_S = 5;

/** how long a file takes to fly between the row and the trash */
export const FLIGHT_MS = 520;

export function advance(p: number, held: boolean, dt: number): number {
  if (held) return Math.min(1, p + dt / HOLD);
  const next = p * Math.exp(-dt / DRAIN);
  return next < 0.002 ? 0 : next;
}

/** the tick the ratchet is on, so a crossing can be heard once */
export function tickOf(p: number): number {
  return Math.floor(p * TICKS + 1e-6);
}

/**
 * The fill's box inside a `w` by `h` pill, in px.
 *
 * The fill is a drop of ink that spreads from the press. Its width is `p * w`,
 * so its area tracks time, and it is placed so its two edges reach the pill's
 * two ends on the same frame: the left edge sits at `origin * w * (1 - p)`. Its
 * height is its width until it reaches the pill's, so with a full radius it is
 * a circle under the finger first and a pill after.
 */
export function inkBox(
  p: number,
  origin: number,
  w: number,
  h: number,
): { left: number; right: number; top: number; bottom: number } {
  const width = p * w;
  const left = origin * w * (1 - p);
  const height = Math.min(h, width);
  const v = (h - height) / 2;
  return { left, right: w - left - width, top: v, bottom: v };
}

/**
 * How far the lid is open. It lifts most at the start of the hold, since a lid
 * coming up is the first thing that says the press was understood, and past
 * `RATTLE_AT` it rattles, a little more each frame, the closer the hold gets.
 */
export function lidAngle(p: number, t: number): number {
  const open = LID_OPEN * (1 - (1 - p) ** 2);
  if (p <= RATTLE_AT) return open;
  const k = (p - RATTLE_AT) / (1 - RATTLE_AT);
  return open + Math.sin(t * Math.PI * 2 * 17) * 3.2 * k;
}

/** a CSS cubic-bezier's ease-in-out, cheap enough to sample for a keyframe arc */
function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * The flight between the row's file and the trash's mouth, as keyframes.
 *
 * A quadratic arc whose control sits above both ends, so the file is lobbed
 * rather than slid. It is sampled rather than eased per axis because the arc
 * and the timing have to share one curve: the position along the arc is the
 * eased time, and the file shrinks and tips on that same eased time, so it
 * reads as one object travelling.
 */
export function flight(
  from: Point,
  to: Point,
  size: number,
  end: number,
  out: boolean,
): Keyframe[] {
  const lift = Math.max(46, Math.abs(to.x - from.x) * 0.22);
  const c = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - lift };
  const frames: Keyframe[] = [];
  const n = 24;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const e = easeInOut(t);
    const u = 1 - e;
    const x = u * u * from.x + 2 * u * e * c.x + e * e * to.x;
    const y = u * u * from.y + 2 * u * e * c.y + e * e * to.y;
    // a file keeps its size for most of the trip and shrinks into the mouth,
    // since one that shrinks on leaving is a speck for the whole flight
    const scale = out
      ? end + (1 - end) * (1 - (1 - e) ** 2)
      : 1 - (1 - end) * e ** 2;
    const tip = (out ? 1 - e : e) * -16;
    const fade = out ? Math.min(1, t / 0.15) : Math.min(1, (1 - t) / 0.15);
    frames.push({
      offset: t,
      opacity: fade,
      transform: `translate(${x - size / 2}px, ${y - size / 2}px) scale(${scale}) rotate(${tip}deg)`,
    });
  }
  return frames;
}
