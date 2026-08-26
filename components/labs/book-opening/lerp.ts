/*
 * The whole experiment runs on the two functions below. There is no spring
 * anywhere in this lab, and no keyframe: every sheet's angle is one
 * interpolation between shut and open, and the only thing that moves is how far
 * along that line the current frame sits.
 */

/**
 * `a * (1 - t) + b * t`, and not `a + (b - a) * t`.
 *
 * The two are one line of algebra and two different floating point
 * expressions. This one is exact at both ends, since t of 0 leaves `a * 1` and
 * t of 1 leaves `b * 1`. The other form finishes on `a + (b - a)`, which rounds
 * twice and lands near b rather than on it: at a of 100 and b of 0.1 it returns
 * 0.09999999999999432. The cost is that this form can step backwards by an ulp
 * where the other is monotone, which nothing here can see.
 *
 * **Nothing in this file depends on that exactness**, and it is still the form
 * to write. The loop below snaps inside `EPSILON` rather than waiting on a last
 * ulp, and the CSS multiply each sheet carries is the a of 0 case, where both
 * forms agree. The reason to have the right one in front of you is that the
 * other one fails silently the first time a lerp is asked for its own endpoint,
 * which is the call every seek and every snap makes.
 */
export function lerp(a: number, b: number, t: number): number {
  return a * (1 - t) + b * t;
}

/**
 * The share of the remaining distance to cover in `dt` seconds, given a time
 * constant.
 *
 * A fixed share per frame is what everyone writes first, and it is a different
 * curve on every display: 0.15 of the gap per frame settles in half the time on
 * a 120Hz screen that it does on a 60Hz one. Asking for a share of the gap per
 * *second* and converting it with the frame's own `dt` is what makes the book
 * open at one speed on both.
 *
 * `tau` is that time constant, in seconds. The gap is down to 37% of itself
 * after tau, and to 2% after four of them, whatever the refresh rate.
 */
export function approach(tau: number, dt: number): number {
  return 1 - Math.exp(-dt / tau);
}

export function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}
