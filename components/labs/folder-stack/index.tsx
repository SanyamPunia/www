"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { GroupWave, MOTIF, STOCK, TONE } from "./motifs";
import type { RecordId } from "./records";
import {
  CARD_H,
  CARDS,
  CASE,
  type Card,
  CLIP_TOP,
  LIFT,
  PAD,
  PANEL,
  PANEL_TOP,
  pad,
  RADIUS,
  REACH_H,
  STAGE_H,
  TAB_H,
  TAB_W,
  tabLeft,
  tabPath,
} from "./stack";

/**
 * A drawer of card index folders. Hovering one pulls it up out of the pile, and
 * what it holds was behind the card in front of it the whole time.
 *
 * Every card is the same box in the same place and exactly one `translateY`
 * moves, so there is nothing here to fade, mount or measure: **the reveal is
 * occlusion.** The hovered card lifts by what the pile is holding back and
 * nothing else on the stage moves at all, so it comes out from behind the card in
 * front of it and paints over the cards behind it, which is what pulling a folder
 * out of a drawer does. See `stack.ts` for the geometry and `records.ts` for what
 * is filed.
 *
 * ── why the DOM can be trusted here ──────────────────────────────────────────
 *
 * `document-pocket` had to leave the DOM entirely and hit test its own neutral
 * geometry, because a card that moves in response to being hovered moves out
 * from under the pointer, the hover drops, the card falls back, and the loop
 * never closes. Nothing in that argument applies here, and it is worth being
 * exact about why, since the two look like the same problem.
 *
 * **The only thing that moves is the card under the pointer, and its own region
 * only ever grows.** Card k's region runs from its own tab top to the next
 * card's, and lifting it takes that top edge up by `LIFT` and leaves the foot
 * where it was, since the card in front never moves: the open region strictly
 * contains the resting one, whatever the pointer is doing inside it. Nothing else
 * on the stage moves at all, so nothing can arrive under a pointer that is not
 * already on it.
 *
 * **So the state settles in at most one step and cannot cycle.** Every position
 * has a resting owner, which is the card whose shut strip holds it. From any
 * state, a pointer inside the lifted card's grown region keeps it, and a pointer
 * anywhere else lands on its resting owner, whose region then contains it. There
 * is no second card whose region could have moved in the meantime, so there is no
 * pair to hand the pointer back and forth.
 *
 * Several states are stable for one position, since a lifted card's grown region
 * covers the resting strips of the cards behind it, and that is hysteresis
 * rather than ambiguity: it covers them on screen as well, so what is hit is
 * what is drawn.
 *
 * So the hit testing is the browser's own, and it is exact, including the curve
 * on every tab's shoulders. See `Tab` for the two lines that buy that.
 *
 * ── two things that follow from only one card moving ─────────────────────────
 *
 * **The lifted card is the only one that can carry a shadow, and it is the only
 * one that wants one.** A card's shadow paints in its own layer and every card in
 * front of it paints above that layer, so at rest a shadow reaches nothing: the
 * card beneath covers it. A lifted card is in front of everything it overlaps,
 * which is the whole of what it just rose past, so its shadow lands on the cards
 * behind and is what says it came out of the pile rather than being a gap in it.
 * At rest the pile is line art, which is what it should be, since paper flush in
 * a drawer casts nothing.
 *
 * **A panel is hidden unless its own card is out, and that is not belt and
 * braces.** A card is covered by the card in front of it, so lifting card k
 * uncovers the panel of card k - 1, which is 26px of a second record showing
 * under the one being read. Hiding it is what a drawer with one card out looks
 * like. The hide is deferred by the length of the travel, or the panel would
 * vanish on the first frame of the drop while it is still clear of the card in
 * front, and the show is not, since a panel at rest sits entirely behind that
 * card and has nothing to reveal. See `PANEL_TOP`.
 */

