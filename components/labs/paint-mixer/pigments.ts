/*
 * The six pigments, and how paint mixes.
 *
 * Paint mixes by single-constant Kubelka-Munk, the textbook model for opaque
 * paint. Each channel's reflectance R becomes an absorption over scattering
 * ratio, K/S = (1 - R)^2 / 2R. A mixture's K/S is the weighted mean of its
 * pigments', and it goes back to a reflectance through
 * R = 1 + K/S - sqrt((K/S)^2 + 2 K/S). Blue and yellow come out green, where
 * averaging RGB gives grey. The maths runs on linear light.
 *
 * - **A pigment's weight is its amount times its tinting strength.** Blue is
 *   strong and white is weak, so one drop of blue moves a well of white a
 *   long way, as it does on a real palette.
 * - The shader runs the same two formulas per pixel. This file is the CPU
 *   copy, for the fallback and for naming a colour.
 */

export interface Pigment {
  id: string;
  /** the short name on its dab */
  name: string;
  /** the name a screen reader hears */
  full: string;
  hex: string;
  strength: number;
}

/**
 * Scoped to this experiment and not tokens: a pigment's colour is the
 * pigment.
 */
export const PIGMENTS: readonly Pigment[] = [
  {
    id: "white",
    name: "white",
    full: "Titanium white",
    hex: "#f5f2ec",
    strength: 0.7,
  },
  {
    id: "yellow",
    name: "yellow",
    full: "Cadmium yellow",
    hex: "#f2c12e",
    strength: 1,
  },
  {
    id: "red",
    name: "red",
    full: "Pyrrole red",
    hex: "#d4362c",
    strength: 1.2,
  },
  {
    id: "magenta",
    name: "magenta",
    full: "Quinacridone magenta",
    hex: "#b3246e",
    strength: 1.4,
  },
  {
    id: "blue",
    name: "blue",
    full: "Ultramarine blue",
    hex: "#2a5bd7",
    strength: 1.8,
  },
  {
    id: "umber",
    name: "umber",
    full: "Burnt umber",
    hex: "#6b4026",
    strength: 1,
  },
];

export type Rgb = readonly [number, number, number];

function channel(hex: string, i: number): number {
  return Number.parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
}

function toLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function toSrgb(c: number): number {
  const v = Math.min(1, Math.max(0, c));
  return v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
}

/** reflectance to K/S, with R held off 0 and 1 so neither end is infinite */
function toKs(r: number): number {
  const v = Math.min(0.999, Math.max(0.001, r));
  return (1 - v) ** 2 / (2 * v);
}

/** K/S back to reflectance */
export function fromKs(k: number): number {
  return 1 + k - Math.sqrt(k * k + 2 * k);
}

/** a pigment's K/S per channel, on linear light */
export function ksOf(p: Pigment): Rgb {
  return [0, 1, 2].map((i) =>
    toKs(toLinear(channel(p.hex, i))),
  ) as unknown as Rgb;
}

/**
 * The colour of the whole recipe mixed evenly, as sRGB 0..1, or null for an
 * empty well. `counts` is drops per pigment, in `PIGMENTS` order.
 */
export function mixRecipe(counts: readonly number[]): Rgb | null {
  let w = 0;
  const k = [0, 0, 0];
  PIGMENTS.forEach((p, i) => {
    const amount = (counts[i] ?? 0) * p.strength;
    if (amount <= 0) return;
    const ks = ksOf(p);
    for (let c = 0; c < 3; c++) k[c] += ks[c] * amount;
    w += amount;
  });
  if (w <= 0) return null;
  return k.map((v) => toSrgb(fromKs(v / w))) as unknown as Rgb;
}

export function toHex(rgb: Rgb): string {
  return `#${rgb
    .map((v) =>
      Math.round(Math.min(1, Math.max(0, v)) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/** sRGB 0..1 to OKLCH, with the hue in degrees */
function oklch(rgb: Rgb): [number, number, number] {
  const [r, g, b] = rgb.map(toLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const h = (Math.atan2(B, A) * 180) / Math.PI;
  return [L, Math.hypot(A, B), h < 0 ? h + 360 : h];
}

/** the upper edge of each hue's band in OKLCH degrees, and its name */
const HUES: readonly [number, string][] = [
  [20, "rose"],
  [42, "red"],
  [70, "orange"],
  [95, "ochre"],
  [112, "yellow"],
  [130, "olive"],
  [165, "green"],
  [190, "teal"],
  [225, "cyan"],
  [265, "blue"],
  [290, "indigo"],
  [318, "violet"],
  [345, "magenta"],
  [360, "rose"],
];

/**
 * A plain name for a colour, from its OKLCH lightness, chroma and hue. Greys
 * and browns are named before hue, since a hue name on a near-grey is a guess.
 */
export function nameOf(rgb: Rgb): string {
  const [L, C, h] = oklch(rgb);
  if (C < 0.03) {
    if (L > 0.92) return "white";
    if (L < 0.28) return "near black";
    const warm = h > 30 && h < 110 && C > 0.012;
    return `${L > 0.7 ? "light " : L < 0.45 ? "dark " : ""}${warm ? "warm grey" : "grey"}`;
  }
  const tone =
    L > 0.86
      ? "pale "
      : L > 0.74
        ? "light "
        : L < 0.36
          ? "dark "
          : L < 0.5
            ? "deep "
            : "";
  if (h > 30 && h < 95 && L < 0.58 && C < 0.14) {
    return `${L < 0.36 ? "dark " : ""}brown`;
  }
  const hue = HUES.find(([edge]) => h < edge)?.[1] ?? "rose";
  return `${tone}${hue}`;
}
