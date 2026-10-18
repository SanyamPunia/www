/**
 * The swipe, as numbers. Pure and DOM-free, the split `document-pocket` makes
 * with `poses.ts`.
 *
 * A row has one value, `x`, its offset from rest in px. Negative uncovers the
 * trailing actions, positive the leading one. Every decision the gesture makes
 * is a function of `x`, the release velocity and the row's width, so a drag, a
 * trackpad swipe and an arrow key all go through the same three functions.
 */

/** px of travel before a press is read as a swipe or a scroll */
export const SLOP = 8;

/** how much more horizontal than vertical a move must be to count as a swipe */
export const AXIS = 1.2;

/**
 * Past this share of the row's width the far action arms, and under the lower
 * share it lets go again. The gap is hysteresis, so a hand resting on the line
 * does not flicker the action on and off.
 */
export const ARM = 0.52;
export const DISARM = 0.44;

/** a trackpad swipe has ended once no wheel event has come for this long */
export const WHEEL_IDLE_MS = 90;

/** one action button's width, a share of the row with a floor and a ceiling */
export function buttonWidth(w: number): number {
  return Math.min(80, Math.max(64, w * 0.2));
}

/**
 * Apple's momentum projection, from the *Designing Fluid Interfaces* sample
 * code: where a flick would come to rest if it decayed like a scroll view. A
 * rate of 0.99 is the snappy end, which suits a row more than a page.
 */
export function project(velocity: number, rate = 0.99): number {
  return ((velocity / 1000) * rate) / (1 - rate);
}

/**
 * Soft resistance past a limit. The further past, the less the row follows,
 * the curve UIScrollView uses, so the edge reads as "nothing more here" rather
 * than as a wall.
 */
export function rubberband(over: number, dimension: number, c = 0.55): number {
  return (over * dimension * c) / (dimension + c * Math.abs(over));
}

/**
 * Where the finger's offset puts the row. One to one up to most of its width,
 * then the rubber band, so a full swipe always has somewhere to go.
 */
export function follow(raw: number, w: number): number {
  const limit = w * 0.92;
  if (Math.abs(raw) <= limit) return raw;
  const sign = Math.sign(raw);
  return sign * (limit + rubberband(Math.abs(raw) - limit, w));
}

export type Side = "leading" | "trailing";

/** whether the far action is armed, given whether it already was */
export function armed(x: number, w: number, was: boolean): boolean {
  const share = Math.abs(x) / w;
  return was ? share > DISARM : share > ARM;
}

export type Outcome =
  | { kind: "rest" }
  | { kind: "open"; side: Side }
  | { kind: "commit"; side: Side };

/**
 * What a release does. An armed row commits. Otherwise the row goes where its
 * momentum would carry it, not where the finger let go: the projected rest is
 * compared against half the open width, which is what makes a short flick
 * open a row and a slow drag back close it.
 */
export function settle(
  x: number,
  velocity: number,
  w: number,
  isArmed: boolean,
): Outcome {
  const side: Side = x < 0 ? "trailing" : "leading";
  if (isArmed && x !== 0) return { kind: "commit", side };
  const b = buttonWidth(w);
  const rest = x + project(velocity);
  if (rest <= -b) return { kind: "open", side: "trailing" };
  if (rest >= b / 2) return { kind: "open", side: "leading" };
  return { kind: "rest" };
}

/** the offset a side rests at when it is open */
export function openAt(side: Side, w: number): number {
  const b = buttonWidth(w);
  return side === "trailing" ? -2 * b : b;
}
