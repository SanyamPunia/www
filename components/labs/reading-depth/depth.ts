/**
 * The depth curve: how a line looks at each point of its trip up the page.
 * Pure and DOM-free.
 *
 * `p` is a line's progress through the page, 0 as its top edge comes in at
 * the foot and 1 as its bottom edge leaves at the head, which is exactly the
 * `cover` range of a CSS view timeline. So one set of stops feeds both
 * deliveries: `keyframes` writes them as CSS for the browsers that run scroll
 * timelines on the compositor, and `sample` interpolates them for the ones that
 * do not. The two cannot drift, since there is only one curve.
 */

export interface Stop {
  p: number;
  opacity: number;
  scale: number;
  /** px */
  blur: number;
  /** px, so a line arriving rises into place and one leaving drifts up */
  y: number;
}

/*
 * A line arrives small, soft and a little low, grows and sharpens into the
 * reading band below the middle, holds there, then shrinks toward its centre,
 * blurs and fades as it rises out at the head. The two ends mirror each other,
 * so text comes up out of the depth and goes back into it rather than being cut
 * off by an edge. The band sits below the middle because that is where a
 * reader's eye rests on a page, not on its centre line.
 */
export const STOPS: readonly Stop[] = [
  { p: 0, opacity: 0.06, scale: 0.94, blur: 6, y: 6 },
  { p: 0.14, opacity: 0.3, scale: 0.962, blur: 2.6, y: 3 },
  { p: 0.3, opacity: 0.7, scale: 0.985, blur: 0.6, y: 0 },
  { p: 0.44, opacity: 1, scale: 1, blur: 0, y: 0 },
  { p: 0.62, opacity: 1, scale: 1, blur: 0, y: 0 },
  { p: 0.78, opacity: 0.7, scale: 0.985, blur: 0.6, y: 0 },
  { p: 0.9, opacity: 0.32, scale: 0.962, blur: 2.6, y: -2 },
  { p: 1, opacity: 0, scale: 0.94, blur: 6, y: -4 },
];

/** the curve for reduced motion: the tone alone, nothing moves or blurs */
export const CALM: readonly Stop[] = STOPS.map((s) => ({
  ...s,
  scale: 1,
  blur: 0,
  y: 0,
}));

function lerp(a: number, b: number, t: number): number {
  return a * (1 - t) + b * t;
}

/** the curve at `p`, interpolated between its stops */
export function sample(stops: readonly Stop[], p: number): Stop {
  const c = Math.min(1, Math.max(0, p));
  for (let i = 1; i < stops.length; i++) {
    const b = stops[i];
    if (c <= b.p) {
      const a = stops[i - 1];
      const t = (c - a.p) / (b.p - a.p || 1);
      return {
        p: c,
        opacity: lerp(a.opacity, b.opacity, t),
        scale: lerp(a.scale, b.scale, t),
        blur: lerp(a.blur, b.blur, t),
        y: lerp(a.y, b.y, t),
      };
    }
  }
  return stops[stops.length - 1];
}

/** a stop as the properties a line is painted with */
export function paint(s: Stop): {
  opacity: string;
  transform: string;
  filter: string;
} {
  return {
    opacity: s.opacity.toFixed(3),
    transform: `translateY(${s.y.toFixed(2)}px) scale(${s.scale.toFixed(4)})`,
    filter: s.blur > 0.05 ? `blur(${s.blur.toFixed(2)}px)` : "none",
  };
}

/** the stops as a CSS `@keyframes` block */
export function keyframes(name: string, stops: readonly Stop[]): string {
  const frames = stops
    .map((s) => {
      const v = paint(s);
      return `${(s.p * 100).toFixed(1)}%{opacity:${v.opacity};transform:${v.transform};filter:${v.filter}}`;
    })
    .join("");
  return `@keyframes ${name}{${frames}}`;
}
