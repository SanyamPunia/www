import { ARCHIVE, DRAWER, type RecordId } from "./records";

/*
 * The pile's geometry, in stage pixels, and the three rules the whole experiment
 * rests on.
 *
 * ── why pixels ───────────────────────────────────────────────────────────────
 *
 * Vertically everything here is a fixed px and the stage has a fixed height,
 * where `book-opening` makes every value a share of its own stage. The
 * difference is that a card carries prose: a panel is three or four rows of
 * `text-meta`, and type does not scale with a column. Sizing the pile as a share
 * of the width would leave that panel 70% of its height on a phone with the same
 * words in it. So the pile keeps its height at every width and only the cards'
 * widths are shares.
 *
 * ── the card ─────────────────────────────────────────────────────────────────
 *
 * **Every card is the same box in the same place, and exactly one `translateY`
 * moves.** A card is never resized, and every card is the same height whatever
 * it holds. What opens one is that card coming out from behind the card in front
 * of it, so the reveal is occlusion and there is nothing to fade, mount or
 * measure. `PEEK` is the whole of the closed state: the distance between one
 * card's tab top and the next's, so it decides how much of every card shows at
 * rest, and `LIFT` is how far the one card under the pointer comes up out of it.
 *
 * ── which way it opens ───────────────────────────────────────────────────────
 *
 * **The hovered card lifts by `LIFT` and nothing else in the drawer moves at
 * all.** The card in front of it never has to give way, the case never travels,
 * and the cards behind it do not move either: the lifted card simply paints over
 * them, which is what pulling one folder up out of a drawer does to the folders
 * behind it.
 *
 * Two things follow, and both are why this is the arrangement:
 *
 * - **The pile keeps its own shape.** Every other tab is where it was, so the
 *   drawer does not appear to open everywhere at once.
 * - **It is the strongest form of the stability argument**, since the card that
 *   moves in response to being hovered is the only thing that can move at all.
 *   See `index.tsx`.
 *
 * ── and where the room comes from ────────────────────────────────────────────
 *
 * A lifted card needs `LIFT` of room above its own row, and the topmost row needs
 * all of it, so **the stage carries that room at both ends and the pile sits in
 * the middle of it.** Nothing ever has to move to make space: the only thing that
 * travels in this experiment is the one card under the pointer.
 *
 * Two other arrangements were built and both are worse. Pinning the pile to the
 * foot of the frame is the same stage height with all of the slack above the shut
 * pile, which reads as a pile that has slid to the bottom. Sliding the whole
 * assembly down as a first beat and lifting the card as a second keeps the pile
 * centred in a shorter stage, and it costs a flicker: the slide takes the card
 * out from under its own pointer, which shuts it, brings it back and starts
 * again. That is fixable, by exempting the hovered card from the slide and
 * splitting its lift across `translate` and `transform` so the two beats can hold
 * different delays, and it is a lot of machinery for a demo that is about the
 * folders.
 */

/** between one card's tab top and the next's: the strip each card shows at rest */
const PEEK = 36;

/**
 * How far a tab rises above its own card's top edge.
 *
 * A tab therefore paints over the card above it, which is what a filing tab
 * does, and it belongs to its own card's hit region rather than to that card's.
 * See `index.tsx` for how the two are kept in agreement.
 *
 * 19 is what a 12px label needs with `leading-none` and a few pixels either
 * side. It
 * is also part of a card's own height, since a lifted card has to keep covering
 * the band it was covering: see `CARD_H`.
 */
export const TAB_H = 19;

/**
 * The tab's own width, and the run each shoulder takes to get up there.
 *
 * **One width for both kinds, and that is the lift's doing.** A lifted card lands
 * three rows up, which is one turn of the cut cycle, so its tab lands exactly on
 * the tab of the card it covers. That only reads as one tab if the two are the
 * same size: at 148 against a divider's 108 the wider one poked out either side
 * and its label showed through, which looks like a rendering fault. A divider has
 * less to say on its tab and centres it in the same box.
 */
export const TAB_W = 148;
const SHOULDER = 20;

/** the paper margin at a panel's sides and foot */
export const PAD = 9;

/**
 * What a corner is worth here, in px.
 *
 * **Off the radius scale on purpose, and it is the one thing in this file that
 * is a taste rather than a constraint.** `rounded-lg` is 6.4px, which is the
 * site's own card radius and is what the frame around this demo uses, and on a
 * card 400px wide by 167px tall it reads as a square with the corners taken off.
 * These are drawn objects rather than surfaces, the same standing
 * `document-pocket` and `stamp-collection` give their own pixel geometry, and
 * paper in a drawer is soft.
 */
