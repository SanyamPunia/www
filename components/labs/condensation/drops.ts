/*
 * Running drops, pure and DOM-free.
 *
 * A wipe pushes water ahead of the brush, and the water left at the foot of a
 * stroke gathers into drops. A drop over 3.3px is heavy enough to run: it eases
 * toward a speed set by its size, stalls now and then on a dry patch, wanders a
 * little as it goes, and loses water to the glass behind it, which is the wet
 * trail it paints back into the field as a segment. Two drops that touch merge
 * into one with their combined area. A drop under 1.3px has dried.
 */

import { MAXD } from "./shader";

export interface Drop {
  x: number;
  y: number;
  /** last frame's place, so a running drop can paint the stretch it covered */
  px: number;
  py: number;
  r: number;
  v: number;
  pause: number;
  /** how far it is drawn out behind itself, from its speed */
  stretch: number;
  seed: number;
}

/** a wet trail, in the field's own segment shape */
export type Trail = (
  ax: number,
  ay: number,
  bx: number,
  by: number,
  r: number,
  strength: number,
  rim: number,
  film: number,
) => void;

export function spawn(drops: Drop[], x: number, y: number, r: number) {
  if (drops.length >= MAXD) return;
  drops.push({
    x,
    y,
    px: x,
    py: y,
    r,
    v: 0,
    pause: 0,
    stretch: 0,
    seed: Math.random() * 100,
  });
}

export function step(drops: Drop[], dt: number, floor: number, trail: Trail) {
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    if (!d) continue;
    d.px = d.x;
    d.py = d.y;
    if (d.r > 3.3) {
      if (d.pause > 0) {
        d.pause -= dt;
        d.v *= 0.8;
      } else {
        const target =
          (d.r - 2.9) *
          42 *
          (0.7 + 0.6 * Math.sin(d.seed + d.y * 0.03) * 0.5 + 0.3);
        d.v += (target - d.v) * Math.min(1, dt * 6);
        if (Math.random() < dt * 0.9) d.pause = 0.08 + Math.random() * 0.6;
      }
      d.y += d.v * dt;
      d.x += Math.sin(d.y * 0.045 + d.seed) * d.v * dt * 0.12;
      d.r -= dt * (0.06 + d.v * 0.0035);
      if (d.v > 6) {
        trail(d.px, d.py, d.x, d.y, d.r * 0.95, 1, 0.3, 0.75);
        // a running drop sheds a bead now and then, left behind on the trail
        if (Math.random() < dt * 1.6) {
          spawn(
            drops,
            d.x + (Math.random() - 0.5) * 2,
            d.y - d.r * 2.5,
            1.5 + Math.random() * 0.8,
          );
        }
      }
    } else {
      d.v = 0;
      d.r -= dt * 0.035;
    }
    d.stretch += (Math.min(1.4, d.v * 0.025) - d.stretch) * Math.min(1, dt * 8);
    if (d.r < 1.3 || d.y > floor + 20) drops.splice(i, 1);
  }

  for (let i = 0; i < drops.length; i++) {
    for (let j = i + 1; j < drops.length; j++) {
      const a = drops[i];
      const b = drops[j];
      if (!a || !b || a.r <= 0 || b.r <= 0) continue;
      if (Math.hypot(a.x - b.x, a.y - b.y) < (a.r + b.r) * 0.85) {
        const [big, small] = a.r >= b.r ? [a, b] : [b, a];
        big.r = Math.min(6.5, Math.sqrt(big.r * big.r + small.r * small.r));
        small.r = 0;
      }
    }
  }
  for (let i = drops.length - 1; i >= 0; i--) {
    if ((drops[i]?.r ?? 0) <= 0) drops.splice(i, 1);
  }
}
