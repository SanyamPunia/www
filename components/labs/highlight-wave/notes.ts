/*
 * What is on the page and what it can be marked with. Pure data, so the
 * component holds no copy and no colours of its own.
 */

export interface Hue {
  name: string;
  /** the swatch, and the glow a passing wave throws */
  swatch: string;
  /** the text once it is marked, 5.5:1 or better on its own wash */
  ink: string;
  /** the bar behind the text, the swatch at low alpha over the page */
  wash: string;
}

/** `#rrggbb` at an alpha, since a WAAPI keyframe cannot take a `color-mix()` */
export function alpha(hex: string, a: number): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255} / ${a})`;
}

const hue = (name: string, swatch: string, ink: string, wash: number): Hue => ({
  name,
  swatch,
  ink,
  wash: alpha(swatch, wash),
});

/**
 * Eight hues in wheel order, scoped to this experiment and not tokens: the hue
 * is the whole of what a mark says, so it carries meaning rather than
 * decorating. Each wash lands at 1.17 to 1.27:1 on white and each ink clears
 * 5.48:1 on its own wash.
 */
export const HUES: readonly Hue[] = [
  hue("red", "#f2545b", "#a3212a", 0.2),
  hue("orange", "#f7883b", "#97440b", 0.22),
  hue("amber", "#f2c230", "#7d5600", 0.3),
  hue("green", "#3cc370", "#156b37", 0.22),
  hue("cyan", "#22bfd3", "#0a6773", 0.22),
  hue("blue", "#5a72f2", "#2f43b8", 0.2),
  hue("violet", "#a463ee", "#6a2bb0", 0.2),
  hue("pink", "#ef6fb1", "#a0215f", 0.2),
];

export const NOTES = [
  "Feedback from Tuesday's review: the empty state is the first screen most people see, so it deserves more than a grey icon and a shrug.",
  "Thing I keep relearning: nobody reads the settings page. People skim the first line, look at the pictures, and decide in about four seconds.",
  "Note to self: the good idea usually turns up on the walk home. Take the long way and leave the phone in a pocket.",
] as const;

export interface Highlight {
  id: number;
  para: number;
  /** character offsets into the paragraph's string, end exclusive */
  start: number;
  end: number;
  hue: number;
}

const seed = (id: number, para: number, text: string, hue: number) => {
  const start = NOTES[para].indexOf(text);
  return { id, para, start, end: start + text.length, hue };
};

/** two marks already down, so the list has something in it on arrival */
export const SEED: Highlight[] = [
  seed(1, 0, "first screen most people see", 2),
  seed(2, 2, "the walk home", 4),
];

export interface Segment {
  text: string;
  mark: Highlight | null;
}

/** a paragraph cut at its marks, in reading order */
export function segments(text: string, marks: readonly Highlight[]): Segment[] {
  const out: Segment[] = [];
  let at = 0;
  for (const m of [...marks].sort((a, b) => a.start - b.start)) {
    if (m.start > at) out.push({ text: text.slice(at, m.start), mark: null });
    out.push({ text: text.slice(m.start, m.end), mark: m });
    at = m.end;
  }
  if (at < text.length) out.push({ text: text.slice(at), mark: null });
  return out;
}

/**
 * A selection grown out to whole words and trimmed of the space at either end.
 * Half a word marked is never what a hand dragging across prose meant.
 */
export function snap(
  text: string,
  start: number,
  end: number,
): [number, number] {
  let s = start;
  let e = end;
  while (s > 0 && !/\s/.test(text[s - 1])) s--;
  while (e < text.length && !/\s/.test(text[e])) e++;
  while (s < e && /\s/.test(text[s])) s++;
  while (e > s && /\s/.test(text[e - 1])) e--;
  return [s, e];
}

/**
 * The marks left once a new one is laid over `[start, end)`. A mark the new one
 * overlaps keeps whatever part of it is outside, which can be a piece either
 * side.
 */
export function cut(
  marks: readonly Highlight[],
  para: number,
  start: number,
  end: number,
  nextId: () => number,
): Highlight[] {
  const text = NOTES[para];
  const out: Highlight[] = [];
  // a piece cut at a word boundary carries the space beside it, which goes
  const keep = (m: Highlight) => {
    let { start: s, end: e } = m;
    while (s < e && /\s/.test(text[s])) s++;
    while (e > s && /\s/.test(text[e - 1])) e--;
    if (e > s) out.push({ ...m, start: s, end: e });
  };
  for (const m of marks) {
    if (m.para !== para || m.end <= start || m.start >= end) {
      out.push(m);
      continue;
    }
    if (m.start < start) keep({ ...m, end: start });
    if (m.end > end) keep({ ...m, id: nextId(), start: end });
  }
  return out;
}
