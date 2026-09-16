/*
 * Where everything sits, as pure geometry.
 *
 * No React, no DOM beyond the measured widths handed in, the split
 * `document-pocket` makes with `poses.ts` and `event-stacking` with its own
 * `layout.ts`. Chip widths come from the browser once, and everything after
 * that is arithmetic.
 *
 * **Nothing here is in flow, and that is the whole architectural call.** The
 * obvious Motion answer is `layout`, which would put the chips in two real
 * containers and let the projection engine move them between the two. It
 * cannot work. A gooey merge needs the blob under a chip to agree with that
 * chip **on every frame**, not only at the ends, and a layout animation's
 * intermediate position is a transform the engine owns: reading it back means
 * a `getBoundingClientRect` per element per frame, which is the cost both
 * `event-stacking` and `sticker-peel` are built to avoid. If the blob and the
 * chip can ever disagree, the goo tears.
 *
 * So every rect is computed here, one set of numbers drives the chip and its
 * blob, and the two cannot come apart.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** a chip's height in the row, and in the tray, which are the same chip */
export const CHIP_H = 30;

/**
 * The tray's height. The lip is what the goo needs: a chip that lands flush
 * against the tray's own edge has nothing to grow a neck out of, and at six
 * pixels either side the two shapes read as one slab with a chip set into it.
 */
export const TRAY_H = 42;

/** the lip, which is the above two minus each other over two */
export const LIP = (TRAY_H - CHIP_H) / 2;

/**
 * The tray's corner, which is half of one row and never half of the tray.
 *
 * **`rounded-full` is only right while the tray is one row deep.** It resolves
 * to half the shorter side, so a tray wrapped to three rows on a 320px screen
 * was 200 by 141 with a 70px corner: a lozenge rather than a slab, and the
 * readout sits on the first row, 21px down, where a corner that size has not
 * finished curving. The count was drawn outside its own tray. Held at half a
 * row the shape is a stadium while it is one row and a rounded rectangle once
 * it wraps, which is what it is.
 */
export const TRAY_R = TRAY_H / 2;

/** between two chips in the row, and between two chips inside the tray */
export const GAP = { row: 8, tray: 3 };

/** between rows of chips, measured between their tops */
export const ROW_STEP = CHIP_H + 10;

/** the tray's own padding, before the count and after the last chip */
export const TRAY_PAD = 12;

/** between the count and the first chip in the tray */
export const COUNT_GAP = 12;

/**
 * What the tray keeps between itself and the stage's own edge.
 *
 * **It wraps here rather than at the stage's width**, or the tray grows until
 * it is exactly the stage and the demo has a slab running edge to edge with no
 * ground around it. Measured at six picked before this: 313px of a 313px stage
 * at a 390 viewport, 0 clear on the left and 0.3 on the right, so the only
 * breathing room left was the frame's own padding. 360 kept 6px and 320 kept
 * 12, which is the same failure at three sizes rather than one.
 *
 * It is not a cap on how wide the tray may be, which is the fixed width this
 * lab tried and threw away. The tray still grows to fit what is in it. It just
 * runs out of room a little sooner and drops the next chip onto a new row.
 */
export const TRAY_GUTTER = 16;

/**
 * The clear button, which is a square glyph at the tray's own end.
 *
 * It used to be the word `clear`, in the margin to the left of the tray, and it
 * was the worst element on the stage: bare grey text with no edge, floating
 * with nothing to belong to, and sliding every time the tray's width changed,
 * since its position was derived from the tray's own left edge. Clearing what
 * you picked belongs to the thing holding what you picked.
 *
 * **It is a constant rather than a measurement, and that is the point of making
 * it square.** The width of the word had to be read out of the browser before
 * the tray could be laid out at all. A glyph's box is a number this file can
 * simply state.
 */
export const CLEAR = 24;

/** between the last chip in the tray and the clear button at its end */
export const CLEAR_GAP = 10;

/**
 * Between the tray's row and the first row of unselected chips.
 *
 * **It has to be wider than the neck's reach**, and that is the only reason it
 * is this wide. A chip resting under the tray is a rect-to-rect distance away
 * from it, so at fourteen pixels every chip in the top row was already inside
 * the band where a neck forms: the goo went to full on the frame of the click,
 * with no approach to watch, and stayed there after a chip landed back in the
 * row. Out here it starts at zero and the neck is something the flight makes.
 */
export const FIELD_GAP = 48;

export interface Measured {
  id: string;
  /** the chip's own width, measured once in the browser */
  w: number;
  selected: boolean;
}

export interface Plan {
  tray: Rect;
  /** every chip's rect, selected or not, keyed by id */
  chips: Record<string, Rect>;
  /** the clear button's top left, inside the tray at its end */
  clear: { x: number; y: number };
  /** what the field has to be tall enough for */
  height: number;
}

export interface Input {
  /** the stage's inner width */
  width: number;
  chips: readonly Measured[];
  /** the count readout's measured width, which sets where the tray's chips start */
  countW: number;
}