/**
 * How everything here travels.
 *
 * A hover response, so it front-loads: the same finding `stamp-collection`
 * measured on its own lift, where a spring spent a dozen frames creeping through
 * its last two pixels and read as lag however short the total was. There is no
 * spring here at all, since paper does not bounce, and a `translate` on a
 * transition costs no JS per frame.
 *
 * Under reduced motion the whole prefix drops out, which leaves the transform
 * with nothing to interpolate: a card still opens, it just does not travel, the
 * line `book-opening` draws. The duration and the ease sit inside the variant
 * with it, or `transition-property` keeps its initial value of `all` and reduced
 * motion gets a 200ms transition on everything instead of none.
 */
const GLIDE =
  "motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-[cubic-bezier(0.32,0.72,0,1)]";

/**
 * How the pile arrives: one card behind the next, back to front, and the case
 * last.
 *
 * **In paint order, which is also the order they are stacked**, so the drawer
 * assembles rather than fading up as one block. `Reveal` brings the whole demo in
 * on the page's own stagger, and this is the same idea one level down: a 0.4s
 * fade, 55ms apart.
 *
 * **A fade and nothing else.** The site's own reveal variant pairs one with a rise
 * and a blur, and on eight cards arriving in sequence that reads as the pile
 * assembling out of focus. The keyframe is `folder-in` in `app/globals.css`, it
 * touches `opacity` alone, and it names no transform, since `transform` is what
 * carries a card's lift and an animation outranks a normal declaration. The delay
 * is per card and inline, so it beats the shorthand this class compiles to.
 *
 * All of it sits behind `motion-safe:`, since `MotionProvider` governs Motion's
 * own animations and never a raw keyframe, the same call `disc-spin` and the
 * signature make. With the animation gone every card is simply present: the
 * keyframe carries the `opacity: 0` rather than the element, so there is nothing
 * to land on.
 */
const DEAL = "motion-safe:animate-[folder-in_0.4s_ease-out_both]";
const DEAL_STEP = 55;

/**
 * The table: `fill`, with a shade at the corners.
 *
 * **What separates a folder from the ground is chroma, not lightness.** The
 * papers sit at 1.32 to 1.40 against it, which is the same step white paper had,
 * and they are the only things in the frame carrying any hue at all. Painting the
 * stage white instead was tried while the folders were mid-tone: it works, and it
 * leaves the demo with no container, which the frame's own hairline then has to be.
 *
 * The vignette is a shade at the corners rather than a pool of light in the
 * middle: on a ground this light, a white pool takes the middle of the stage to
 * the paper's own value and the pile stops reading as being on anything.
 */
const GROUND =
  "radial-gradient(118% 96% at 50% 46%, rgb(0 0 0 / 0), rgb(0 0 0 / 0.045) 100%)";

/** what the case is lifted by, and the only lift in the experiment */
const CASE_LIFT =
  "0 1px 2px rgb(0 0 0 / 0.04), 0 8px 18px -10px rgb(0 0 0 / 0.12)";

/**
 * Paper, with its hairline.
 *
 * A record's own `paper` and `edge` go in inline, since they are the record's
 * rather than the theme's, and a divider takes `STOCK`, the grey card stock that
 * sits in the same value band as the six colours.
 */
const PAPER =
  "pointer-events-auto absolute inset-x-0 bottom-0 cursor-pointer border motion-safe:transition-shadow motion-safe:duration-200";

/** what a card out of the pile is lifted by, and what the case sits on */
const CARD_LIFT =
  "0 2px 6px rgb(0 0 0 / 0.05), 0 14px 28px -14px rgb(0 0 0 / 0.22)";

/**
 * A card's panel, which is the whole of what opening one shows.
 *
 * **A record's panel is a white sheet behind a `stroke` hairline**, since a sheet
 * of paper inside a coloured folder is what a folder holds, and it is also the
 * ground the trace reads best on. The ring rather than a border, since a border
 * would take its pixel out of the rows this is sized for.
 *
 * **A divider's sheet is `fill` rather than white**, since a white sheet on a
 * white card is a hairline round nothing. Both kinds carry the same box, the same
 * hairline and the same geometry, so an open card is an open card whichever it is,
 * and only the fill knows what it is sitting on.
 *
 * `justify-between`, so a record's filing line stays at the top and its caption
 * at the foot with the trace between them, and a divider's files fill the box
 * whatever the column does to them.
 */
