/**
 * The numbers and the geometry of the history scrub, pure and DOM-free. The
 * stage reads its own size and asks this file where the disc and the panel
 * go, so nothing here measures.
 */

/** the arrow's disc, and how far it stops from the edge once fully pulled */
export const DISC = 44;
export const INSET = 14;

/** px of sideways travel to arm, by wheel or drag, and where it lets go */
export const PULL = 140;
export const DISARM = 0.82;

/**
 * An armed arrow tells a swipe from a hold. A swipe lifted on the move
 * leaves the trackpad's momentum tail, `TAIL` events that each shrink by a
 * steady share, and carries the arrow `OVERSHOOT` px or more past the arm. A
 * hand that stops to hold slows for a few uneven frames near the threshold
 * and goes quiet. Five events alone was tried first, and a slowing hand
 * passed it, so every hold went back a page
 */
export const TAIL = 8;
export const OVERSHOOT = 60;
/** px of mostly vertical travel on an armed arrow that opens the panel */
export const NUDGE = 16;
/** an armed drag that holds still this long opens the panel */
export const HOLD = 220;

/** a history row, the panel's padding round them, and its width */
export const ROW = 36;
export const PAD = 6;
export const PANEL_W = 232;

/** px of vertical travel that pushes the highlight on to the next row */
export const DETENT = 44;
/** how far a row gives under the hand before the detent, as a share of a row */
export const GIVE = 0.3;

/** a wheel run that goes quiet this long has lifted or is resting */
export const GAP = 140;
/** a resting panel commits after this long, shown by the highlight filling */
export const DWELL = 320;
/**
 * The panel holds this long after it opens before any fill starts, so it can
 * be read before it starts counting down
 */
export const SETTLE = 1000;
/**
 * px under which a wheel event in an open panel is ignored. Fingers that drift
 * as they lift trail tiny deltas for a while, and each one used to restart the
 * fill, so a lift on the right row sometimes took over a second to land
 */
export const TRICKLE = 1.5;

export type Side = "back" | "forward";

/** the entries one side lists, oldest at the top, and the row it starts on */
export function listFor(
  total: number,
  index: number,
  side: Side,
): { from: number; count: number; start: number } {
  if (side === "back") return { from: 0, count: index, start: index - 1 };
  return { from: index + 1, count: total - 1 - index, start: 0 };
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
}

const ease = (t: number) => 1 - (1 - t) ** 3;

/** the disc at a pull of `p`, sliding in from behind its edge */
export function discRect(p: number, side: Side, width: number, cy: number) {
  const left = -DISC + (DISC + INSET) * ease(Math.min(1, Math.max(0, p)));
  const x = side === "back" ? left : width - left - DISC;
  return { x, y: cy - DISC / 2, w: DISC, h: DISC, r: DISC / 2 };
}

/**
 * The panel, placed so the row at `pos` (fractional while it springs) sits on
 * the arrow's line. The highlight never moves: the panel does.
 */
export function panelRect(
  count: number,
  pos: number,
  side: Side,
  width: number,
  cy: number,
): Rect {
  const w = Math.min(PANEL_W, width - INSET * 2);
  const x = side === "back" ? INSET : width - INSET - w;
  // one more px each way for the border, so a row's centre lands on `cy`
  const y = cy - PAD - ROW / 2 - pos * ROW - 1;
  return { x, y, w, h: count * ROW + PAD * 2 + 2, r: 14 };
}

export function mix(a: Rect, b: Rect, t: number): Rect {
  const l = (u: number, v: number) => u + (v - u) * t;
  return {
    x: l(a.x, b.x),
    y: l(a.y, b.y),
    w: l(a.w, b.w),
    h: l(a.h, b.h),
    r: l(a.r, b.r),
  };
}

/**
 * Where the list sits for `acc` px of vertical travel toward the next row: it
 * gives a little and holds, so passing a row takes a push and not a drift.
 * Against either end it gives half as much, on the same straight line, so
 * turning round at the end never jumps between two curves.
 */
export function give(acc: number, atEnd: boolean): number {
  return (acc / DETENT) * (atEnd ? GIVE / 2 : GIVE);
}

/** the momentum tail: `TAIL` sizes in a row, each a steady share of the last */
export function isTail(sizes: readonly number[]): boolean {
  if (sizes.length < TAIL) return false;
  const tail = sizes.slice(-TAIL);
  const first = tail[0] ?? 0;
  const last = tail[TAIL - 1] ?? 0;
  if (first < 3 || last > first * 0.8) return false;
  const ratios: number[] = [];
  for (let i = 1; i < TAIL; i++) {
    const prev = tail[i - 1] ?? 0;
    const next = tail[i] ?? 0;
    if (prev <= 0 || next > prev * 1.02 || next < prev * 0.7) return false;
    ratios.push(next / prev);
  }
  // a hand's slowdown changes pace as it goes, momentum keeps one
  return Math.max(...ratios) - Math.min(...ratios) < 0.15;
}
