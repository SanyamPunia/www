/*
 * The sphere as numbers: where its dots sit, how fast it spins at rest, how a
 * throw slows, and how hard a fast spin squashes it. Pure and DOM-free, so the
 * component is only the hand and the paint.
 *
 * The squash is the cruitical landing page's post ring, moved onto a ball. A
 * spinning body really does this: the equator is pushed out and the poles come
 * in, so the faster it turns, the flatter it gets.
 */

/** The sphere's radius as a share of the stage's shorter side */
export const RADIUS_SHARE = 0.3;
/** How far above the equator the eye sits (radians), so the top pole shows */
export const TILT = 0.32;
/** How many dots, and the half-width of the dark seam that shows the turn (radians) */
export const DOTS = 720;
export const SEAM = 0.11;

/** The turn at rest (radians a second), and how much of a throw's extra speed is kept a frame */
export const SPIN = 0.5;
export const FRICTION = 0.94;

/*
 * The squash. Below `from` (radians a second) it never squashes, so an ordinary
 * drag turns a round ball, and at `full` it is at its flattest. Between the two
 * it builds on a square, so the first part of the range barely moves it and a
 * hard spin is what earns the flattening. The amount follows
 * the speed on a spring at a 0.5 damping ratio, so it overshoots a little as it
 * lets go and the ball stands briefly taller than round before settling.
 */
export const SQUASH = {
  from: 10,
  full: 32,
  press: 0.26,
  widen: 0.12,
  blur: 2.5,
  stiffness: 260,
  damping: 16,
} as const;

export interface Dot {
  lat: number;
  lon: number;
  seam: boolean;
}

/** Dots spread evenly over the sphere on a Fibonacci spiral, so no pole bunches up */
export function dots(count: number): Dot[] {
  const golden = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: count }, (_, i) => {
    const y = 1 - ((i + 0.5) / count) * 2;
    const lon = (i * golden) % (Math.PI * 2);
    const wrapped = lon > Math.PI ? lon - Math.PI * 2 : lon;
    return { lat: Math.asin(y), lon, seam: Math.abs(wrapped) < SEAM };
  });
}

/*
 * The speed the squash reads is not the speed this frame. It climbs toward it
 * slowly, a 0.45s time constant, and falls back quicker, 0.2s, so one flick
 * spikes the turn for a moment and barely registers. Only a spin kept going,
 * flick after flick, builds the speed up far enough to flatten the ball.
 */
export const BUILD = { rise: 0.45, fall: 0.2 } as const;

/*
 * The ticks, after the landing page's post ring: a detent every 15 degrees of
 * turn, heard only while the reader is turning it (a drag, a swipe, a key, or
 * a throw still running above `THROWN` times the rest spin), never more often
 * than `MS`, and quiet.
 */
export const TICK = { perTurn: 24, ms: 50, volume: 0.35, thrown: 1.5 } as const;

/** How squashed the ball wants to be at a speed, 0 when round and 1 at its flattest */
export function squashGoal(speed: number): number {
  const t = (speed - SQUASH.from) / (SQUASH.full - SQUASH.from);
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  return clamped * clamped;
}