const PANEL_BOX = "absolute flex flex-col justify-between overflow-hidden p-2";
const SHEET = "ring-1 ring-stroke ring-inset";

/**
 * And how it goes away.
 *
 * `visibility` rather than a mount, since the panel has to be in the box it is
 * about to be revealed from, and rather than `opacity`, since a fade is a second
 * thing happening on top of the travel. It is deferred by exactly the length of
 * that travel: a discrete property with a delay flips at the end of it, so the
 * panel is behind the card in front again by the time it goes. Nothing defers the
 * other way, because a panel at rest is already covered.
 */
const PANEL_GONE =
  "invisible motion-safe:transition-[visibility] motion-safe:duration-0 motion-safe:delay-200";

/**
 * A panel's mono lines.
 *
 * `text-secondary` rather than `text-muted`, which measured 2.4:1 on the wash
 * this panel used to be and 2.5 on the white it is now. That is under 3:1 for the
 * line carrying a record's number, its place and its length. This is 5.33.
 */
const LINE =
  "flex items-center gap-1.5 font-mono text-meta text-text-secondary";

/**
 * A record's own trace, in its own hue, drawn in from the left as the card comes
 * out of the pile.
 *
 * **A `clip-path` sweep rather than a dash offset**, since half of these motifs
 * are forty separate lines and a dash only reveals a path: one inset covers every
 * drawing in the set without any of them knowing about it. Linear, because what
 * it stands for is a tape running at one speed, where everything else here
 * front-loads.
 *
 * The sweep is 340ms against the card's own 200, and it starts 80ms in, so the
 * trace is still arriving after the card has settled. It reads as the recording
 * playing rather than as the panel fading up.
 *
 * **It draws once and stays drawn.** A card the pointer has already opened has
 * nothing left to reveal, and replaying the sweep on every return reads as the
 * panel reloading its own contents. So the clip is keyed off whether this record
 * has ever been open rather than off whether it is open now: the first open
 * sweeps, every one after it finds the trace already there, and closing never
 * puts it back. Nothing has to defer to the panel's hide either, since the clip no
 * longer moves when a card drops.
 *
 * The colour is set here rather than inside the drawing, so `motifs.tsx` is
 * geometry and this file is the only place a token or a value meets a card.
 */
const DRAWN = "[clip-path:inset(0_0_0_0)]";
const UNDRAWN = "[clip-path:inset(0_100%_0_0)]";
const SWEEP = "motion-safe:[transition:clip-path_340ms_linear_80ms]";

function Trace({ id, drawn }: { id: RecordId; drawn: boolean }) {
  const Drawing = MOTIF[id];
  return (
    <span
      className={cn("block", SWEEP, drawn ? DRAWN : UNDRAWN)}
      style={{ color: TONE[id].mark }}
    >
      <Drawing />
    </span>
  );
}

/**
 * Whether a pointer is one that can hover.
 *
 * **The test is for a hovering pointer rather than against a finger**, and that is
 * the difference between a phone that cannot open a folder by accident and one
 * that can. `tab-overview` reads `pointerType` for this rather than a
 * `(hover: hover)` query, since the query answers for the device and a laptop with
 * a touchscreen reports true for both. What it does not say is what to do with a
 * pointer that names itself neither: an `""` is what a browser sends when it does
 * not know, and `!== "touch"` hands that one the hover path on a device that has
 * no way to take a hover back. So only `mouse` and `pen` hover, and everything
 * else taps.
 *
 * **So on a phone this experiment is taps and nothing else.** A tap opens a
 * folder, a second tap on the same one shuts it, and a tap on the bare table shuts
 * whatever is open, which is `stamp-collection`'s call for its own stage.
 */
