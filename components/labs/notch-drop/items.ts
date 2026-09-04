/*
 * What is on the page under the notch: four things a reader can pick up, the
 * kinds of thing a capture tool is for. Each carries a title, a line of
 * detail, a kind, and the content its preview shows. The content is real
 * where it can be: the screenshot is one of this site's own lab stills and the
 * link is one of its own projects, so nothing here is a grey bar standing in
 * for a thing.
 */
export type Kind = "note" | "image" | "link" | "file";

export interface Item {
  id: string;
  title: string;
  /** keeps its casing: a filename, a size and a host are data, not copy */
  meta: string;
  kind: Kind;
  /** the note's first lines */
  lines?: string[];
  /** the screenshot, a still this site already ships */
  src?: string;
  /** the link's host and its mark */
  host?: string;
  favicon?: string;
  /** the report's figures */
  rows?: [string, string][];
}

/**
 * A hue per kind: the card's face, and a saturated mark for the icon and the
 * meta line. Four cards built from the same parts need colour to tell them
 * apart, so it carries meaning here, the exception the folder stack and eight
 * other experiments take. The faces sit at 1.25 to 1.42 on white, the band
 * the folder stack's papers hold, so a card gains a hue without gaining
 * weight, and `text-primary` clears 12:1 on every one. The marks clear 4:1 on
 * their own face, which is the floor for a graphic. `text-secondary` does not
 * clear 4.5 on the tints, which is why the meta line takes the mark instead.
 * Scoped to this lab, not tokens.
 */
export const TONE: Record<Kind, { face: string; mark: string }> = {
  note: { face: "#fde68a", mark: "#b45309" },
  image: { face: "#bfdbfe", mark: "#1d4ed8" },
  link: { face: "#ddd6fe", mark: "#6d28d9" },
  file: { face: "#fecdd3", mark: "#be123c" },
};

export const ITEMS: Item[] = [
  {
    id: "note",
    title: "Design review, Thursday",
    meta: "Notes, edited 2 min ago",
    kind: "note",
    lines: [
      "Confirm dialog closes before the mutation lands.",
      "Row hover pokes past the card radius.",
      "Check the 44px tap targets on the phone.",
    ],
  },
  {
    id: "image",
    title: "Screenshot 2026-09-04 at 10.42.18",
    meta: "PNG, 1.2 MB",
    kind: "image",
    src: "/assets/labs/sticker-peel.webp",
  },
  {
    id: "link",
    title: "Morphing one icon into another",
    meta: "morphrig.dev",
    kind: "link",
    host: "morphrig.dev",
    favicon: "/assets/favicons/morphrig.webp",
  },
  {
    id: "file",
    title: "Q3 latency report",
    meta: "PDF, 14 pages, 3.8 MB",
    kind: "file",
    rows: [
      ["p50", "123ms"],
      ["p95", "410ms"],
      ["p99", "1.2s"],
    ],
  },
];
