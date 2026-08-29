/*
 * Interpolation, for the experiments that drive a value by hand rather than
 * handing it to Motion.
 *
 * This started in `components/labs/book-opening/`, where the whole experiment
 * runs on the two functions below. `window-shade` needs the same three, so they
 * moved here rather than being copied, which is the drift a shared helper exists
 * to stop.
 */

/**
 * `a * (1 - t) + b * t`, and not `a + (b - a) * t`.
 *
 * The two are one line of algebra and two different floating point
 * expressions. This one is exact at both ends, since t of 0 leaves `a * 1` and
 * t of 1 leaves `b * 1`. The other form finishes on `a + (b - a)`, which rounds
 * twice and lands near b rather than on it: at a of 100 and b of 0.1 it returns
 * 0.09999999999999432. The cost is that this form can step backwards by an ulp
 * where the other is monotone, which nothing calling it can see.
 *
 * **No caller depends on that exactness**, and it is still the form to write.
 * Both loops using it snap inside an epsilon rather than waiting on a last ulp.
 * The reason to have the right one in front of you is that the other one fails
 * silently the first time a lerp is asked for its own endpoint, which is the
 * call every seek and every snap makes.
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
 * *second* and converting it with the frame's own `dt` is what makes a gesture
 * run at one speed on both.
 *
 * `tau` is that time constant, in seconds. The gap is down to 37% of itself
 * after tau, and to 2% after four of them, whatever the refresh rate.
 *
 * Nothing driven by this can overshoot, since a lerp toward a target cannot pass
 * it. That is the reason both callers reach for it rather than a spring: paper
 * does not bounce and neither does a window shade.
 */
export function approach(tau: number, dt: number): number {
  return 1 - Math.exp(-dt / tau);
}

export function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}
