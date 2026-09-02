import type { ReactNode } from "react";

/*
 * The five stickers: what each one is cut to, what is printed on it, what
 * colour it is and where it lies at rest.
 *
 * Every silhouette is drawn in the 100 unit box `peel.ts` declares, centred on
 * the origin, so one path serves the die cut, the hit region, the backing and
 * the mark left on the board.
 */

/**
 * A sticker's colours.
 *
 * Six shapes built from the same few parts need colour to tell them apart, so
 * it carries meaning here rather than decorating, which is the exception
 * `stamp-collection`, `folder-stack` and three others already take. The values
 * live beside the drawings, they are not tokens, and nothing else on the site
 * may reach for them.
 */
interface Ink {
  /** the vinyl */
  face: string;
  /** the lit end of the gloss, which is the same hue raised */
  glow: string;
  /** the cut edge, and the one line of a sticker that touches the board */
  edge: string;
  /** whatever is printed on the face */
  mark: string;
}

export interface StickerDef {
  id: string;
  label: string;
  /** the die cut, in the 100 unit box */
  cut: string;
  ink: Ink;
  art: ReactNode;
  /** where it lies at rest, as a share of the stage */
  at: { x: number; y: number };
  /** how wide it is, as a share of the stage's height */
  size: number;
  angle: number;
}

/**
 * The backing, and it is one material for all five.
 *
 * A sticker's back is the same thing whatever is printed on the front, and
 * making it the same for every one of them is what lets a flap read as the back
 * of a sticker rather than as another face. It is warm rather than white
 * because white is the one colour that cannot work: the flap spends half its
 * time overhanging onto the board, and the darkest fill token is
 * `stroke-strong` at 86% lightness, so a paper-white flap there is the fog
 * `document-pocket` and `book-opening` each had to design their way out of.
 * This sits at 1.31:1 on the `fill` board, inside the 1.20 to 1.62 band
 * `folder-stack`'s papers hold, and like those it carries a full hairline, so
 * the drawing separates it and the tone does not have to.
 */
export const LINER = "#ddd7c9";
export const LINER_EDGE = "#c0b69f";

/**
 * How much of the die cut the white border takes.
 *
 * The face is the same path scaled about the origin rather than a second path
 * inset by hand. That is exact for shapes centred on their own middle, which
 * every one of these is, and it means adding a sticker is one path rather than
 * two that have to agree.
 */
export const FACE_INSET = 0.885;

/** a point at `radius` on the bearing `a`, in the sticker's own units */
function polar(a: number, radius: number): string {
  return `${(Math.cos(a) * radius).toFixed(2)} ${(Math.sin(a) * radius).toFixed(2)}`;
}

/**
 * A die cut with `count` bumps round it, drawn as quadratics.
 *
 * Quadratics rather than arcs because an arc's sweep flag has to be reasoned
 * about and a control point does not: the curve's own middle sits half way to
 * the control from the chord, so a control at `2 (radius + bulge) - chord`
 * puts the crest exactly `bulge` proud of the circle.
 */
function scalloped(count: number, radius: number, bulge: number): string {
  const step = (Math.PI * 2) / count;
  const chord = radius * Math.cos(step / 2);
  const control = 2 * (radius + bulge) - chord;

  let d = `M ${polar(0, radius)}`;
  for (let i = 0; i < count; i++) {
    const a = i * step;
    d += ` Q ${polar(a + step / 2, control)} ${polar(a + step, radius)}`;
  }
  return `${d} Z`;
}

/** an n-pointed star, first point up */
function star(points: number, outer: number, inner: number): string {
  const step = Math.PI / points;
  let d = "";

  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI / 2 + i * step;
    d += `${i === 0 ? "M" : "L"} ${polar(a, i % 2 ? inner : outer)}`;
  }
  return `${d} Z`;
}

const SQUIRCLE =
  "M -26 -42 H 26 A 16 16 0 0 1 42 -26 V 26 A 16 16 0 0 1 26 42 H -26 A 16 16 0 0 1 -42 26 V -26 A 16 16 0 0 1 -26 -42 Z";

