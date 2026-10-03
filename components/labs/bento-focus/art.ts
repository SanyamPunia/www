/**
 * The five pictures on the grid, written as CSS gradients rather than drawn.
 *
 * Each tile is three layers: a flat ground, a mesh of soft radial blobs that
 * drifts slowly over it, and one motif in a gradient of its own kind, so no
 * two tiles are the same picture in different colours. Concentric rings for
 * the target, a low sun for the jump shot, a conic sheen across the strings,
 * lane bands for the pool and a crosshatch for the wall.
 *
 * Gradients in percentages, not an image, because a tile resizes on every
 * frame of a move: a gradient is repainted at the new size for almost nothing,
 * where an `<img>` holding an SVG is rasterised again. There is nothing in
 * them to distort, so they need no crop.
 *
 * The hues are scoped to this experiment. They are the pictures, not tokens.
 */

export interface Facet {
  id: string;
  /** the tile's label and the focus slot's title, in sentence case */
  title: string;
  /** the line under the title once the tile has the focus slot */
  copy: string;
  /** the flat colour under everything */
  ground: string;
  /** the blobs, on a layer larger than the tile that drifts */
  mesh: string;
  /** the one gradient that says which sport this is */
  motif: string;
  /** one loop of the drift, in seconds, different per tile so none move in step */
  drift: number;
}

const blob = (x: number, y: number, size: number, colour: string) =>
  `radial-gradient(circle at ${x}% ${y}%, ${colour} 0%, transparent ${size}%)`;

export const FACETS: readonly Facet[] = [
  {
    id: "focus",
    title: "Focus",
    copy: "One ring in the middle of the face, and nothing else on the range.",
    ground: "#141d33",
    mesh: [
      blob(50, 48, 18, "#f6c548"),
      blob(50, 48, 34, "#d9493ccc"),
      blob(24, 76, 40, "#2f6fb8aa"),
      blob(78, 22, 36, "#3a2d6b"),
    ].join(","),
    motif:
      "repeating-radial-gradient(circle at 50% 50%, rgba(255,255,255,.09) 0 1px, transparent 1.5px 16px)",
    drift: 17,
  },
  {
    id: "arc",
    title: "Arc",
    copy: "The arc is set at the release. After that the ball only follows it.",
    ground: "#b8462a",
    mesh: [
      blob(76, 18, 46, "#ffb85c"),
      blob(30, 40, 40, "#ee7a3a"),
      blob(16, 92, 46, "#6e2236"),
      blob(88, 86, 36, "#d9573a"),
    ].join(","),
    motif:
      "radial-gradient(circle at 68% 30%, rgba(255,236,190,.95) 0 9%, rgba(255,236,190,0) 22%)",
    drift: 21,
  },
  {
    id: "precision",
    title: "Precision",
    copy: "The sweet spot is a few centimetres across. Find it and the racket goes quiet.",
    ground: "#16583a",
    mesh: [
      blob(62, 34, 30, "#d9f24e"),
      blob(24, 64, 44, "#3fbf86"),
      blob(80, 88, 40, "#0b3424"),
      blob(18, 14, 34, "#2d8a5c"),
    ].join(","),
    motif:
      "conic-gradient(from 180deg at 62% 34%, transparent 0deg, rgba(255,255,255,.14) 50deg, transparent 110deg, transparent 200deg, rgba(255,255,255,.07) 250deg, transparent 310deg)",
    drift: 15,
  },
  {
    id: "lengths",
    title: "Lengths",
    copy: "Fifty lengths before breakfast, every one counted against the clock.",
    ground: "#0c4f84",
    mesh: [
      blob(30, 30, 40, "#3cd2e6"),
      blob(78, 56, 44, "#1b8ad0"),
      blob(50, 96, 40, "#0a3566"),
      blob(88, 12, 30, "#7fe6ff"),
    ].join(","),
    motif:
      "repeating-linear-gradient(180deg, rgba(255,255,255,.09) 0 1.5px, transparent 1.5px 16px)",
    drift: 19,
  },
  {
    id: "grip",
    title: "Grip",
    copy: "Chalk, a hold the width of a fingertip, and a wall that leans out over you.",
    ground: "#7e2a22",
    mesh: [
      blob(32, 30, 40, "#ff7a59"),
      blob(76, 44, 34, "#d4453a"),
      blob(60, 90, 44, "#5d2552"),
      blob(18, 80, 26, "#f6e7dc88"),
    ].join(","),
    motif:
      "repeating-linear-gradient(45deg, rgba(0,0,0,.09) 0 1px, transparent 1px 14px), repeating-linear-gradient(-45deg, rgba(0,0,0,.09) 0 1px, transparent 1px 14px)",
    drift: 23,
  },
];

/**
 * The film grain over every tile, `document-pocket`'s tile. It repeats at a
 * fixed size, so a tile resizing never rasterises it again.
 */
export const GRAIN = `url("data:image/svg+xml,%3Csvg viewBox='0 0 160 160' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E")`;
