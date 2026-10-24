/**
 * The zipper pouch's geometry, pure and DOM-free, in the units of a 400 by 250
 * viewBox.
 *
 * The whole state is one number, `s`, where the slider sits on the track. Both
 * ends of the track are sewn, so the opening is the stretch between the left
 * end and the slider: closed at the sewn end, closed at the slider's throat,
 * and widest between them. Every tooth, both tapes, the hole and how far each
 * item can rise are read off that one number.
 */

export const VB_W = 400;
export const VB_H = 250;

/** the pouch's front panel */
export const POUCH = { x: 52, y: 54, w: 296, h: 142, r: 26 } as const;

/** the zipper's centre line and the sewn ends of the track */
export const CY = 108;
export const X0 = 72;
export const X1 = 328;
export const TRACK = X1 - X0;

/** the widest the opening gets, and how fast it grows with the run behind the slider */
const GAP_MAX = 58;
const GAP_RATE = 0.42;

/** the bottom lip carries the contents' weight, so it sags more than the top lifts */
const TOP_SHARE = 0.4;
const BOTTOM_SHARE = 0.6;

/** the tooth pitch, and how many teeth each tape carries */
export const PITCH = 5.2;
export const TEETH = Math.floor(TRACK / PITCH);

/** a tape's width, and where it runs past the track into the seam */
export const TAPE = 8;
export const TAPE_RUN = 12;

/** how wide the opening is at `x` with the slider at `s`, 0 where it is shut */
export function gapAt(x: number, s: number): number {
  const run = s - X0;
  if (run <= 0 || x <= X0 || x >= s) return 0;
  const u = (x - X0) / run;
  return Math.min(GAP_MAX, run * GAP_RATE) * Math.sin(Math.PI * u) ** 0.8;
}

/** the top lip's lift and the bottom lip's sag at `x` */
export function lift(x: number, s: number): number {
  return gapAt(x, s) * TOP_SHARE;
}
export function sag(x: number, s: number): number {
  return gapAt(x, s) * BOTTOM_SHARE;
}

/** a tooth's centre and its turn in degrees, which follows its tape's slope */
export function tooth(
  side: 1 | -1,
  i: number,
  s: number,
): { x: number; y: number; a: number } {
  // the two rows sit half a pitch apart, so they mesh where the zipper is shut
  const x = X0 + (i + (side < 0 ? 0.25 : 0.75)) * PITCH;
  const off = side < 0 ? -lift(x, s) : sag(x, s);
  const ahead = side < 0 ? -lift(x + 1, s) : sag(x + 1, s);
  const a = (Math.atan(ahead - off) * 180) / Math.PI;
  return { x, y: CY + side * 0.6 + off, a };
}

/** the points a lip's line is drawn through, every few units along the tape */
function samples(): number[] {
  const xs: number[] = [];
  for (let x = X0 - TAPE_RUN; x <= X1 + TAPE_RUN; x += 4) xs.push(x);
  xs.push(X1 + TAPE_RUN);
  return xs;
}
const XS = samples();

const f = (n: number) => n.toFixed(2);

/**
 * A tape as a filled band: its inner edge, where the teeth are, follows the
 * lip, and its outer edge follows it at a tape's width.
 */
export function tapePath(side: 1 | -1, s: number): string {
  const edge = (x: number) =>
    side < 0 ? CY - 2.6 - lift(x, s) : CY + 2.6 + sag(x, s);
  const inner = XS.map((x) => `${f(x)} ${f(edge(x))}`);
  const outer = XS.map((x) => `${f(x)} ${f(edge(x) + side * TAPE)}`).reverse();
  return `M ${inner.join(" L ")} L ${outer.join(" L ")} Z`;
}

/** the stitch line along a tape, a little in from its outer edge */
export function stitchPath(side: 1 | -1, s: number): string {
  const y = (x: number) =>
    side < 0
      ? CY - 2.6 - lift(x, s) - TAPE + 2
      : CY + 2.6 + sag(x, s) + TAPE - 2;
  return `M ${XS.map((x) => `${f(x)} ${f(y(x))}`).join(" L ")}`;
}

/** the hole the opening shows the lining through, empty while it is shut */
export function holePath(s: number): string {
  if (s - X0 < 1) return "";
  const xs: number[] = [];
  for (let x = X0; x < s; x += 3) xs.push(x);
  xs.push(s);
  const top = xs.map((x) => `${f(x)} ${f(CY - lift(x, s))}`);
  const bottom = xs.map((x) => `${f(x)} ${f(CY + sag(x, s))}`).reverse();
  return `M ${top.join(" L ")} L ${bottom.join(" L ")} Z`;
}

/**
 * What the items may show through: everything above the bottom lip. Below it
 * an item is behind the pouch's front, and above it an item that has risen
 * comes out over the fabric toward the reader.
 */
export function clipPath(s: number): string {
  const line = XS.map((x) => `${f(x)} ${f(CY + 2 + sag(x, s))}`);
  return `M 0 0 L 0 ${f(CY + 2)} L ${line.join(" L ")} L ${VB_W} ${f(CY + 2)} L ${VB_W} 0 Z`;
}

/** the narrowest the opening is across a span, which is how far an item there can rise */
export function narrowest(a: number, b: number, s: number): number {
  let least = Number.POSITIVE_INFINITY;
  for (let x = a; x <= b; x += 4) least = Math.min(least, gapAt(x, s));
  return Math.min(least, gapAt(b, s));
}

/** how many teeth sit behind the slider, which is what a click is heard for */
export function toothOf(s: number): number {
  return Math.floor((s - X0) / PITCH);
}

/** how open the zipper is, from 0 to 1 */
export function openness(s: number): number {
  return (s - X0) / TRACK;
}
