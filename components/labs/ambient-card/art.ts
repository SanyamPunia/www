/**
 * The four pictures, and how one is drawn at any angle.
 *
 * Each is two colours, one at each end of a straight gradient, and the
 * gradient can be turned. So a picture is data rather than an image: the stage
 * draws it to a canvas at whatever angle a hand has turned it to, and the
 * sampler draws the same thing small and reads it back.
 *
 * The hues are scoped to this experiment. They are the pictures, not tokens.
 */

import { toLab, toRgb } from "./glow";

/** a credit card's 85.6 by 54 mm */
export const ASPECT = 85.6 / 54;

/**
 * Where a picture starts, in CSS gradient degrees, so 0 points up and the
 * angle turns clockwise. 122 is the corner to corner line of this aspect, so
 * one colour sits in the top left and the other in the bottom right.
 */
export const START_ANGLE = 122;

export interface Face {
  slug: string;
  name: string;
  stops: readonly [number, string][];
}

const toHex = ([r, g, b]: [number, number, number]) =>
  `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;

const hex = (value: string) => {
  const n = Number.parseInt(value.slice(1), 16);
  return toLab((n >> 16) & 255, (n >> 8) & 255, n & 255);
};

/**
 * The stops between two colours, taken in a straight line through oklab
 * rather than through sRGB.
 *
 * Canvas and CSS gradients interpolate in sRGB, which dulls the middle of a
 * blend: cobalt to gold went through khaki. Oklab keeps the middle at the
 * lightness and colourfulness of the two ends. Walking round the hue wheel
 * instead kept the middle bright and brought in a third colour, emerald to
 * pink through olive, so the pairs are picked close enough on the wheel that a
 * straight line between them stays colourful. Nine stops are close enough that
 * sRGB's own line between neighbours cannot be seen.
 *
 * The ends sit at 0.15 and 0.85, so each end of the picture holds a patch of
 * flat colour rather than a point on a slope.
 */
function arc(from: string, to: string): [number, string][] {
  const a = hex(from);
  const b = hex(to);
  const STOPS = 9;
  return Array.from({ length: STOPS }, (_, i): [number, string] => {
    const t = i / (STOPS - 1);
    const [r, g, bl] = toRgb([
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
    ]);
    return [0.15 + 0.7 * t, toHex([r, g, bl])];
  });
}

const face = (slug: string, name: string, from: string, to: string): Face => ({
  slug,
  name,
  stops: arc(from, to),
});

/**
 * Eight hues, each used once, in four pairs. Each pair sits 60 to 110 degrees
 * apart on the wheel: far enough that one picture's two shadows never read as
 * one colour, near enough that the blend between them stays clean.
 */
export const FACES: readonly Face[] = [
  face("tide", "Tide", "#3157f5", "#10b981"),
  face("dusk", "Dusk", "#38bdf8", "#7c4dff"),
  face("sunset", "Sunset", "#fbbf24", "#e5264f"),
  face("ember", "Ember", "#ff7a2e", "#d13ee8"),
];

/**
 * A picture part of the way to another, stop by stop in oklab.
 *
 * Fading one canvas drawing over another blends them in sRGB, which took a
 * blue and green picture into an orange and pink one through a muddy mauve.
 * Every picture has the same nine stop positions, so the crossfade is one
 * gradient whose stops each walk a straight line through oklab.
 */
export function blendFaces(from: Face, to: Face, t: number): Face {
  return {
    slug: to.slug,
    name: to.name,
    stops: to.stops.map(([at, color], i) => {
      const a = hex(from.stops[i]?.[1] ?? color);
      const b = hex(color);
      return [
        at,
        toHex(
          toRgb([
            a[0] + (b[0] - a[0]) * t,
            a[1] + (b[1] - a[1]) * t,
            a[2] + (b[2] - a[2]) * t,
          ]),
        ),
      ];
    }),
  };
}

/**
 * Draw a picture into a box at an angle, with CSS's geometry: the gradient
 * line runs through the middle at `deg`, and is exactly long enough that the
 * two corners furthest along it land on its ends.
 */
export function drawFace(
  ctx: CanvasRenderingContext2D,
  f: Face,
  width: number,
  height: number,
  deg: number,
): void {
  const rad = (deg * Math.PI) / 180;
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  const half = (Math.abs(width * dx) + Math.abs(height * dy)) / 2;
  const cx = width / 2;
  const cy = height / 2;
  const grad = ctx.createLinearGradient(
    cx - dx * half,
    cy - dy * half,
    cx + dx * half,
    cy + dy * half,
  );
  for (const [at, color] of f.stops) grad.addColorStop(at, color);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
}

/** the same picture as a CSS background, for its dot */
export function faceCss(f: Face): string {
  return `linear-gradient(${START_ANGLE}deg, ${f.stops
    .map(([at, color]) => `${color} ${at * 100}%`)
    .join(", ")})`;
}