function hovers(type: string): boolean {
  return type === "mouse" || type === "pen";
}

/** a metadata separator, per the rule against text ones */
function Dot() {
  return (
    <span
      aria-hidden="true"
      className="inline-block size-1 shrink-0 rounded-full bg-stroke-strong"
    />
  );
}

export default function FolderStack() {
  /** which card is out of the pile, by its index in it */
  const [open, setOpen] = useState<number | null>(null);

  /**
   * And which records have had their trace drawn, so it is drawn once.
   *
   * Set from an effect rather than from the handlers that open a card, for two
   * reasons: those are four (pointer, tap, key, focus) and this would have to be
   * in all of them, and the extra commit is what gives the sweep two frames to
   * run between. Adding the id in the same commit as the open leaves the clip
   * with no from-value to transition out of.
   */
  const [drawn, setDrawn] = useState<ReadonlySet<RecordId>>(new Set());

  useEffect(() => {
    if (open === null) return;
    const card = CARDS[open];
    if (card.kind !== "record" || drawn.has(card.id)) return;
    setDrawn((seen) => new Set(seen).add(card.id));
  }, [open, drawn]);

  const stage = useRef<HTMLDivElement>(null);

  /**
   * A pending shut, one frame out.
   *
   * **Leaving a card has to be heard, and acting on it at once is what makes the
   * pile drop back between two cards.** Crossing from one card to the next fires
   * leave on the first and enter on the second, in that order and inside the same
   * dispatch, so a shut that waits a frame is cancelled by the enter before it can
   * run. Nothing else needs the delay: a pointer that has really left the pile has
   * no enter coming.
   *
   * The alternative shipped first and is what a card holding its state across the
   * whole stage looks like: only the stage's own leave shut the pile, so a lifted
   * card stayed up while the pointer wandered the bare table around it.
   */
  const shut = useRef(0);

  /*
   * The two ways the pile shuts, both bound to the node rather than written as
   * JSX props. The stage is a region the pointer passes through and has no
   * honest interactive role to carry, the same call `document-pocket` and
   * `stamp-collection` make for their own stages, and `focusout` has to be heard
   * here anyway, since it bubbles and a card losing focus has to reach up to it.
   *
   * A pointer that has left the stage is a pile with nothing asking it to be
   * open, and it shuts at once rather than waiting the frame a card's own leave
   * waits, since nothing is going to take it. **A finger is the exception**,
   * since a touch pointer stops existing when it lifts and fires its leave then
   * rather than on going anywhere at all, which would shut a tapped card inside
   * its own gesture. The same gate `book-opening` documents.
   */
  const hold = (i: number) => {
    cancelAnimationFrame(shut.current);
    shut.current = 0;
    setOpen(i);
  };

  const release = () => {
    cancelAnimationFrame(shut.current);
    shut.current = requestAnimationFrame(() => {
      shut.current = 0;
      setOpen(null);
    });
  };

  useEffect(() => () => cancelAnimationFrame(shut.current), []);

  useEffect(() => {
    const node = stage.current;
    if (!node) return;

    const leave = (event: PointerEvent) => {
      if (!hovers(event.pointerType)) return;
      cancelAnimationFrame(shut.current);
      setOpen(null);
    };

    /*
     * And the touch half of the same thing. A finger has no leave to be heard, so
     * a tap that misses every card is what says the reader is done with the one
     * that is open, the same call `stamp-collection` makes for its table. The
     * target is what tells a miss from a hit: a card's paper and its tab are the
     * only things in here that take a pointer at all, so anything not inside a
     * button is the table. A swipe never reaches this, since a touch that becomes
     * a scroll is cancelled rather than lifted.
     */
    const tapOff = (event: PointerEvent) => {
      if (hovers(event.pointerType)) return;
      const target = event.target;
      if (target instanceof Element && target.closest("button")) return;
      setOpen(null);
    };

    const blur = (event: FocusEvent) => {
      const next = event.relatedTarget;
      if (next instanceof Node && node.contains(next)) return;
      setOpen(null);
    };

    node.addEventListener("pointerleave", leave);
    node.addEventListener("pointerup", tapOff);
    node.addEventListener("focusout", blur);
    return () => {
      node.removeEventListener("pointerleave", leave);
      node.removeEventListener("pointerup", tapOff);
      node.removeEventListener("focusout", blur);
    };
  }, []);

  return (
    <div
      ref={stage}
      className="relative w-full select-none overflow-hidden rounded-lg bg-fill"
      style={{ height: STAGE_H, backgroundImage: GROUND }}
    >
      {/*
       * The cards' own box, which clips them at both ends. Its foot is the case's
       * top edge and is what hides every card's tail, and its head is where a
       * lifted card 0 sits. See `REACH_H`: both bounds are exact and both are
       * load-bearing.
       */}
      <div
        className="absolute inset-x-0 overflow-hidden"
        style={{ top: CLIP_TOP, height: REACH_H }}
      >
        {CARDS.map((card, i) => {
          const out = open === i;

          return (
            <button
              key={card.id}
              type="button"
              aria-expanded={out}
              aria-label={
                card.kind === "divider"
                  ? `${card.label}, ${card.files.length} files`
                  : card.label
              }
              /*
               * Hover is the gesture this demo is about and it is the one a
               * phone cannot make, so a tap is heard on `pointerup` and a key
               * press on `click` with no pointer behind it. Both are
               * `book-opening`'s calls: the click after a tap is a compatibility
               * event that arrives after the whole pointer sequence, and a
               * keyboard activation is the one press that arrives only as a
               * click. Which of the two a pointer gets is `hovers`, and the tap
               * takes everything that is not a mouse or a pen rather than only a
               * finger.
               *
               * **A tap is `pointerup` rather than that click, and the reason is
               * slop.** A finger drifts, and a tap that drifts far enough is a
               * scroll: the browser cancels the pointer and sends no `pointerup`
               * and no `click` at all, which is the right answer, since what the
               * reader asked for was the page to move. Inside the slop both still
               * arrive, and `pointerup` is the one that carries the pointer's own
               * type. Measured on this stage: a 12px drift opens the folder, a
               * 40px drift lands `pointercancel` and changes nothing.
               *
               * A card shuts on its own leave rather than on the stage's, so the
               * pile is only ever open under the pointer. See `shut` for the one
               * frame that costs and why it is needed.
               */
              onPointerEnter={(event) => {
                if (!hovers(event.pointerType)) return;
                hold(i);
              }}
              onPointerLeave={(event) => {
                if (!hovers(event.pointerType)) return;
                release();
              }}
              onPointerUp={(event) => {
                if (hovers(event.pointerType)) return;
                setOpen(out ? null : i);
              }}
              onClick={(event) => {
                if (event.detail !== 0) return;
                setOpen(out ? null : i);
              }}
              onFocus={() => setOpen(i)}
              /*
               * **The card itself is transparent to the pointer and its paper
               * and its tab are not.** A card's box is its whole height, most of
               * which is behind the cards in front of it, and its top strip runs
               * the full width where the tab in it does not. Left to capture on
               * its own box, a card would answer for a band of the card behind it
               * across everything but the tab, and the pointer would open the
               * wrong folder wherever the drawing and the box disagree. Handing
               * the hit region to the two things that paint makes it the drawing
               * exactly, shoulders included, and the enter still reaches this
               * button by bubbling.
               *
               * `text-left` because a `<button>` centres its own text and a
               * filing card's lines all start at its left margin. The tab's own
               * label centres itself inside the tab.
               */
              className={cn(
                "group pointer-events-none absolute text-left outline-none",
                GLIDE,
                DEAL,
              )}
              style={{
                top: card.offset,
                left: `${(1 - card.width) * 50}%`,
                width: `${card.width * 100}%`,
                height: CARD_H,
                transform: `translateY(${out ? -LIFT : 0}px)`,
                animationDelay: `${i * DEAL_STEP}ms`,
              }}
            >
              {/* the focus ring is on the paper rather than on the button's box,
                  which includes the tab's own band, and it is an inset outline
                  rather than the site's offset ring: the pile overlaps by design,
                  so an offset one would draw on the neighbouring card. The same
                  call `stamp-collection` makes for its scalloped edge. */}
              <span
                className={cn(
                  PAPER,
                  "group-focus-visible:outline-2 group-focus-visible:-outline-offset-2 group-focus-visible:outline-text-primary/25",
                )}
                style={{
                  top: TAB_H,
                  borderRadius: RADIUS.card,
                  backgroundColor:
                    card.kind === "record" ? TONE[card.id].paper : STOCK.paper,
                  borderColor:
                    card.kind === "record" ? TONE[card.id].edge : STOCK.edge,
                  boxShadow: out ? CARD_LIFT : undefined,
                }}
              />

              <Tab card={card} />

              <span
                className={cn(PANEL_BOX, SHEET, !out && PANEL_GONE)}
                style={{
                  top: PANEL_TOP,
                  left: PAD,
                  right: PAD,
                  height: PANEL,
                  borderRadius: RADIUS.panel,
                  backgroundColor:
                    card.kind === "record"
                      ? "var(--color-bg)"
                      : "var(--color-fill)",
                }}
              >
                {card.kind === "record" ? (
                  <>
                    {/* the filing line, then the trace, then what the trace is
                        of. The place rides the filing line rather than the
                        caption, since a caption and a place on one row run past
                        the panel at the narrowest column. */}
                    <span className={cn(LINE, "justify-between")}>
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="shrink-0">rec {card.number}</span>
                        <Dot />
                        <span className="truncate">{card.place}</span>
                      </span>
                      <span className="shrink-0">{card.length}</span>
                    </span>
                    <Trace id={card.id} drawn={drawn.has(card.id)} />
                    <span className="text-meta text-text-primary">
                      {card.note}
                    </span>
                  </>
                ) : (
                  <>
                    <span className={LINE}>
                      <span>{card.label}</span>
                      <Dot />
                      <span>{card.files.length} files</span>
                      <Dot />
                      {/* the one thing about a group that is nowhere else on the
                          stage, since its tab now previews the hues and the tabs
                          below it carry the names */}
                      <span>{card.total}</span>
                    </span>
                    {/* The group's tape as one wave, shared out by length and
                        coloured by the file each stretch belongs to. Four
                        versions of this were lists: a comma line, one name per
                        line, two columns of coloured names, then chips. A divider
                        opening onto the same thing a record opens onto is simpler
                        than all of them, and the tabs three rows below already
                        carry the names. */}
                    <GroupWave files={card.files} />
                  </>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/*
       * The case. It is not a member of the pile: nothing opens it, nothing moves
       * it at all, and the cards are cut off at its top edge rather than hidden
       * behind it, so it is free to be as shallow as it looks.
       *
       * White paper, like the dividers and like every sheet inside a folder. It
       * went grey for one round, while the ground was white and a white case was
       * the largest thing in the frame holding no colour. With the ground back to
       * `fill` and the folders bright, grey is the wrong way round: it made the
       * biggest object in the piece the dullest thing in it, a flat slab under a
       * row of colour. White puts it in the paper family and lets the table be the
       * only grey.
       *
       * **Its top corners are square, and that is what covers the cut.** The last
       * card has nothing in front of it, so its paper ends on the clip line as a
       * flat edge with no border on it, and the case's top edge is that same line.
       * Rounded, the corners curved away from the cut and left the raw edge
       * hanging over them: measured, the case is 5.4px wider than the last card
       * either side against a 14px radius, so the curve started 8.6px inside the
       * card and the cut showed. A straight top edge spans the whole of it, and a
       * drawer front is square where the cards go in anyway.
       *
       * It carries no handler either. Arriving on it is a card's own leave, which
       * is what shuts the pile, so it needs no role.
       */}
      <div
        className={cn(
          "absolute flex items-center justify-center border border-stroke-strong bg-bg",
          DEAL,
        )}
        style={{
          animationDelay: `${CARDS.length * DEAL_STEP}ms`,
          // square at the top, rounded at the foot: see the note above
          borderRadius: `0 0 ${RADIUS.card}px ${RADIUS.card}px`,
          top: CASE.top,
          left: `${(1 - CASE.width) * 50}%`,
          width: `${CASE.width * 100}%`,
          height: CASE.height,
          boxShadow: CASE_LIFT,
        }}
      >
        {/* A label plate rather than bare type, so the case reads as the front of a
            drawer and not as the box left over under the pile. A hairline pill
            rather than a filled one, since nothing here is pressable and a
            `bg-fill` pill on white paper is what a button looks like. */}
        <span className="flex items-center gap-1.5 rounded-full px-3 py-1 text-meta text-text-secondary ring-1 ring-stroke">
          <span>{CASE.label}</span>
          <Dot />
          <span className="font-mono text-text-muted">
            {pad(CASE.files)} files
          </span>
        </span>
      </div>
    </div>
  );
}

/**
 * One tab: the shape, its hairline, and the label in it.
 *
 * **The fill is one path and the hairline is another**, which is what puts the
 * shoulder's foot exactly on the card's top edge. See `tabPath` for the two
 * shapes and why they are not one shape painted twice.
 *
 * The fill is also the hit region, since an SVG path is a target only where it
 * paints. That is what makes a pointer on the hollow of a shoulder's curve belong
 * to the card showing under it rather than to this one.
 *
 * **A divider's tab is grey card stock with its group's hues on it, and it used to
 * be solid near-black.** That was the reference's own treatment and it inverted
 * the weight of the whole piece: a 96 by 17 block of `text-primary` is the
 * heaviest thing on the stage by an order of magnitude, and a divider is
 * structure. The folders are the content and they were the quietest labels in the
 * frame.
 *
 * So the fill drops to `fill-active`, which is a stiffer stock than the paper
 * around it and is what an index divider is anyway, the label goes to
 * `text-primary` at a tenth of the ink the fill spent, and the tab carries one
 * dot per record in the group, in that record's own `mark`. It reads as a heading
 * with its contents previewed on it, which is what a divider is for, and each dot
 * matches the tab a row or two below it.
 */
function Tab({ card }: { card: Card }) {
  const width = TAB_W;
  const height = TAB_H + 2;
  const dark = card.kind === "divider";

  return (
    <span
      className="absolute top-0"
      style={{ left: tabLeft(card), width, height }}
    >
      <svg
        aria-hidden="true"
        focusable="false"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="absolute inset-0"
      >
        <path
          className="pointer-events-auto cursor-pointer"
          d={tabPath(0, width, 0, height)}
          fill={dark ? STOCK.paper : TONE[card.id].paper}
        />
        <path
          d={tabPath(0.5, width - 0.5, 0.5, TAB_H + 0.5)}
          fill="none"
          stroke={dark ? STOCK.edge : TONE[card.id].edge}
        />
      </svg>

      {/* The label rides above the shape, in `text-primary` on both kinds, since
          the folder itself now carries the hue. It reads at 14:1 on a record's
          paper against the 5 it managed when the type was the coloured thing, and
          nothing on the tab has to change on hover: the lift and its shadow
          already say which card is out. */}
      <span
        className="absolute inset-x-0 top-0 flex items-center justify-center gap-1.5"
        style={{ height: TAB_H }}
      >
        <span className="truncate px-1 text-meta leading-none tracking-wide text-text-primary">
          {card.label}
        </span>

        {card.kind === "divider" &&
          card.files.map((file) => (
            <span
              key={file.id}
              aria-hidden="true"
              className="size-1 shrink-0 rounded-full"
              style={{ backgroundColor: TONE[file.id].mark }}
            />
          ))}
      </span>
    </span>
  );
}
