/**
 * The five pictures on the grid, written as CSS gradients rather than drawn.
 *
 * Each picture is four layers: a flat ground, a mesh of soft radial blobs that
 * drifts slowly over it, one motif in a gradient of its own kind, and a detail.
 * Concentric rings for the target, a low sun for the jump shot, a conic sheen
 * across the strings, lane bands for the pool and a crosshatch for the wall.
 *
 * Every picture is laid out at the focus slot's size whatever size its tile
 * is, and a tile is a window onto it, so a tile that grows shows more of its
 * picture rather than the same picture bigger. `focal` is the point the window
 * keeps in the same place relative to the tile, so a small tile always shows
 * the subject. The detail sits where no small tile's window reaches, in the
 * top band or at the far side, so it is what the focus slot shows that the
 * grid does not.
 *
 * Gradients rather than an image, because the window slides on every frame of
 * a move and a gradient on a layer of fixed size is never repainted. Lengths
 * that are not shares of the picture are `cqw`, which resolve against the
 * stage, so a hold or a ball scales with the grid.
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
  /** the blobs, on a layer larger than the picture that drifts */
  mesh: string;
  /** the one gradient that says which sport this is */
  motif: string;
  /** what only the focus slot shows */
  detail: string;
  /** a line drawn through a mask, for a detail that is dashed or clipped */
  trace?: { background: string; mask: string };
  /** the point the window holds still, as shares of the picture */
  focal: { x: number; y: number };
  /** one loop of the drift, in seconds, different per tile so none move in step */
  drift: number;
}

const blob = (x: number, y: number, size: number, colour: string) =>
  `radial-gradient(circle at ${x}% ${y}%, ${colour} 0%, transparent ${size}%)`;

/** a round thing of `r` cqw, with a soft shadow under it to the lower right */
const dot = (x: number, y: number, r: number, colour: string) =>
  [
    `radial-gradient(circle ${r}cqw at ${x}% ${y}%, ${colour} 0 82%, transparent 100%)`,
    `radial-gradient(circle ${r * 1.15}cqw at calc(${x}% + ${r * 0.35}cqw) calc(${y}% + ${r * 0.45}cqw), rgba(0,0,0,.28) 0 60%, transparent 100%)`,
  ].join(",");

/** a horizontal hairline at `y`% */
const rule = (y: number, colour: string) =>
  `linear-gradient(180deg, transparent 0 ${y}%, ${colour} ${y}% calc(${y}% + 1px), transparent calc(${y}% + 1px))`;

