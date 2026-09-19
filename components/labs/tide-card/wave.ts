/**
 * The tide drawn: one cycle, its arc-length table, and where now sits on it.
 *
 * Pure and DOM-free, the split `document-pocket` makes with `poses.ts`. The
 * card asks for a point in the cycle and gets back a place on the drawing, so
 * nothing here measures a node and nothing here renders.
 *
 * **The curve is `heightAt` and not a shape that looks like it.** `yAt` maps
 * the same metres the readout prints onto the box below, so the marker sits on
 * the curve because both are the same function rather than because two drawings
 * were made to agree.
 */
import { heightAt, TIDE } from "./tide";

/**
 * The drawing's own box. One user unit is one unit of this viewBox, and the SVG
 * scales uniformly, so the curve is the same shape at any width.
 *
 * Exactly one cycle is drawn, low water to low water with high in the middle,
 * and that is what lets the marker wrap without a seam: the curve at the right
 * edge is the curve at the left edge, so a tide running off the end of the
 * chart comes back on at the start of the next cycle and the drawing does not
 * move. A window of any other width would need the chart to scroll.
 */
export const WAVE = { w: 260, h: 56 } as const;

/** the curve's own band, and the line the water stands on */
const TOP = 4;
const BOTTOM = 44;
export const FLOOR = 51;

const X0 = 3;
const X1 = 257;

export function xAt(phase: number): number {
  const p = phase < 0 ? 0 : phase > 1 ? 1 : phase;
  return X0 + (X1 - X0) * p;
}

export function yAt(phase: number): number {
  const share = (heightAt(phase) - TIDE.low) / (TIDE.high - TIDE.low);
  return BOTTOM - (BOTTOM - TOP) * share;
}

/**
 * The cycle as a polyline.
 *
 * A cosine has no exact Bézier, so it is sampled rather than approximated, and
 * sampling is also what makes the arc-length table below exact: the browser
 * measures the same segments this sums, so the two cannot differ by more than
 * the float arithmetic. 120 segments over 254 units puts a joint every 2.1
 * units, which at the width this paints is under three pixels and has no
 * visible corner in it.
 */
const SAMPLES = 120;

const POINTS: { x: number; y: number }[] = [];
for (let i = 0; i <= SAMPLES; i++) {
  const p = i / SAMPLES;
  POINTS.push({ x: xAt(p), y: yAt(p) });
}

export const WAVE_D = POINTS.map(
  (p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`,
).join(" ");

/** the same curve closed down to the floor, which is the water under it */
export const AREA_D = `${WAVE_D} L ${X1} ${FLOOR} L ${X0} ${FLOOR} Z`;

const LENGTH: number[] = [0];
for (let i = 1; i <= SAMPLES; i++) {
  const a = POINTS[i - 1];
  const b = POINTS[i];
  LENGTH.push(LENGTH[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
}
const TOTAL = LENGTH[SAMPLES];

/**
 * The share of the curve's *length* that is behind a point in the cycle.
 *
 * Not the share of its width, which is what a first build reaches for and what
 * is wrong: the trail is offset with `pathLength="1"`, which is length, and a
 * curve climbing a third of its box covers more length per unit of width where
 * it is steep. On this curve the two differ by up to 4.6% around the middle of
 * the rise, which is 13 units, so a marker placed by width would sit visibly
 * off the end of its own trail exactly where the tide is moving fastest.
 */
export function drawnAt(phase: number): number {
  const p = phase < 0 ? 0 : phase > 1 ? 1 : phase;
  const exact = p * SAMPLES;
  const i = Math.min(SAMPLES - 1, Math.floor(exact));
  const within = exact - i;
  return (LENGTH[i] + (LENGTH[i + 1] - LENGTH[i]) * within) / TOTAL;
}

/**
 * The marker's transform, and how far it is standing above the floor.
 *
 * Two numbers rather than one, because the drop line under the dot is what
 * explains the water's hard right edge: a filled area cut off at a vertical
 * with nothing on it reads as a wall, and the same vertical with a marker
 * sitting on top of it reads as now. Both are written straight to their nodes,
 * so nothing renders while the tide runs.
 */
export function markerAt(phase: number): string {
  return `translate(${xAt(phase).toFixed(2)} ${yAt(phase).toFixed(2)})`;
}

export function dropAt(phase: number): number {
  return FLOOR - yAt(phase);
}
