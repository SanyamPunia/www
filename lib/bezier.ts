/**
 * A CSS `cubic-bezier()` as a function of time, for a curve applied by hand to a
 * clock a frame loop or a timeline owns, where no animation library is
 * involved. Solved by bisection on x, then read off y.
 *
 * Moved here from `tide-card` when `scribble-type` became its second caller.
 */
export function bezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): (x: number) => number {
  const on = (t: number, a: number, b: number) =>
    3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t * t * b + t ** 3;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0;
    let hi = 1;
    let t = x;
    // 24 bisections, which lands the parameter inside a ten-millionth
    for (let i = 0; i < 24; i++) {
      t = (lo + hi) / 2;
      if (on(t, x1, x2) < x) lo = t;
      else hi = t;
    }
    return on(t, y1, y2);
  };
}
