/*
 * The geometry of the blind, in `cqw` of the stage, pure and DOM-free.
 *
 * The stage is its own `@container` and sits at 8:5, so it is 62.5cqw tall and
 * every length here is a share of its width. Nothing is measured in JS except
 * the stage's own width at the start of a pull, which converts a hand's pixels
 * into tilt.
 */

/** the stage's height in cqw, which is the 8:5 aspect read backwards */
export const STAGE_H = 62.5;

/** the head rail the slats hang from, and the cords come out of */
export const RAIL_H = 3;

/**
 * Pivot to pivot. A slat is taller than its pitch, so a shut blind overlaps
 * itself and shows no light at all. The gap only opens once `cos(angle)` falls
 * under `PITCH / SLAT_H`, which at 1.12 is 27 degrees, and that dead band at the
 * start of a pull is what a real blind does too.
 */
export const PITCH = 3.8;
export const SLAT_H = PITCH * 1.12;

/**
 * The most a slat turns. Not 90, since a slat seen exactly edge on paints
 * nothing, and a blind that disappears when it opens is not a blind. At 80 each
 * slat still shows a sixth of its face as a thin band.
 */
export const MAX_ANGLE = 80;

/** enough slats to run past the foot of the stage, which clips the last one */
export const COUNT = Math.ceil((STAGE_H - RAIL_H) / PITCH) + 1;

/** where each slat turns, which is the middle of its own pitch */
export function pivot(i: number): number {
  return RAIL_H + (i + 0.5) * PITCH;
}

/**
 * How far off true each slat sits, from -1 to 1.
 *
 * A ladder string has slack, so no two slats on a real blind hold quite the
 * same angle. The error is scaled by `t * (1 - t)` where it is used, so it is
 * nothing at either end: a shut blind lies flat against itself and an open one
 * is pulled level by the tape. An integer hash rather than `Math.sin(x) *
 * 43758`, which `stem-picker` measured degenerating on small integers.
 */
export function slack(i: number): number {
  let h = (i + 1) * 0x9e3779b1;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h ^= h >>> 13;
  return ((h >>> 0) / 0xffffffff) * 2 - 1;
}

/** degrees of error at the middle of the travel, where the slack is widest */
export const SLACK = 2.4;

/** a slat's angle for a given tilt, error included */
export function angle(i: number, t: number): number {
  return -(t * MAX_ANGLE + slack(i) * 4 * t * (1 - t) * SLACK);
}

/** the two ladder tapes, as a share of the width */
export const LADDERS = [15, 79] as const;

/**
 * The two tilt cords. `open` is the left one and pulling it opens the slats,
 * `shut` is beside it and pulling it closes them. They are one loop over a
 * pulley in the rail, so a pull on one lifts the other by the same length.
 */
export const CORDS = { open: 88.2, shut: 91 } as const;
export type Cord = keyof typeof CORDS;

/** how long a cord hangs at half tilt, and how far one pull takes it */
export const CORD_BASE = 27;
export const TRAVEL = 12;

/** the tassel on the end of each cord */
export const ACORN_W = 1.3;
export const ACORN_H = 3.8;

/**
 * How long each cord hangs, from the rail's foot to the top of its acorn.
 *
 * At a tilt of 0 the open cord is short and the shut one long, which is what
 * says which one to pull: the one hanging low has already been pulled.
 */
export function cordLength(cord: Cord, t: number): number {
  const d = (t - 0.5) * TRAVEL;
  return CORD_BASE + (cord === "open" ? d : -d);
}

/** a length on the stage, written once so every call site agrees on the unit */
export function cq(value: number): string {
  return `${value}cqw`;
}