export const RADIUS = { card: 14, panel: 9 } as const;

/**
 * Where a card's panel starts, measured from the card's own top.
 *
 * **Not `PAD` below the card's own edge, which is the obvious answer and shows
 * the panel at rest.** What covers a card is the next card's *paper*, and that
 * paper starts `TAB_H` below the next card's top, since a tab's band is
 * transparent either side of the tab in it. So the first pixel the pile reliably
 * hides is `PEEK + TAB_H`, and a panel any higher than that has its own top
 * printed in the strip the card shows shut. The 2 is insurance against a
 * fractional layout, since the two edges would otherwise meet exactly.
 *
 * It also puts a card's top margin at 30px against 9 at the sides, which is what
 * a filing card looks like anyway.
 */
export const PANEL_TOP = PEEK + TAB_H + 2;

/**
 * The panel a card holds, which is the only thing deciding how far the pile
 * opens, and therefore how tall the stage has to be.
 *
 * A record spends it on a filing line, its own trace and a caption, and a divider
 * on four rows of `text-meta`, which is a heading and its files one to a line.
 * One height for both, since two would buy a divider that opens a little less far
 * and cost every number below a second case to carry.
 *
 * **It was 100 and the drawer read as a small object in a tall room.** The stage
 * has to carry a lift at both ends, so every pixel of panel costs two of frame,
 * and a panel that comes in under three rows of `PEEK` is what takes the lift
 * from four rows to three: the pile is then 60% of the stage rather than 53%, in a
 * frame 32px shorter. The 76 is spent as one row of type, a 24px trace, another
 * row, and 4.8px of padding round the lot.
 */
export const PANEL = 84;

/**
 * The case at the foot of the pile.
 *
 * Its height is free, since the case never moves and the cards are cut off at
 * its top edge rather than hidden behind it. 64 is what reads as a drawer front
 * under a pile this deep, and it is the whole of the object's weight at the foot
 * of the stage.
 */
const CASE_H = 72;

/** table above a lifted card 0, and below the case */
export const MARGIN = 12;

/**
 * The narrowest card and the widest, as shares of the stage.
 *
 * Each card is a step wider than the one above it, so the shut pile is a
 * staircase of top edges rather than one rectangle with lines across it. That is
 * the reference's own silhouette, and it is also what makes the occlusion total:
 * the card below is wider, so it covers its neighbour completely and leaves only
 * the tabs and the edges.
 *
 * **They were 0.70 to 0.94 and the drawer read as a small object in a big room.**
 * A stage this tall has to hold a lift's worth of table at both ends, so the pile
 * can only fill it by being wide. 0.96 leaves the case about 2% of the stage
 * either side, which is enough to keep it clear of the frame's own radius at
 * every width, and the extra room goes into the panels: at the narrowest column a
 * record's caption gets 194px against 166.
 */
const WIDTH = { first: 0.8, last: 0.96 };

/**
 * Where a tab sits across its card, cycling: centre, left, right.
 *
 * The three-position cut is a real filing convention and it is most of why the
 * reference reads as a drawer rather than as a list. A period of three against a
 * stack of eight also means no two neighbours share a cut, which is the only
 * thing the cycle has to guarantee, since tabs never overlap vertically.
 */
const CUTS = [1, 0, 2] as const;

type Cut = (typeof CUTS)[number];

interface Row {
  id: string;
  label: string;
  /** its top in the pile, before anything opens */
  offset: number;
  /** its width, as a share of the stage */
  width: number;
  cut: Cut;
}

interface RecordCard extends Row {
  kind: "record";
  /** narrowed from `Row`, so a record's trace and its hue can be typed against it */
  id: RecordId;
  /** its filing number, derived from its place among the records */
  number: string;
  note: string;
  place: string;
  length: string;
}

interface DividerCard extends Row {
  kind: "divider";
  /** the records it stands in front of, derived from the list, with their lengths */
  files: { id: RecordId; label: string; seconds: number }[];
  /** and how much tape that is, summed from those records */
  total: string;
}

export type Card = RecordCard | DividerCard;

