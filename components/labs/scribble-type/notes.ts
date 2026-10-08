import type { Shape } from "./doodle";

/*
 * What gets written and what gets marked. Pure data, so the component holds no
 * copy and no colours of its own.
 */

/**
 * Four inks, scoped to this experiment and not tokens: a pen mark is a colour on
 * paper, and the colour is what separates the annotation from the writing. The
 * three pens clear 3:1 on white as a graphic should. The marker sits behind the
 * text, so it is light and the text on it is `text-primary` at 13:1.
 */
export const INK = {
  red: "#d93d2b",
  blue: "#2c5bd4",
  green: "#23864a",
  marker: "#fbe17a",
} as const;

export type Ink = keyof typeof INK;

export interface Mark {
  shape: Shape;
  ink: Ink;
}

/** a run of text, and the mark the pen makes on it once it is written */
export type Segment = string | { text: string; mark: Mark };

/**
 * Three notes of about the same length, so the page holds one height whichever
 * is on it. A segment string carries its own spaces.
 */
export const NOTES: readonly (readonly Segment[])[] = [
  [
    "Ship the ",
    { text: "small thing", mark: { shape: "circle", ink: "red" } },
    " first. Then make it feel ",
    { text: "inevitable", mark: { shape: "underline", ink: "blue" } },
    ", one ",
    { text: "detail at a time", mark: { shape: "highlight", ink: "marker" } },
    ".",
  ],
  [
    "Good motion is ",
    { text: "all", mark: { shape: "strike", ink: "red" } },
    " mostly ",
    { text: "timing", mark: { shape: "circle", ink: "red" } },
    ". The rest is knowing ",
    { text: "when to stop", mark: { shape: "double", ink: "blue" } },
    ".",
  ],
  [
    { text: "Write it down", mark: { shape: "zigzag", ink: "green" } },
    ", cross the ",
    { text: "clever bits", mark: { shape: "strike", ink: "red" } },
    " out, and circle ",
    { text: "the part", mark: { shape: "circle", ink: "blue" } },
    " that ",
    { text: "still matters", mark: { shape: "highlight", ink: "marker" } },
    ".",
  ],
];

/** a note as plain text, for the screen reader copy */
export function plain(note: readonly Segment[]): string {
  return note.map((s) => (typeof s === "string" ? s : s.text)).join("");
}
