/*
 * The fold, and where the stickers start.
 *
 * Pure geometry in the sticker's own units, the same split `document-pocket`
 * makes with `poses.ts` and `event-stacking` with `layout.ts`: nothing here
 * reads the DOM, so the component is left with the gesture and the frame loop
 * and nothing else.
 *
 * A peel is one construction. Reflecting the sticker across a crease square to
 * the peeling edge, half the peel in front of it, carries that edge exactly onto
 * the hand: the paper behind the crease is the same paper, seen from behind,
 * standing in front of the crease. Peel further and the crease sweeps across on
 * its own. Nothing here interpolates a peel or keyframes one.
 */

export interface Vec {
  x: number;
  y: number;
}

/**
 * The sticker's own drawing box: 100 units square, centred on the origin.
 *
 * Centred rather than 0 to 100 because a sticker rotates about its middle, and
 * in a box whose origin is that middle a rotation is a rotation rather than a
 * rotation and a translation.
 */
export const BOX = 100;

/**
 * Where the crease starts, as a distance back from a sticker's middle in its own
 * units.
 *
 * The peel runs from an edge, never from the point that was pressed, and that is
 * the one thing here that is a decision rather than geometry. Anchoring it at
 * the press reads correctly for a corner and is nonsense for the middle, where
 * it folds the sticker in half on the first millimetre and what is left on the
 * board is a sliver. An edge is also what actually gives: a sticker dragged one
 * way lifts from the other.
 *
 * 46 sits a shade outside every silhouette in the set, so a peel of nothing has
 * its crease clear of the paper and nothing folded at all.
 */
const EDGE = 46;

/**
 * How far the pull has to travel before the last of the sticker lets go, in its
 * own units.
 *
 * The crease sits half way along it, so at 62 it has run to 15 units short of
 * the middle and about a third of the sticker is standing up. Letting go before
 * that reads as a sticker that was never stuck, and much past it the peel is
 * across the middle before the drag can start.
 */
export const RELEASE = 62;

/**
 * The most of a sticker that may fold, in its own units.
 *
 * A design cap rather than physics, the same call `document-pocket` makes for
 * its bow. Past about this the crease is beyond the far edge, the sticker is
 * wholly flap, and what is on screen is a rectangle of backing paper with no
 * front on it at all, which reads as broken rather than as fully peeled.
 */
export const MAX_PULL = 100;

/**
 * How much pull has to accumulate before the peeling edge is picked, in the
 * sticker's own units.
 *
 * The edge is the pull's own direction, and at a pixel of drag that direction is
 * whichever way the hand jittered. Waiting for a real movement is what makes it
 * the edge the reader meant.
 */
export const ARM = 5;

/**
 * Below this the crease is a rounding error, so the sticker is drawn flat and
 * the whole flap layer is taken out of the frame.
 */
export const MIN_PEEL = 0.9;

/** the fold, in the sticker's own units */
export interface Fold {
  /** the middle of the crease */
  mid: Vec;
  /** the unit normal, which is the direction the peel advances in */
  n: Vec;
  /** how far the peeling edge has been carried */
  pull: number;
}

/**
 * The fold for a peel of `peel` units along `edge`.
 *
 * Two numbers, and the second is the only one that moves during a gesture. The
 * crease is always square to the edge that is peeling and always sits half the
 * peel in front of it, which is the reflection that carries that edge exactly
 * onto the hand. Advancing it is the whole of the animation, and there is no
 * peel state anywhere else in this experiment.
 */
export function foldAlong(edge: Vec, peel: number): Fold | null {
  if (peel < MIN_PEEL) return null;
  const along = peel / 2 - EDGE;

  return { mid: { x: edge.x * along, y: edge.y * along }, n: edge, pull: peel };
}

/** how far past the crease the half-plane polygon runs, in the sticker's units */
const REACH = 420;

/**
 * The polygon a sticker that is not folded at all is clipped to.
 *
 * The face carries the same clip as the flap, so a sticker lying flat needs one
 * that keeps everything. Leaving the last crease in it instead is a bug with a
 * quiet tell: the flap is hidden, so nothing looks broken, and the face is
 * silently cut along wherever the peel finished for the rest of the session.
 */
export const UNCUT = "-999,-999 999,-999 999,999 -999,999";

/**
 * The half of the world the sticker still lies flat on, as a polygon.
 *
 * One clip serves both layers and that is the whole trick. The front face is
 * clipped to it, so the peeled part stops painting on the board. The flap is
 * clipped to it too, because reflecting the grabbed half across the crease
 * lands it in exactly this half, so clipping the reflected sticker here gives
 * back the reflected image of the peeled part with nothing left over. Two
 * layers, one polygon, and no second clip to keep in step with the first.
 */
export function frontPolygon({ mid, n }: Fold): string {
  const t = { x: -n.y, y: n.x };
  const at = (along: number, out: number) =>
    `${(mid.x + t.x * along + n.x * out).toFixed(2)},${(
      mid.y + t.y * along + n.y * out
    ).toFixed(2)}`;

  return `${at(REACH, 0)} ${at(-REACH, 0)} ${at(-REACH, REACH)} ${at(REACH, REACH)}`;
}

/**
 * The reflection across the crease, as an SVG matrix.
 *
 * `p - 2 (p . n - m . n) n`, written out. SVG takes it column major, so `b` and
 * `c` are the same number here: a reflection is symmetric.
 */
export function creaseMatrix({ mid, n }: Fold): string {
  const offset = 2 * (mid.x * n.x + mid.y * n.y);
  const a = 1 - 2 * n.x * n.x;
  const skew = -2 * n.x * n.y;
  const d = 1 - 2 * n.y * n.y;

  return `matrix(${a.toFixed(5)} ${skew.toFixed(5)} ${skew.toFixed(5)} ${d.toFixed(
    5,
  )} ${(offset * n.x).toFixed(3)} ${(offset * n.y).toFixed(3)})`;
}

/** how far into the flap the crease's light reaches, in the sticker's units */
export const SHEEN = 16;

/**
 * How far the flap's shadow falls past the crease, in the sticker's units.
 *
 * Small, and it took a correction to get here. A lifted sticker already carries
 * a shadow of its own, and the flap is part of that silhouette, so a flap given
 * a full drop shadow as well is shadowed twice and what lands on the face is a
 * dark band rather than a fold. This is a sheet of vinyl a fraction of a
 * millimetre off the paper under it: a tight, faint line of contact, not a
 * cast.
 */
export const CAST = 1.6;

/* ── vectors ───────────────────────────────────────────────────────────────── */

export function add(a: Vec, b: Vec): Vec {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a: Vec, b: Vec): Vec {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function times(v: Vec, by: number): Vec {
  return { x: v.x * by, y: v.y * by };
}

export function dot(a: Vec, b: Vec): number {
  return a.x * b.x + a.y * b.y;
}

/** the direction of a vector, or null when it is too short to have one */
export function unit(v: Vec, floor: number): Vec | null {
  const length = Math.hypot(v.x, v.y);
  if (length < floor) return null;
  return { x: v.x / length, y: v.y / length };
}

export function spin(v: Vec, deg: number): Vec {
  const a = (deg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return { x: v.x * cos - v.y * sin, y: v.x * sin + v.y * cos };
}