export const FACETS: readonly Facet[] = [
  {
    id: "focus",
    title: "Focus",
    copy: "One ring in the middle of the face, and nothing else on the range.",
    ground: "#141d33",
    mesh: [
      blob(50, 50, 18, "#f6c548"),
      blob(50, 50, 34, "#d9493ccc"),
      blob(24, 78, 40, "#2f6fb8aa"),
      blob(78, 24, 36, "#3a2d6b"),
    ].join(","),
    motif:
      "repeating-radial-gradient(circle at 50% 50%, rgba(255,255,255,.09) 0 1px, transparent 1.5px 16px)",
    // the edge of the face and the line of the range behind it
    detail: [
      "radial-gradient(circle closest-side at 50% 50%, transparent 0 91%, rgba(255,255,255,.34) 91.5% 93%, transparent 93.5%)",
      rule(11, "rgba(255,255,255,.16)"),
    ].join(","),
    focal: { x: 0.5, y: 0.5 },
    drift: 17,
  },
  {
    id: "arc",
    title: "Arc",
    copy: "The arc is set at the release. After that the ball only follows it.",
    ground: "#b8462a",
    mesh: [
      blob(76, 34, 46, "#ffb85c"),
      blob(30, 54, 40, "#ee7a3a"),
      blob(16, 96, 46, "#6e2236"),
      blob(88, 92, 36, "#d9573a"),
    ].join(","),
    motif:
      "radial-gradient(circle at 66% 46%, rgba(255,236,190,.95) 0 9%, rgba(255,236,190,0) 22%)",
    // the flight over the top of the frame, the ball at the top of it and
    // the rim it drops into
    detail: [
      dot(42, 4, 1.5, "#f08a3c"),
      "radial-gradient(ellipse 3.4cqw 1cqw at 72% 19.5%, transparent 0 55%, rgba(255,240,214,.85) 62% 84%, transparent 92%)",
    ].join(","),
    trace: {
      background:
        "radial-gradient(ellipse 30% 15% at 42% 19%, transparent 0 96.5%, rgba(255,240,214,.7) 97% 99.5%, transparent 100%)",
      // dashes, and only the half above the release line
      mask: "repeating-conic-gradient(from 0deg at 42% 19%, #000 0 2.6deg, transparent 2.6deg 5.4deg), linear-gradient(180deg, #000 0 19%, transparent 19%)",
    },
    focal: { x: 0.66, y: 0.5 },
    drift: 21,
  },
  {
    id: "precision",
    title: "Precision",
    copy: "The sweet spot is a few centimetres across. Find it and the racket goes quiet.",
    ground: "#16583a",
    mesh: [
      blob(62, 48, 30, "#d9f24e"),
      blob(24, 72, 44, "#3fbf86"),
      blob(80, 94, 40, "#0b3424"),
      blob(18, 24, 34, "#2d8a5c"),
    ].join(","),
    motif:
      "conic-gradient(from 180deg at 62% 48%, transparent 0deg, rgba(255,255,255,.14) 50deg, transparent 110deg, transparent 200deg, rgba(255,255,255,.07) 250deg, transparent 310deg)",
    // the baseline and a ball coming over it
    detail: [
      dot(22, 15, 1.5, "#e4f75a"),
      rule(9, "rgba(255,255,255,.42)"),
      "linear-gradient(90deg, transparent 0 calc(50% - .5px), rgba(255,255,255,.3) calc(50% - .5px) calc(50% + .5px), transparent calc(50% + .5px)) 0 0 / 100% 9% no-repeat",
    ].join(","),
    focal: { x: 0.6, y: 0.5 },
    drift: 15,
  },
  {
    id: "lengths",
    title: "Lengths",
    copy: "Fifty lengths before breakfast, every one counted against the clock.",
    ground: "#0c4f84",
    mesh: [
      blob(30, 44, 40, "#3cd2e6"),
      blob(78, 62, 44, "#1b8ad0"),
      blob(50, 98, 40, "#0a3566"),
      blob(88, 20, 30, "#7fe6ff"),
    ].join(","),
    motif:
      "repeating-linear-gradient(180deg, rgba(255,255,255,.09) 0 1.5px, transparent 1.5px 16px)",
    // the wall at the end of the lanes, its touchpad and the T on the floor
    detail: [
      "linear-gradient(90deg, transparent 0 89%, rgba(255,255,255,.5) 89% calc(89% + 1.5px), rgba(255,255,255,.1) calc(89% + 1.5px) 100%)",
      "linear-gradient(rgba(4,28,64,.5), rgba(4,28,64,.5)) 84% 50% / 9% 4px no-repeat",
      "linear-gradient(rgba(4,28,64,.5), rgba(4,28,64,.5)) 86.5% 50% / 4px 18% no-repeat",
    ].join(","),
    focal: { x: 0.35, y: 0.5 },
    drift: 19,
  },
  {
    id: "grip",
    title: "Grip",
    copy: "Chalk, a hold the width of a fingertip, and a wall that leans out over you.",
    ground: "#7e2a22",
    mesh: [
      blob(32, 46, 40, "#ff7a59"),
      blob(76, 54, 34, "#d4453a"),
      blob(60, 96, 44, "#5d2552"),
      blob(18, 88, 26, "#f6e7dc88"),
    ].join(","),
    motif:
      "repeating-linear-gradient(45deg, rgba(0,0,0,.09) 0 1px, transparent 1px 14px), repeating-linear-gradient(-45deg, rgba(0,0,0,.09) 0 1px, transparent 1px 14px)",
    // the holds above the line a small tile can see, the route the hand takes
    detail: [
      dot(18, 18, 1.3, "#f6e7dc"),
      dot(38, 8, 1, "#f2c14e"),
      dot(56, 20, 1.4, "#f6e7dc"),
      dot(74, 10, 0.9, "#5ad1c4"),
      dot(90, 24, 1.2, "#f6e7dc"),
      dot(6, 6, 1, "#f2c14e"),
    ].join(","),
    focal: { x: 0.35, y: 0.5 },
    drift: 23,
  },
];

/**
 * The film grain over every tile, `document-pocket`'s tile. It repeats at a
 * fixed size, so a tile resizing never rasterises it again.
 */
export const GRAIN = `url("data:image/svg+xml,%3Csvg viewBox='0 0 160 160' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E")`;
