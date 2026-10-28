/**
 * The sheet, as numbers. Pure and DOM-free, the split `document-pocket` makes
 * with `poses.ts`.
 *
 * The sheet has one value, `y`, the distance from the screen's top to the
 * sheet's top in px. Three detents are three values of it. Everything else on
 * the screen is a function of `y`: how far the map behind is pushed back, the
 * sheet's top corners, the favourites fading in, and where the map keeps
 * its centre. `level` turns `y` into one number for all of those.
 */

export type Detent = "peek" | "half" | "full";

/** shortest to tallest, which is the order the arrow keys walk */
export const DETENTS: readonly Detent[] = ["peek", "half", "full"];

export const DETENT_LABEL: Record<Detent, string> = {
  peek: "Collapsed",
  half: "Half height",
  full: "Full height",
};

/** how much of the sheet shows at the peek: the grabber and the search row */
export const PEEK = 68;

/** the gap above the sheet at full height, where the map shows pushed back */
export const FULL_TOP = 26;

/** the half detent, as a share of the screen's height */
export const HALF = 0.5;

/** px before a press is a drag rather than a tap */
export const SLOP = 5;

/** past this speed a release always leaves its detent, in px/s */
export const FLICK = 420;

/** where the sheet's top sits at a detent */
export function detentY(d: Detent, h: number): number {
  if (d === "full") return FULL_TOP;
  if (d === "half") return Math.round(h * HALF);
  return h - PEEK;
}

/**
 * Apple's momentum projection, from the *Designing Fluid Interfaces* sample
 * code: where a throw would come to rest if it decayed like a scroll view. A
 * rate of 0.995 sits between `swipe-row`'s snappy 0.99 and a page's 0.998,
 * since a sheet is heavier than a row and lighter than a page.
 */
export function project(velocity: number, rate = 0.995): number {
  return ((velocity / 1000) * rate) / (1 - rate);
}

/**
 * Where a release sends the sheet. The nearest detent to where the throw would
 * come to rest, so a fast flick can skip a detent and a slow drag lands on the
 * one it is nearest. A flick that would come to rest on the detent it left
 * still moves one detent its way, since a reader who flicked asked for a move.
 */
export function settle(
  y: number,
  velocity: number,
  h: number,
  from: Detent,
): Detent {
  const rest = y + project(velocity);
  let best: Detent = "peek";
  let gap = Number.POSITIVE_INFINITY;
  for (const d of DETENTS) {
    const g = Math.abs(detentY(d, h) - rest);
    if (g < gap) {
      gap = g;
      best = d;
    }
  }
  if (best === from && Math.abs(velocity) > FLICK) {
    const i = DETENTS.indexOf(from);
    // y grows downward, so a positive velocity is toward a shorter detent
    const j = Math.min(
      DETENTS.length - 1,
      Math.max(0, i + (velocity > 0 ? -1 : 1)),
    );
    return DETENTS[j];
  }
  return best;
}

/** the detent nearest `y`, for a sheet caught in flight */
export function nearest(y: number, h: number): Detent {
  let best: Detent = "peek";
  let gap = Number.POSITIVE_INFINITY;
  for (const d of DETENTS) {
    const g = Math.abs(detentY(d, h) - y);
    if (g < gap) {
      gap = g;
      best = d;
    }
  }
  return best;
}

/**
 * Soft resistance, the curve UIScrollView uses, so an end reads as the sheet
 * giving way rather than as a wall.
 */
export function rubberband(over: number, dimension: number, c = 0.55): number {
  return (over * dimension * c) / (dimension + c * over);
}

/**
 * The hand's raw position to where the sheet is drawn: one to one between the
 * full and peek detents, and rubber-banded past either.
 */
export function band(raw: number, h: number): number {
  const top = detentY("full", h);
  const bottom = detentY("peek", h);
  if (raw < top) return top - rubberband(top - raw, h);
  if (raw > bottom) return bottom + rubberband(raw - bottom, h);
  return raw;
}

/** `band` backwards, so a sheet caught past an end does not jump */
export function unbandY(y: number, h: number): number {
  const top = detentY("full", h);
  const bottom = detentY("peek", h);
  if (y < top) return top - unbandBy(top - y, h);
  if (y > bottom) return bottom + unbandBy(y - bottom, h);
  return y;
}

function unbandBy(shown: number, d: number, c = 0.55): number {
  // shown = o d c / (d + c o)  =>  o = shown d / (c (d - shown))
  const s = Math.min(shown, d * 0.99);
  return (s * d) / (c * (d - s));
}

/**
 * One number for how open the sheet is: 0 at the peek, 1 at half, 2 at full,
 * linear between. Everything that answers the sheet reads this, so the map,
 * the inset and the favourites cannot disagree about where it is.
 */
export function level(y: number, h: number): number {
  const peek = detentY("peek", h);
  const half = detentY("half", h);
  const full = detentY("full", h);
  if (y >= half) return Math.max(-0.5, (peek - y) / (peek - half));
  return Math.min(2.5, 1 + (half - y) / (half - full));
}

/** clamp to 0..1 */
export function unit(v: number): number {
  return Math.min(1, Math.max(0, v));
}
