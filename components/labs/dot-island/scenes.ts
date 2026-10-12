import {
  bitmapCells,
  CHECK,
  CYCLE,
  DIGITS,
  DISC,
  type Icon,
  iconCells,
  LOADER,
  wordCells,
} from "./font";

/**
 * What the island shows in each phase, in cells. Pure, so the frame loop can
 * ask for the scene on every frame and compare it with what is on the panel.
 *
 * A scene is the pill's size and a list of items. An item is a named group of
 * lit cells, and the name is what the morph matches on: the record icon in the
 * menu and the record dot in the recording pill are both `rec`, so those dots
 * travel to each other rather than into whatever happens to be nearest.
 */

export type Phase =
  | "idle"
  | "menu"
  | "rec"
  | "stopped"
  | "shot"
  | "saved"
  | "deleted";

export type Action = "record" | "screenshot" | "save" | "restart" | "delete";

export type Tone = "on" | "dim" | "tail" | "faint" | "rec" | "recDim";

export interface Item {
  key: string;
  cells: [number, number][];
  tones: Tone[];
  /**
   * How a change inside one phase reaches the panel. `cut` swaps the cells in
   * one frame, which is an LED flipbook. `slide` sends the dots to their new
   * cells, which is a timer digit turning over.
   */
  motion: "cut" | "slide";
}

