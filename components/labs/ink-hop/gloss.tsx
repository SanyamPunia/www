import { useId } from "react";

/*
 * A glossy fill for one shape in the 24 grid: a top-to-bottom gradient from
 * `light` to `deep`, carried into the edge by the stroke, and a soft highlight
 * on the upper left, clipped to the shape. The flying shape in `index.tsx`
 * draws the same three layers with refs, so a landing swaps like for like.
 */

/** the highlight's place and size, upper left where a light above would sit */
export const SHINE = { cx: 9, cy: 7.5, rx: 7, ry: 4.5 } as const;

export function shadow(deep: string): string {
  return `drop-shadow(0 1.5px 2px color-mix(in oklch, ${deep} 40%, transparent))`;
}

export function Gloss({
  d,
  light,
  deep,
}: {
  d: string;
  light: string;
  deep: string;
}) {
  const id = useId();
  return (
    <>
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={light} />
          <stop offset="1" stopColor={deep} />
        </linearGradient>
        <radialGradient id={`${id}-s`}>
          <stop offset="0" stopColor="#fff" stopOpacity="0.7" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${id}-c`}>
          <path d={d} />
        </clipPath>
      </defs>
      <path
        d={d}
        fill={`url(#${id}-g)`}
        stroke={`url(#${id}-g)`}
        strokeWidth={2}
      />
      <g clipPath={`url(#${id}-c)`}>
        <ellipse {...SHINE} fill={`url(#${id}-s)`} stroke="none" />
      </g>
    </>
  );
}
