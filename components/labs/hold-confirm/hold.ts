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

/** how long a fired button holds its red before it puts itself back */
export const RESET_MS = 1500;

/**
 * How much the button grows by the end of a hold, in px. Real width and
 * height, never a scale: a scale would smear the label sideways, which is why
 * nothing on this site scales on press. About 9% wider and 10% taller.
 */
export const GROW_W = 18;
export const GROW_H = 4;

/** the lid's centre in the 24 unit box, which a toss spins it about */
export const LID_CENTRE = "12 4.9";

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

/**
 * How much the button has grown. The square of `p`, so it barely moves early
 * and swells into the end, which is where the tension is.
 */
export function growOf(p: number): number {
  return p * p;
}

export interface Toss {
  /** how high the lid goes, in the bin's 24 unit box */
  height: number;
  /** how far it drifts sideways at the top of the arc */
  drift: number;
  /** whole turns, signed, so it lands the right way up */
  turns: number;
}

/**
 * Where the lid goes when the hold lands. The press kicks it away from its own
 * side, so a hold from the right throws the lid left, and every other throw is
 * a double flip, so two in a row never look the same. It always lands back on
 * the bin, since the lid is the bin's.
 */
export function tossOf(origin: number, count: number): Toss {
  const away = 0.5 - origin;
  const side = away === 0 ? (count % 2 === 0 ? 1 : -1) : Math.sign(away);
  return {
    height: 40 + Math.abs(away) * 14 + (count % 2) * 6,
    drift: side * (5 + Math.abs(away) * 12),
    turns: side * (count % 2 === 0 ? 1 : 2),
  };
}