const DISC = "M 0 -44 A 44 44 0 1 1 0 44 A 44 44 0 1 1 0 -44 Z";

/** pointy top, which is the one a hexagon sticker is cut to */
const HEX = "M 0 -46 L 39.84 -23 L 39.84 23 L 0 46 L -39.84 23 L -39.84 -23 Z";

const BUBBLE =
  "M -34 -37 H 34 A 12 12 0 0 1 46 -25 V 7 A 12 12 0 0 1 34 19 H -6 L -26 38 L -26 19 H -34 A 12 12 0 0 1 -46 7 V -25 A 12 12 0 0 1 -34 -37 Z";

const ROSETTE = scalloped(12, 39, 4);

/**
 * Where the five lie at rest.
 *
 * Placed by hand rather than scattered by a generator. A scatter has to be
 * rejected and re-rolled until nothing overlaps and nothing lines up, which is
 * a designer's eye run in a loop, and the run that survives is then the layout
 * whether it was chosen or not. These are held apart by more than their own
 * widths, none of the angles repeats, and no three of them sit on a line.
 */
export const STICKERS: StickerDef[] = [
  {
    id: "bolt",
    label: "Lightning sticker",
    cut: SQUIRCLE,
    ink: { face: "#f0a91e", glow: "#ffcf63", edge: "#bf7f0d", mark: "#3d2905" },
    at: { x: 0.2, y: 0.3 },
    size: 0.36,
    angle: -13,
    art: (
      <path
        d="M 8 -29 L -17 3 L -1 3 L -9 29 L 18 -4 L 2 -4 Z"
        fill="#3d2905"
      />
    ),
  },
  {
    id: "orbit",
    label: "Orbit sticker",
    cut: DISC,
    ink: { face: "#2f6fe0", glow: "#79a8fb", edge: "#22509f", mark: "#eef4ff" },
    at: { x: 0.66, y: 0.26 },
    size: 0.34,
    angle: -5,
    art: (
      <>
        <ellipse
          rx="30"
          ry="12.5"
          transform="rotate(-26)"
          fill="none"
          stroke="#eef4ff"
          strokeWidth="5.5"
        />
        <circle r="8" fill="#eef4ff" />
        {/* the ring has to pass behind the bead or the two read as an eye. The
            halo is the face's own colour, so what it cuts is a gap rather than
            a second mark */}
        <circle cx="27" cy="-13.2" r="9" fill="#2f6fe0" />
        <circle cx="27" cy="-13.2" r="5.5" fill="#eef4ff" />
      </>
    ),
  },
  {
    id: "chevron",
    label: "Chevron sticker",
    cut: HEX,
    ink: { face: "#7c4ded", glow: "#b18cff", edge: "#5730b3", mark: "#f4efff" },
    at: { x: 0.44, y: 0.62 },
    size: 0.33,
    angle: 8,
    art: (
      <g
        fill="none"
        stroke="#f4efff"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M -19 -3 L 0 -21 L 19 -3" />
        <path d="M -19 17 L 0 -1 L 19 17" />
      </g>
    ),
  },
  {
    id: "reply",
    label: "Speech bubble sticker",
    cut: BUBBLE,
    ink: { face: "#e0492a", glow: "#ff8b6a", edge: "#a8331b", mark: "#fff2ee" },
    at: { x: 0.84, y: 0.63 },
    size: 0.31,
    angle: 15,
    art: (
      <g fill="#fff2ee">
        <circle cx="-15" cy="-9" r="5.5" />
        <circle cx="0" cy="-9" r="5.5" />
        <circle cx="15" cy="-9" r="5.5" />
      </g>
    ),
  },
  {
    id: "bloom",
    label: "Star sticker",
    cut: ROSETTE,
    ink: { face: "#1f8d55", glow: "#5cc78d", edge: "#146540", mark: "#eefff5" },
    at: { x: 0.22, y: 0.76 },
    size: 0.3,
    angle: 6,
    art: <path d={star(8, 25, 10.5)} fill="#eefff5" />,
  },
];