/** a pressable row, in cells from the pill's top left corner */
export interface Row {
  action: Action;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Scene {
  /** the pill, in cells. Always odd wide, so it centres on a column */
  w: number;
  h: number;
  items: Item[];
  rows: Row[];
  /** 0 to 1, how much the whole panel is lit by a shutter */
  flash: number;
}

export interface Clock {
  /** ms since the phase began */
  since: number;
  /** a free-running ms clock for the loader and the blink */
  now: number;
  hover: number | null;
  /**
   * The rows whose icon is playing, and how far into its play each one is in
   * ms. A row stays here after the hover leaves until its loop ends, so the
   * page decides when a play stops and the scene only draws it.
   */
  plays: ReadonlyMap<number, number>;
  /** the recording's length in ms */
  elapsed: number;
  /** reduced motion: every flipbook holds its resting frame */
  still: boolean;
}

/** the cells either side of an icon and its label, and around the rows */
const GAP = 3;
const PAD_X = 5;
const PAD_Y = 4;
const ROW_GAP = 4;
/** a compact pill's height, seven rows of type and two of air each side */
const COMPACT_H = 11;

/**
 * The tallest pill there is, the three-row stopped menu. The stage centres
 * this one and every shorter pill hangs from the same top edge, so the island
 * grows downward the way the hardware does.
 */
export const TALLEST = PAD_Y * 2 + 3 * 7 + 2 * ROW_GAP;

const MENUS: Record<
  "menu" | "stopped",
  { action: Action; label: string; icon: Icon }[]
> = {
  menu: [
    { action: "record", label: "record", icon: "rec" },
    { action: "screenshot", label: "screenshot", icon: "cam" },
  ],
  stopped: [
    { action: "save", label: "save", icon: "save" },
    { action: "restart", label: "restart", icon: "restart" },
    { action: "delete", label: "delete", icon: "trash" },
  ],
};

/** how long one loop of a row's icon takes, so a leaving hover can finish it */
export function rowCycle(phase: Phase, row: number): number {
  if (phase !== "menu" && phase !== "stopped") return 0;
  const entry = MENUS[phase][row];
  return entry ? CYCLE[entry.icon] : 0;
}

const odd = (n: number) => (n % 2 === 0 ? n + 1 : n);

function at(
  key: string,
  cells: [number, number][],
  x: number,
  y: number,
  tone: Tone,
  motion: Item["motion"] = "cut",
): Item {
  return {
    key,
    cells: cells.map(([cx, cy]) => [cx + x, cy + y]),
    tones: cells.map(() => tone),
    motion,
  };
}

function menu(kind: "menu" | "stopped", clock: Clock): Scene {
  const entries = MENUS[kind];
  const widths = entries.map((e) => 7 + GAP + wordCells(e.label).w);
  const w = odd(PAD_X * 2 + Math.max(...widths));
  const h = PAD_Y * 2 + entries.length * 7 + (entries.length - 1) * ROW_GAP;

  const items: Item[] = [];
  const rows: Row[] = [];
  entries.forEach((entry, i) => {
    const y = PAD_Y + i * (7 + ROW_GAP);
    /* with nothing hovered every row is lit, and a hover steps the rest back */
    const tone: Tone = clock.hover === null || clock.hover === i ? "on" : "dim";
    const into = clock.still ? undefined : clock.plays.get(i);
    items.push(
      at(entry.icon, iconCells(entry.icon, into ?? null), PAD_X, y, tone),
      at(
        `l-${entry.action}`,
        wordCells(entry.label).cells,
        PAD_X + 7 + GAP,
        y,
        tone,
      ),
    );
    /* the row reaches halfway into the gap either side, so rows meet */
    rows.push({
      action: entry.action,
      label: entry.label,
      x: 2,
      y: y - ROW_GAP / 2,
      w: w - 4,
      h: 7 + ROW_GAP,
    });
  });
  return { w, h, items, rows, flash: 0 };
}

/**
 * The loader's eight cells sit two apart, so the 3 by 3 loader spans five
 * cells of the panel. At one apart it was a speck in the middle of the pill:
 * at rest the island read as empty.
 */
function idle(clock: Clock): Scene {
  const w = 19;
  const head = clock.still ? 2 : Math.floor(clock.now / 90) % LOADER.length;
  const tones: Tone[] = ["on", "tail", "faint"];
  const cells: [number, number][] = [];
  const cellTones: Tone[] = [];
  tones.forEach((tone, k) => {
    const [x, y] = LOADER[(head - k + LOADER.length) % LOADER.length];
    cells.push([x * 2 + 7, y * 2 + 3]);
    cellTones.push(tone);
  });
  return {
    w,
    h: COMPACT_H,
    items: [{ key: "loader", cells, tones: cellTones, motion: "cut" }],
    rows: [],
    flash: 0,
  };
}

function timer(ms: number): string {
  const s = Math.min(99 * 60 + 59, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function rec(clock: Clock): Scene {
  const items: Item[] = [];
  /* the dot breathes on a one second beat, lit for two thirds of it */
  const lit = clock.still || clock.elapsed % 1000 < 650;
  items.push(at("rec", bitmapCells(DISC), 4, 3, lit ? "rec" : "recDim"));

  let x = 4 + 5 + GAP + 1;
  [...timer(clock.elapsed)].forEach((ch, i) => {
    const glyph = DIGITS[ch];
    items.push(at(`t${i}`, bitmapCells(glyph), x, 2, "on", "slide"));
    x += glyph[0].length + 1;
  });
  return { w: odd(x - 1 + 4), h: COMPACT_H, items, rows: [], flash: 0 };
}

/**
 * Both endings are an icon and a word. The keys are the stopped menu's, so a
 * save sends the save row's own dots into the check and its word, and a delete
 * does the same with the bin.
 */
function done(icon: "save" | "trash", word: string): Scene {
  const label = wordCells(word);
  const cells = icon === "save" ? bitmapCells(CHECK) : iconCells("trash", null);
  const items = [
    at(icon, cells, 4, 2, "on"),
    at(
      icon === "save" ? "l-save" : "l-delete",
      label.cells,
      4 + 7 + GAP,
      2,
      "on",
    ),
  ];
  return {
    w: odd(4 + 7 + GAP + label.w + 4),
    h: COMPACT_H,
    items,
    rows: [],
    flash: 0,
  };
}

/**
 * The shutter. The viewfinder's corners close in, the panel flashes, and then
 * the phase hands over to `saved`. The icon keeps the menu row's key, so the
 * row's own viewfinder is what travels into the pill.
 */
export const SHUTTER = 240;
function shot(clock: Clock): Scene {
  const t = clock.since;
  const frame = clock.still
    ? iconCells("cam", null)
    : t < 110
      ? iconCells("cam", 0)
      : t < SHUTTER
        ? iconCells("cam", 390)
        : iconCells("cam", 520);
  const flash = clock.still || t < SHUTTER ? 0 : Math.exp(-(t - SHUTTER) / 150);
  return {
    w: 19,
    h: COMPACT_H,
    items: [at("cam", frame, 6, 2, "on")],
    rows: [],
    flash,
  };
}

export function scene(phase: Phase, clock: Clock): Scene {
  let s: Scene;
  switch (phase) {
    case "idle":
      s = idle(clock);
      break;
    case "menu":
    case "stopped":
      s = menu(phase, clock);
      break;
    case "rec":
      s = rec(clock);
      break;
    case "shot":
      s = shot(clock);
      break;
    case "saved":
      s = done("save", "saved");
      break;
    case "deleted":
      s = done("trash", "deleted");
      break;
  }
  /*
   * Cells come out of each builder from the pill's top left. The panel's grid
   * is centred on the stage, column 0 under its middle, so every cell shifts
   * left by half the pill.
   */
  const half = (s.w - 1) / 2;
  for (const item of s.items) {
    for (const cell of item.cells) cell[0] -= half;
  }
  return s;
}