/**
 * How far a card comes up out of the pile, and **it is a whole number of rows on
 * purpose.**
 *
 * A lifted card's paper edge cuts across whatever is behind it, so at any other
 * value that edge lands part way through a tab and slices it: at `CARD_H - PEEK`
 * the pile behind loses three tabs and keeps a fourth cut in half, which reads as
 * a rendering fault rather than as a card in front of another. At a multiple of
 * `PEEK` the edge lands exactly where a card's own paper starts, so every tab
 * behind is either whole or gone, and the lifted card sits in the slot three rows
 * up rather than between two of them.
 *
 * **Three rows is also one whole turn of `CUTS`**, so the card lands on a row
 * whose tab is cut to the same position as its own and covers it exactly. At four
 * the two sat side by side in one band, which read as a pair of tabs at the same
 * height rather than as one card in front of another.
 *
 * It is the shortest lift that clears the card in front. A panel has to come out
 * from behind that card's paper, which starts `PEEK + TAB_H` below the lifted
 * card's own top, so the lift has to be at least `PANEL_TOP + PANEL` minus that,
 * and it has to keep the deepest card's panel inside the clip on the way:
 * `PANEL_TOP + PANEL <= LIFT + PEEK`, which is 141 against 144.
 *
 * A card is a little taller than it lifts, and the difference is the paper
 * margin below its panel, which stays tucked behind the card in front.
 */
export const LIFT = PEEK * 3;

/**
 * A card's whole height, tab included.
 *
 * **It is not "as tall as its contents need", and this was a flicker.** A card's
 * visible strip at rest runs down to the paper of the card in front, which is
 * `PEEK + TAB_H` below its own top, and a tab band is transparent either side of
 * the tab in it, so a card is what shows through the band of the card in front of
 * it. Lift the card by `LIFT` and the foot of its paper comes up by the same
 * amount: if the card is any shorter than `LIFT + PEEK + TAB_H` it stops covering
 * the last few pixels it was covering, the pointer sitting there lands on the
 * card behind, that card lifts and leaves in its turn, and the pile flickers down
 * through itself. Measured on a slow pointer sweep at 4px steps: seven backward
 * steps before, none after.
 *
 * **A lifted card has to keep covering everything it covered**, so the height is
 * that sum and the panel takes what it needs from the top of it. What is left
 * over sits below the panel as paper, and is never seen: it is behind the card in
 * front in both states.
 */
export const CARD_H = LIFT + PEEK + TAB_H;

/** the shut pile of tabs, from the first tab top to the case's own top edge */
const TABS_H = ARCHIVE.length * PEEK;

/**
 * Where stack coordinates start inside the cards' own box: one whole lift down
 * from its top, which is the room card 0 needs to rise into.
 */
const ORIGIN = LIFT;

/**
 * The box the cards live in, and the one that clips them.
 *
 * It runs from a lifted card 0's tab top to the case's top edge, so it is `LIFT`
 * taller than the shut pile of tabs. Both bounds are exact rather than generous,
 * and both are load-bearing:
 *
 * - **Its foot is what hides every card's tail.** Only `PEEK` of a card is ever
 *   meant to show, and the last card has nothing in front of it to hide the rest
 *   behind. A lifted card's panel finishes a pixel above this line at the
 *   deepest, so nothing but a tail is ever cut.
 * - **Its head is where a lifted card 0 sits**, so nothing is clipped there
 *   either.
 *
 * The cut itself is never on screen, since the case's top edge sits on this line
 * in every state.
 */
export const REACH_H = LIFT + TABS_H;

/**
 * Where the shut pile's first tab top sits: one lift below the margin, which is
 * the room the topmost card needs to rise into.
 */
export const REST = MARGIN + LIFT;

/**
 * And so the stage, which carries that room twice: once above the pile for the
 * lift and once below the case, so the object sits in the middle of the frame
 * with the same table either side of it.
 */
export const STAGE_H = REST * 2 + TABS_H + CASE_H;

/** the cards' own box starts one `ORIGIN` above the pile, which is the margin */
export const CLIP_TOP = REST - ORIGIN;

/** how many files the case says it holds, and every filing number, at two digits */
export function pad(count: number): string {
  return String(count).padStart(2, "0");
}

/**
 * Row i's width.
 *
 * `a * (1 - t) + b * t` rather than `a + (b - a) * t`, for the reason
 * `book-opening` sets out at length: the second form does not land on its own
 * endpoints, so the widest row would come out a rounding error short of the one
 * number that decides how wide the pile is.
 */
function span(i: number): number {
  const t = i / ARCHIVE.length;
  return WIDTH.first * (1 - t) + WIDTH.last * t;
}

/**
 * How long a group runs, summed from its own records.
 *
 * A divider's panel used to say only what its tab and the three tabs under it
 * already said. This is the one thing about a group that is nowhere else on the
 * stage, and it is derived rather than written down, so it cannot drift from the
 * lengths it adds up.
 */
