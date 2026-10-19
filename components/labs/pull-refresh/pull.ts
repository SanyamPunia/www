/**
 * The pull, as numbers. Pure and DOM-free, the split `document-pocket` makes
 * with `poses.ts`.
 *
 * The list has one value, `y`, how far it has been pulled down in px. The
 * finger's travel goes through the rubber band to become `y`, and every other
 * part reads `y`: the gap above the list, how many of the spinner's ticks have
 * appeared, and whether the pull has passed the point where a refresh starts.
 */

/** how far the list must be pulled, as painted, before a refresh starts */
export const THRESHOLD = 64;

/** where the list rests while it refreshes, which is the spinner's own room */
export const HOLD = 52;

/** how long a refresh takes, since nothing is fetched */
export const LOAD_MS = 1300;

/** the spinner's ticks, which is what iOS draws */
export const TICKS = 8;

/**
 * Soft resistance, the curve UIScrollView uses. The list follows the finger
 * less the further it goes, so a pull feels like stretching something and
 * never like hitting a wall. At `c` 0.7 over a 230px card the threshold is
 * about 110px of hand.
 */
export function rubberband(raw: number, dimension: number, c = 0.7): number {
  return (raw * dimension * c) / (dimension + c * Math.abs(raw));
}

/**
 * The rubber band run backwards: how much hand puts the list at `y`. A pull
 * that starts on a list already resting at `HOLD` continues from the hand
 * that would have put it there, so it does not jump.
 */
export function unband(y: number, dimension: number, c = 0.7): number {
  const a = Math.min(Math.abs(y), dimension * 0.99);
  return (Math.sign(y) * (a * dimension)) / (c * (dimension - a));
}

/** how far through the pull to the threshold, 0 to 1 */
export function progress(y: number): number {
  return Math.min(1, Math.max(0, y / THRESHOLD));
}

/**
 * How visible tick `i` is while pulling. The ticks appear one after another,
 * clockwise from the top, each fading in over its own eighth of the pull, so
 * the spinner draws itself as the hand goes.
 */
export function tickOpacity(p: number, i: number): number {
  return Math.min(1, Math.max(0, p * TICKS - i));
}

/**
 * Each tick's opacity while spinning, a trail behind the leading tick. The
 * whole spinner turns in eighths, so the trail is what moves.
 */
export function trailOpacity(i: number): number {
  return Math.max(0.25, 1 - i * 0.11);
}

/** the age line under the list */
export function age(updatedAt: number, now: number): string {
  const min = Math.floor((now - updatedAt) / 60000);
  if (min < 1) return "Updated just now";
  if (min === 1) return "Updated 1 minute ago";
  return `Updated ${min} minutes ago`;
}
