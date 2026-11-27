/*
 * The physics behind the hop, with no timeline in it. Every value that moves
 * is either thrown under gravity or held by a damped spring, and a change of
 * plan changes a target or adds an impulse, never a value. So whatever the
 * shape is doing when something happens, it carries on from there.
 */

/** a damped spring on one value: `x` is the offset from rest, `v` its speed */
export interface Spring {
  x: number;
  v: number;
}

export function spring(): Spring {
  return { x: 0, v: 0 };
}

/** one step of a damped spring towards `target`, semi-implicit Euler */
export function step(
  s: Spring,
  target: number,
  k: number,
  c: number,
  dt: number,
) {
  s.v += (-k * (s.x - target) - c * s.v) * dt;
  s.x += s.v * dt;
}

export function resting(s: Spring, eps = 0.002): boolean {
  return Math.abs(s.x) < eps && Math.abs(s.v) < eps * 10;
}

/*
 * Springs, as stiffness and damping. The squash rings about twice before it
 * rests, the way something soft does when it lands. The lean is heavier and
 * slower, so it trails the path rather than snapping to it.
 */
export const SQUASH = { k: 520, c: 14 };
export const LEAN = { k: 260, c: 15 };
export const RECOIL = { k: 640, c: 20 };

/**
 * The throw for a flight: its time and gravity. Longer hops take longer and go
 * higher, and gravity is whatever brings that height down in that time.
 */
export function plan(dist: number): { time: number; gravity: number } {
  const time = Math.min(Math.max(0.4 + dist / 1100, 0.42), 0.66);
  const lift = Math.min(Math.max(dist * 0.45, 26), 70);
  return { time, gravity: (8 * lift) / (time * time) };
}

/**
 * The velocity that reaches `to` from `from` in `t` seconds under `g`. Asked
 * again every step, it holds the shape on its parabola, and after a retarget
 * the shape is steered onto the new one instead of turned on the spot.
 */
export function aim(
  from: { x: number; y: number },
  to: { x: number; y: number },
  t: number,
  g: number,
): { vx: number; vy: number } {
  const r = Math.max(t, 1 / 120);
  return {
    vx: (to.x - from.x) / r,
    vy: (to.y - from.y - 0.5 * g * r * r) / r,
  };
}
