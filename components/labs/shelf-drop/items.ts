/**
 * What is standing on the ledge.
 *
 * Six prints built from the same two rectangles, so the picture is the only
 * thing telling one from another. That is the same claim `stamp-collection`
 * makes and the narrower half of it: a photograph is the colour it was taken
 * in, so the hues here are the subject rather than a tint applied to one.
 * Nothing else on the site may reach for them.
 *
 * Each picture is a sky over a ground with a light in it, which is enough to
 * read as a landscape at 72px and cheap enough to cost no request. The heights
 * differ because a row of identical rectangles reads as a chart rather than as
 * things somebody put on a shelf.
 */
export type Print = {
  id: string;
  title: string;
  /** the card's size in stage pixels */
  width: number;
  height: number;
  /** how far it leans at rest, in degrees */
  lean: number;
  /** the picture: a sky, a ground, and where the light in it sits */
  sky: string;
  ground: string;
  light: string;
  lightAt: string;
};

export const PRINTS: Print[] = [
  {
    id: "dune",
    title: "Dune",
    width: 72,
    height: 96,
    lean: 0,
    sky: "#f3c98b",
    ground: "#b4703f",
    light: "#fff2d8",
    lightAt: "68% 34%",
  },
  {
    id: "harbour",
    title: "Harbour",
    width: 66,
    height: 88,
    lean: -1.5,
    sky: "#9fc4d8",
    ground: "#2f4a5c",
    light: "#eef6fa",
    lightAt: "30% 30%",
  },
  {
    id: "pine",
    title: "Pine",
    width: 74,
    height: 102,
    lean: 0,
    sky: "#cfd9c4",
    ground: "#3b4b36",
    light: "#f4f7ee",
    lightAt: "52% 26%",
  },
  {
    id: "kiln",
    title: "Kiln",
    width: 64,
    height: 86,
    lean: 1,
    sky: "#e8b6a4",
    ground: "#7d3b34",
    light: "#fde9df",
    lightAt: "40% 38%",
  },
  {
    id: "slate",
    title: "Slate",
    width: 70,
    height: 94,
    lean: 0,
    sky: "#c6c6cc",
    ground: "#43434c",
    light: "#f0f0f4",
    lightAt: "64% 28%",
  },
  {
    id: "meadow",
    title: "Meadow",
    width: 68,
    height: 90,
    lean: -1,
    sky: "#dbe3ac",
    ground: "#6c7a38",
    light: "#f7fae6",
    lightAt: "36% 32%",
  },
];

/** the gap between prints, and the row's width, which the stage is fitted to */
export const GAP = 18;
export const ROW_WIDTH =
  PRINTS.reduce((total, print) => total + print.width, 0) +
  GAP * (PRINTS.length - 1);

/** each print's left edge, walked across the row once rather than per render */
export const LEFT: number[] = PRINTS.reduce<number[]>(
  (positions, print, index) => {
    const previous =
      index === 0 ? 0 : positions[index - 1] + PRINTS[index - 1].width + GAP;
    positions.push(previous);
    return positions;
  },
  [],
);
