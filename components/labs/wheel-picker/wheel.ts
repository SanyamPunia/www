/**
 * The wheel picker's numbers, pure and DOM-free.
 *
 * A wheel's whole state is one float, `pos`, in rows: 7.4 is four tenths of
 * the way from the eighth row to the ninth. Everything drawn comes off it. A
 * row's angle on the drum is its distance from `pos` times `STEP`, and the
 * value in the band is `pos` rounded.
 */

/** px between two rows on the flat, and the band's height */
export const ROW = 44;

/** degrees of drum between two rows */
export const STEP = 18;

/**
 * The drum's radius, set so two neighbouring rows meet as chords of the
 * circle: a row is exactly as tall as the arc it takes. Any other radius
 * stacks the rows into each other or opens gaps between them.
 */
export const RADIUS = ROW / (2 * Math.sin((STEP * Math.PI) / 360));

/** rows drawn either side of the band, which is where the drum turns away */
export const REACH = Math.floor(90 / STEP);

/*
 * A release coasts on UIScrollView's own time constant, 0.325s, so a flick
 * travels as far as it does on a phone. The landing is the nearest row to
 * where the coast would stop.
 */
export const TAU = 0.325;

export interface Spec {
  /** how many values the wheel holds */
  count: number;
  /** whether it runs round, the way the hour and minute wheels do */
  loop: boolean;
  /** what a value reads as */
  label: (value: number) => string;
}

/** a value from a position, for a looping wheel or a bounded one */
export function valueAt(spec: Spec, pos: number): number {
  const i = Math.round(pos);
  if (spec.loop) return ((i % spec.count) + spec.count) % spec.count;
  return Math.min(spec.count - 1, Math.max(0, i));
}

/**
 * Where a release lands, and how long its coast takes.
 *
 * The coast is an exponential decay from `pos` to `land`, whose time constant
 * is picked so it leaves at the hand's own speed: the gap over the velocity.
 * So the drag hands its speed to the coast with no seam, and the coast still
 * ends exactly on a row. A placement with no speed settles on a short fixed
 * constant instead.
 */
export function release(
  spec: Spec,
  pos: number,
  velocity: number,
): { land: number; tau: number } {
  let land = Math.round(pos + velocity * TAU);
  if (!spec.loop) land = Math.min(spec.count - 1, Math.max(0, land));
  const gap = land - pos;
  const tau =
    Math.abs(velocity) > 0.5 && Math.sign(gap) === Math.sign(velocity)
      ? Math.min(0.6, Math.max(0.08, gap / velocity))
      : 0.1;
  return { land, tau };
}

/**
 * The UIScrollView rubber band, in rows. Past either end of a bounded wheel the
 * drum follows a fraction of the hand that falls off the further it goes, so
 * the end reads as resistance and not as a wall.
 */
export function rubber(over: number): number {
  const d = 3;
  return (over * d * 0.55) / (d + 0.55 * Math.abs(over));
}

/** the drum's own position for a raw drag position, bounded or not */
export function band(spec: Spec, pos: number): number {
  if (spec.loop) return pos;
  const max = spec.count - 1;
  if (pos < 0) return rubber(pos);
  if (pos > max) return max + rubber(pos - max);
  return pos;
}

/** a row's angle on the drum, in degrees, for its offset from the band */
export function angleOf(offset: number): number {
  return offset * STEP;
}

/**
 * How many rows from the band a point is, for a point `y` px from the drum's
 * middle. It inverts the drum's own projection, so a tap lands on the row
 * drawn under it rather than on a flat grid of rows.
 */
export function rowsAt(y: number): number {
  const s = Math.max(-1, Math.min(1, y / RADIUS));
  return (Math.asin(s) * 180) / Math.PI / STEP;
}