function runtime(files: { seconds: number }[]): string {
  const seconds = files.reduce((sum, file) => sum + file.seconds, 0);
  return `${Math.floor(seconds / 60)}:${pad(seconds % 60)}`;
}

/** "04:12" to 252, so a group can add its files up and share them out by length */
function tape(length: string): number {
  const [minutes, rest] = length.split(":").map(Number);
  return (minutes ?? 0) * 60 + (rest ?? 0);
}

/**
 * The records a divider stands in front of, up to the next divider.
 *
 * It carries their ids as well as their labels, so a divider's panel can print
 * each one in that record's own hue and read as the legend for the group it
 * heads.
 */
function group(i: number): DividerCard["files"] {
  const files: DividerCard["files"] = [];
  for (const entry of ARCHIVE.slice(i + 1)) {
    if (entry.kind === "divider") break;
    files.push({
      id: entry.id,
      label: entry.label,
      seconds: tape(entry.length),
    });
  }
  return files;
}

/**
 * The pile, in document order, which is also its paint order and therefore its
 * hit-test order: every card paints over the one above it. Nothing carries a
 * `zIndex`.
 */
export const CARDS: Card[] = ARCHIVE.map((entry, i): Card => {
  const row = {
    id: entry.id,
    label: entry.label,
    offset: ORIGIN + i * PEEK,
    width: span(i),
    cut: CUTS[i % CUTS.length],
  };

  if (entry.kind === "divider") {
    const files = group(i);
    return { ...row, kind: "divider", files, total: runtime(files) };
  }

  return {
    ...row,
    id: entry.id,
    kind: "record",
    number: pad(
      ARCHIVE.slice(0, i).filter((seen) => seen.kind === "record").length + 1,
    ),
    note: entry.note,
    place: entry.place,
    length: entry.length,
  };
});

/**
 * The case, which is the pile's floor and the reason the drawer reads as a
 * drawer. Nothing opens it, nothing moves it and it holds no panel, so it is a
 * sibling of the cards' box rather than a member of the pile, placed off the
 * same two numbers.
 */
export const CASE = {
  label: DRAWER,
  files: ARCHIVE.filter((entry) => entry.kind === "record").length,
  top: REST + TABS_H,
  width: span(ARCHIVE.length),
  height: CASE_H,
};

/**
 * A tab's outline: a flat top on two S-curved shoulders, drawn from its own box's
 * foot so the base is always open.
 *
 * **Each shoulder is one cubic with both control points on the midway x**, which
 * puts a horizontal tangent at each end of it. So the shoulder leaves the card's
 * own top edge along that edge and arrives at the tab's flat top along the top:
 * there is no corner anywhere in the shape, at the feet or at the head. A
 * trapezoid with rounded top corners was the first version and it still had two
 * hard angles where the slants met the card, which is the sharpest thing this
 * demo had in it.
 *
 * The feet needing no join of their own is what makes this work at a hairline.
 * The stroke arrives tangent to the card's border and finishes on that border's
 * own centre line, so the tab's outline runs into the card's edge rather than
 * landing on it.
 *
 * **It is one function called twice, once for the fill and once for the
 * hairline**, since the two are different shapes rather than one shape painted
 * two ways. The fill runs to the box's foot, which is two pixels past the card's
 * top edge, so it covers the paper's border where the tab crosses it. The
 * hairline stops on that border's centre line and is inset half a pixel all
 * round, so it lands on the pixel grid.
 */
export function tabPath(
  left: number,
  right: number,
  top: number,
  base: number,
): string {
  const a = left + SHOULDER;
  const b = right - SHOULDER;
  const midL = left + SHOULDER / 2;
  const midR = right - SHOULDER / 2;

  return [
    `M${left} ${base}`,
    `C${midL} ${base} ${midL} ${top} ${a} ${top}`,
    `H${b}`,
    `C${midR} ${top} ${midR} ${base} ${right} ${base}`,
  ].join("");
}

/**
 * Where a card's tab sits, as a `left` value.
 *
 * Inset as a share of the card and sized in px, since a tab holds a label and a
 * label does not scale. The inset is what keeps the outermost cuts off the
 * card's own rounded corners.
 */
export function tabLeft(card: Card): string {
  const width = TAB_W;
  if (card.cut === 0) return "7%";
  if (card.cut === 2) return `calc(93% - ${width}px)`;
  return `calc(50% - ${width / 2}px)`;
}
