/*
 * The signature's own timing, turned into something scrubbable.
 *
 * The footer's mark runs on two CSS animations in `app/globals.css`, one per
 * stroke, each with its own duration and delay. That is fine for a reveal that
 * only ever plays forward once, and useless for a player: there is no single
 * value to seek. So the same numbers are restated here as one progress axis, and
 * every dash offset is derived from it.
 *
 * The numbers are the stylesheet's. If those change, these change with them.
 */

/** each stroke's own duration, in seconds, in writing order */
const STROKE = [1.1, 0.4] as const;

/**
 * The pen lift between them.
 *
 * `globals.css` starts the first stroke at 0.35s and ends it at 1.45s, then
 * starts the second at 1.53s. That 0.08s is the one lift the mark has, and it is
 * kept rather than closed up: on the scrubber it is a short plateau where the ink
 * does not grow, which is the whole reason the mark is two paths and not one.
 */
const LIFT = 0.08;

/** the whole write, from first ink to last */
export const DURATION = STROKE[0] + LIFT + STROKE[1];

/**
 * The dash offset an undrawn stroke rests at.
 *
 * `pathLength="1"` on every path is what keeps this a plain number instead of
 * something `getTotalLength()` has to measure. The pattern is `1 2` and rests at
 * 1.02, not `1` and 1: a pattern of `1` repeats every two path lengths, so at
 * offset 1 a dash begins exactly on the end of the path, and a zero-length dash
 * under `stroke-linecap: round` paints as a dot sitting past the end of the mark.
 * The gap of 2 puts that repeat out of reach and the 0.02 keeps the pattern's
 * other boundary off the start.
 */
export const REST = 1.02;
export const DASH = "1 2";

/**
 * How much of each stroke is drawn at a given progress, 0 to 1, in writing order.
 *
 * Both the ink and the scrubber's two sections read this, so a section fills by
 * exactly the number that moves its stroke's dash. They cannot disagree.
 */
export function drawnAt(progress: number): number[] {
  const at = progress * DURATION;

  return [at / STROKE[0], (at - STROKE[0] - LIFT) / STROKE[1]].map(clamp);
}

/** each stroke's dash offset at a given progress, in writing order */
export function offsetsAt(progress: number): number[] {
  return drawnAt(progress).map((drawn) => REST * (1 - drawn));
}

/**
 * Each stroke's own span of the progress axis, which is what the scrubber draws.
 *
 * The track is these two sections rather than one bar, so the pen lift is the gap
 * between them. A dead band you can see is worth more than a tick naming it: the
 * gap says the ink stops there and starts again, at every moment, without being
 * read.
 */
export const SEGMENTS = [
  { from: 0, to: STROKE[0] / DURATION },
  { from: (STROKE[0] + LIFT) / DURATION, to: 1 },
] as const;

/**
 * Which stroke the pen is on and how far along it, or null when the pen is up.
 *
 * Null at both ends and through the lift, which is what takes the nib off the
 * page exactly when the real pen left it.
 */
export function nibAt(progress: number): { index: number; at: number } | null {
  if (progress <= 0 || progress >= 1) return null;

  const at = progress * DURATION;
  if (at < STROKE[0]) return { index: 0, at: at / STROKE[0] };
  if (at < STROKE[0] + LIFT) return null;
  return { index: 1, at: (at - STROKE[0] - LIFT) / STROKE[1] };
}

/**
 * The axis under the track: a tick every 0.1s, labelled every other one.
 *
 * The write is 1.58s, so the last tick is at 1.5 and the track runs a little past
 * it. That is what an axis over a total that is not a round number looks like.
 */
export const TICKS = Array.from(
  { length: Math.floor(DURATION / 0.1) + 1 },
  (_, i) => {
    const seconds = i / 10;
    return {
      at: seconds / DURATION,
      label: i % 2 === 0 ? (i === 0 ? "0" : seconds.toFixed(1)) : undefined,
    };
  },
);

/** how long is left to play from here, so a seek does not replay what is drawn */
export function remaining(progress: number): number {
  return DURATION * (1 - clamp(progress));
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}