/**
 * Lay the selected chips out inside the tray, wrapping when they would take it
 * wider than the stage.
 *
 * **The tray is as wide as what is in it**, so a pick grows it and the chips
 * already seated ride along as it recentres. That was built the other way once,
 * one open width held from the first pick so nothing inside ever moved, and it
 * was worse: the slab is the object the eye is on, and a fixed one is a bar
 * sitting there with space nobody has filled. It grows to fit, which is what a
 * thing collecting what you hand it does.
 *
 * Past the stage's width it grows in height instead, which is both the only way
 * it fits a phone, where six chips want 428px of a 352px stage, and the better
 * shape anyway: a slab two rows deep still reads as a container, where one row
 * of six reads as a bar.
 */
function fill(
  countW: number,
  picked: readonly Measured[],
  max: number,
): { w: number; h: number; rows: Array<{ chips: Measured[]; x: number }> } {
  if (picked.length === 0) {
    return { w: TRAY_PAD * 2 + countW, h: TRAY_H, rows: [] };
  }

  /* the button lives inside the tray, so every row gives up its width */
  const slot = CLEAR + CLEAR_GAP;
  const first = TRAY_PAD + countW + COUNT_GAP;
  const rows: Array<{ chips: Measured[]; x: number }> = [];
  let row: Measured[] = [];
  let x = first;
  let widest = 0;

  for (const chip of picked) {
    const step = (row.length ? GAP.tray : 0) + chip.w;
    if (row.length && x + step + slot + TRAY_PAD > max) {
      rows.push({ chips: row, x: rows.length === 0 ? first : TRAY_PAD });
      widest = Math.max(widest, x);
      row = [];
      x = TRAY_PAD;
    }
    x += step;
    row.push(chip);
  }
  rows.push({ chips: row, x: rows.length === 0 ? first : TRAY_PAD });
  widest = Math.max(widest, x);

  return {
    w: widest + slot + TRAY_PAD,
    h: TRAY_H + (rows.length - 1) * (CHIP_H + GAP.tray),
    rows,
  };
}

/**
 * Wrap the unselected chips into rows no wider than `width`.
 *
 * Greedy, since the chips keep their given order and a row of filter chips has
 * no reason to reorder itself: what a reader is looking for is where a chip
 * went, and a wrap that reshuffles loses it.
 */
function wrap(
  chips: readonly Measured[],
  width: number,
): Array<{ chips: Measured[]; w: number }> {
  const rows: Array<{ chips: Measured[]; w: number }> = [];
  let row: Measured[] = [];
  let used = 0;

  for (const chip of chips) {
    const step = (row.length ? GAP.row : 0) + chip.w;
    if (row.length && used + step > width) {
      rows.push({ chips: row, w: used });
      row = [];
      used = 0;
    }
    used += (row.length ? GAP.row : 0) + chip.w;
    row.push(chip);
  }
  if (row.length) rows.push({ chips: row, w: used });
  return rows;
}

/**
 * The whole arrangement: the tray centred on its own row with the clear button
 * inside it, and the rest of the chips wrapped and centred underneath.
 *
 * **The tray is centred on the stage and nothing outside it moves it.** The
 * button used to sit in the margin, which meant the pair had to be centred
 * together or the tray was visibly off the middle, and centring the pair moved
 * the one object the eye tracks every time the button appeared or went. With
 * the button inside, there is one object to centre.
 *
 * Stacked rather than side by side, unlike the reference, because this column
 * is 538px and the reference's own code drops to a stacked layout under 560.
 * There is no wide branch to maintain for a width this page never has.
 */
export function plan(input: Input): Plan {
  const picked = input.chips.filter((chip) => chip.selected);
  const rest = input.chips.filter((chip) => !chip.selected);

  const tray = fill(
    input.countW,
    picked,
    Math.max(0, input.width - TRAY_GUTTER * 2),
  );
  const trayX = Math.max(0, (input.width - tray.w) / 2);
  const chips: Record<string, Rect> = {};

  tray.rows.forEach((row, i) => {
    let x = trayX + row.x;
    const y = LIP + i * (CHIP_H + GAP.tray);
    for (const chip of row.chips) {
      chips[chip.id] = { x, y, w: chip.w, h: CHIP_H };
      x += chip.w + GAP.tray;
    }
  });

  /* and the rest wrap underneath, each row centred on the stage */
  const rows = wrap(rest, input.width);
  let bottom = tray.h;
  rows.forEach((row, i) => {
    let rx = (input.width - row.w) / 2;
    const ry = tray.h + FIELD_GAP + i * ROW_STEP;
    for (const chip of row.chips) {
      chips[chip.id] = { x: rx, y: ry, w: chip.w, h: CHIP_H };
      rx += chip.w + GAP.row;
    }
    bottom = ry + CHIP_H;
  });

  return {
    tray: { x: trayX, y: 0, w: tray.w, h: tray.h },
    chips,
    /* at the tray's own end, centred on however deep the tray currently is */
    clear: {
      x: trayX + tray.w - TRAY_PAD - CLEAR,
      y: (tray.h - CLEAR) / 2,
    },
    height: bottom,
  };
}
