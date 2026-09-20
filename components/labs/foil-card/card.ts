/*
 * The card: what is printed on it, where its mass is, and how far a pointer
 * tips it.
 *
 * Every length here is a fraction of the card's own width, and the component
 * spends them as `cqw`, so one set of numbers lays the card out and weighs it.
 * `document-pocket` makes the same split with `poses.ts`.
 */

/** The card's proportions, width over height. A credit card is 1.586. */
export const ASPECT = 1.75;

/** The margin everything printed on the card sits inside. */
export const PAD = 0.058;

/** The portrait's diameter. */
export const PHOTO = 0.145;

/**
 * The corner, and it is off the radius scale on purpose. `rounded-lg` is
 * 6.4px, which is the site's own card radius and what the frame around this
 * demo uses, and on a drawn object 420px wide it reads as a square with the
 * corners taken off. That is the standing `folder-stack` and `document-pocket`
 * give their own pixel geometry.
 */
export const RADIUS = 0.029;

/** The two lines at the top, and the two quiet ones at the foot. */
export const LEAD = 0.052;
export const META = 0.032;

/**
 * The card's width, spent as a custom property the card's own parts read.
 *
 * Not `cqw` on the card, and this is the trap `document-pocket` documents at
 * length: an element is a query container for its descendants and never for
 * itself, so the card's own radius written in `cqw` would resolve against the
 * stage and come out a third too large. A custom property has no such rule, so
 * `--card` is declared on the box that is the card's size and everything,
 * including that box, reads it.
 *
 * The cap is what the share already comes to at the lab column's width, so it
 * binds on every wider stage and the share only ever decides a narrow one. A
 * phone has no width to spare and spends more of it, which is the trade
 * `pixel-reveal` documents for its own board.
 */
export const WIDTH = "min(84cqw, 26.25rem)";

/**
 * A length as CSS, as a share of the card with a floor under it.
 *
 * The card scales with the stage, so a card on a phone is a miniature of the
 * same drawing, and at some width that stops being true: `META` is 13.4px on a
 * lab column and 8.2px at 320. Every size carries a px floor for that reason,
 * the call `tide-card` documents.
 */
export function span(share: number, floor: number): string {
  return `max(${floor}px, calc(var(--card) * ${share.toFixed(4)}))`;
}

/**
 * How much of its own box a thing actually inks.
 *
 * A disc fills a shade under four fifths of the square it is measured in, so a
 * portrait is that and not 1. A line of type is a line box with glyphs in it,
 * and a lowercase run in Inter covers about a fifth of one. Every text node on
 * the card takes the same figure, so the only thing it decides is how the type
 * weighs against the portrait, which is the one comparison the balance point
 * turns on.
 */
export const COVER = { disc: Math.PI / 4, type: 0.22 } as const;

export interface Lump {
  /** the box, as fractions of the card on each axis, y down from its top */
  x: number;
  y: number;
  w: number;
  h: number;
  ink: number;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * Where the card balances: the ink-weighted centroid of everything printed on
 * it.
 *
 * This is why the card does not tip evenly. The portrait is the only solid
 * block of ink on the thing, so the card is heavier at that corner, and a
 * finger on the empty end of it has a far longer lever than a finger on the
 * portrait. It is measured off the rendered card rather than declared, so
 * moving a line moves the balance with it.
 *
 * An empty card has no ink to weigh, and its centre is its middle.
 */
export function centreOfMass(lumps: readonly Lump[]): Point {
  let mass = 0;
  let mx = 0;
  let my = 0;

  for (const lump of lumps) {
    const m = lump.w * lump.h * lump.ink;
    mass += m;
    mx += m * (lump.x + lump.w / 2);
    my += m * (lump.y + lump.h / 2);
  }

  return mass > 0 ? { x: mx / mass, y: my / mass } : { x: 0.5, y: 0.5 };
}

/** The most a pointer at the far end of the card tips it, in degrees. */
export const TILT = 9;

/** What a press adds to that, in degrees. */
export const PRESS = 5.5;

/** The light's height over the card, as a share of its width. */
export const LIGHT_H = 0.22;

/**
 * The tilt a pointer asks for, as a share of the maximum on each axis.
 *
 * It is a torque: the lever is how far the pointer is from the balance point,
 * and the card turns about that point rather than about its middle. Each axis
 * is divided by the longest lever there is on it, so the far end of the card
 * reaches the full tilt and the near end reaches whatever share of it its own
 * lever is worth. With the balance point at 0.62 across, a finger on the left
 * edge tips the card two thirds again as far as one on the right.
 *
 * `stamp-collection` measured the signs: positive `rotateY` takes the right
 * edge away from the eye and positive `rotateX` brings the bottom toward it.
 * The hovered side goes away, so x keeps its sign and y flips.
 */
export function tiltAt(px: number, py: number, com: Point): Point {
  const ax = Math.max(com.x, 1 - com.x);
  const ay = Math.max(com.y, 1 - com.y);

  return { x: (px - com.x) / ax, y: -(py - com.y) / ay };
}
