"use client";

import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { approach, clamp01, lerp } from "./lerp";
import {
  BOOK_HEIGHT,
  BOOK_WIDTH,
  FORE_EDGE,
  PULL,
  SHEETS,
  SPREAD,
  STAGE_ASPECT,
} from "./sheets";

/**
 * A book that opens on one number.
 *
 * Every sheet holds the same box for the life of the demo and turns on its own
 * spine. The stage carries `--book-open`, a plain number from 0 to 1, and each
 * sheet multiplies it by the angle it lands on at full open, so fourteen
 * transforms come off one property and the browser is the thing interpolating
 * them. See `sheets.ts` for why that is the same lerp twice.
 *
 * The frame loop's whole job is deciding what that number is. Hover mode drives
 * it to 0 or 1 and lets the smoothing find the way, cursor mode reads it
 * straight off the pointer's distance from the shut book's fore-edge.
 */

/**
 * How quickly the book answers, as the time constant of the approach in
 * seconds. Opening is slower than shutting, the call `document-pocket` makes:
 * the cover has weight to it and is the half worth watching, and closing
 * follows a pointer that has already left.
 *
 * `open` was 0.15 and the fan arrived a little too eagerly for the weight of
 * paper. 0.19 keeps the gesture short and takes the hurry out of it: 0.27 of the
 * way in 60ms against 0.33, and half open at 132ms against 104. It also puts the
 * two at a 1.9 ratio, near the 1.8 `document-pocket` settled on.
 *
 * These are not spring stiffnesses and nothing here overshoots. Paper does not
 * bounce, and a lerp toward a target cannot pass it.
 */
const TAU = { open: 0.19, shut: 0.1 };

/**
 * How close counts as arrived.
 *
 * An exponential approach never lands, so without this the loop runs a frame
 * every 16ms forever, writing a number that stopped mattering three decimal
 * places ago. At 1e-4 the last step is a hundredth of a degree on the widest
 * sheet.
 */
const EPSILON = 1e-4;

/** the dt a first frame assumes, and the most any frame is allowed to be worth */
const FIRST_STEP = 1 / 60;
const MAX_STEP = 1 / 15;

/**
 * How much room the pointer gets around the shut book, as a share of the stage's
 * width.
 *
 * The boards overhang the leaves and the tilt turns the whole book a few
 * degrees, so a reach sized to the sheets alone leaves the outer pixels of the
 * thing you are aiming at doing nothing.
 */
const REACH_PAD = 0.04;

/** and how much taller it gets at full open, where the fan stands nearest the eye */
const REACH_RISE = 0.24;

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2";

const pct = (share: number) => `${(share * 100).toFixed(3)}%`;

/*
 * ── the geometry, as CSS that reads one property ──────────────────────────────
 *
 * Every box below is a percentage of the stage, so nothing here is measured and
 * the demo holds whatever width the column is. The ones that move all move on
 * `--fan-left` rather than on `--book-open` itself, for the reason that value
 * documents. The fallback of 0 covers the first paint, before the loop has
 * written the property at all.
 */

/**
 * How far left of the spine the fan reaches, as a share of the book's width,
 * and 0 for as long as it reaches no further left than the spine.
 *
 * **This is the one value here that is not linear in `--book-open`, and it is
 * not part of the interpolation.** It is a correction, and it is the cover's own
 * cosine because that is where the cover's free edge is: until the cover passes
 * vertical the whole fan still lies between the spine and the shut book's
 * fore-edge, and only past that does anything start hanging off the other side.
 *
 * Three things read it, and all three would be wrong on `--book-open` itself.
 * Measured at half open, where the cover stands at 84 degrees: the fan occupies
 * the shut book's own box, so a book drifting on t is 37px right of centre, its
 * shadow is half as wide again as the thing casting it, and the pointer's target
 * has grown into a region with nothing in it.
 *
 * `cos()` in `calc` is CSS Values 4 and has been in every evergreen browser
 * since 2023.
 */
const FAN_LEFT = `max(0, 0 - cos(var(--book-open, 0) * ${SPREAD}deg))`;

/**
 * The book's own box.
 *
 * The spine is the container's left edge, so a shut book centred on the stage
 * would open into the left half of it and finish a half width off centre.
 * Sliding the spine right by that half width as the fan reaches left keeps the
 * fan's own middle on the stage's middle the whole way, which is what makes the
 * book read as opening rather than as opening and travelling.
 *
 * It is `left` rather than a `translateX`, so the tilt is the only thing in the
 * transform and an unsupported `cos()` cannot cost the book its perspective.
 */
const BOOK_LEFT = `calc(${pct(0.5 - BOOK_WIDTH / 2)} + ${pct(BOOK_WIDTH / 2)} * ${FAN_LEFT})`;
/**
 * A shade below centred, since half open grows upward rather than evenly: the
 * sheets that stand nearest the eye are magnified about the stage's own middle,
 * and the tilt takes their tops further than their feet.
 */
const BOOK_TOP = pct(0.5 - BOOK_HEIGHT / 2 + 0.02);

/** laid on a table, seen from above, and turned so it does not sit square */
const TILT = "rotateX(15deg) rotateZ(-5deg)";

/**
 * One sheet's turn.
 *
 * `--sheet-angle` and `--sheet-z` are the only per-sheet values, both static, so
 * this string is shared by all fourteen and the animated part is the one
 * property they inherit.
 *
 * The depth is applied inside the rotation, so a sheet is offset along its own
 * normal rather than along the stage's. Shut, that is a stack of paper with
 * thickness. Open, it is what keeps the fan from folding into one plane.
 */
const SHEET_TURN =
  "rotateY(calc(var(--book-open, 0) * var(--sheet-angle))) translateZ(var(--sheet-z))";

/**
 * The reach: the pointer's target in hover mode, and the keyboard's control in
 * both.
 *
 * **It grows with the fan and never shrinks under a pointer, which is the whole
 * design.** `document-pocket` documents the failure this avoids: hit test a box
 * that moves because it was hovered and the hover drops, the box goes back, and
 * the hover picks it up again. A sheet past vertical is well outside the shut
 * book's footprint, so a reach fixed at that footprint would shut the book the
 * moment the pointer followed the paper. Both edges step outward with the fan
 * instead, and since the shut region is a subset of every later one there is no
 * oscillation available.
 *
 * It is a plain untransformed box, so the browser's own hit testing is exact and
 * nothing has to be measured in JS.
 */
const REACH_LEFT = `calc(${pct(0.5 - BOOK_WIDTH / 2 - REACH_PAD)} - ${pct(BOOK_WIDTH / 2)} * ${FAN_LEFT})`;
const REACH_WIDTH = `calc(${pct(BOOK_WIDTH + REACH_PAD * 2)} + ${pct(BOOK_WIDTH)} * ${FAN_LEFT})`;
const REACH_HEIGHT = `calc(${pct(BOOK_HEIGHT)} + ${pct(BOOK_HEIGHT * REACH_RISE)} * ${FAN_LEFT})`;

/** what the book casts, spreading as the fan does */
const FLOOR_WIDTH = `calc(${pct(BOOK_WIDTH)} * (0.92 + 0.95 * ${FAN_LEFT}))`;

/*
 * ── the paint ─────────────────────────────────────────────────────────────────
 */

/**
 * The table. A pool of light where the book sits, falling away at the corners,
 * so the object is in something rather than on a flat swatch.
 *
 * Not the frame's white, for the reason `document-pocket` gives: the paper is
 * white, and on white a fanned sheet is a hairline and nothing else. One step
 * darker than that pocket's `bg-fill` though, because there the paper only had
 * to read against a near-black pocket and here it is the whole object. At
 * `bg-fill` the sheets, the table and the pool of light on it were all inside 5%
 * of each other and the fan read as fog.
 */
const GROUND = [
  "radial-gradient(74% 64% at 50% 44%, rgb(255 255 255 / 0.28), rgb(255 255 255 / 0) 76%)",
  "radial-gradient(122% 104% at 50% 50%, rgb(0 0 0 / 0), rgb(0 0 0 / 0.07) 100%)",
].join(", ");

/**
 * Fractal noise, inline as a data URI so the page makes no request for it.
 *
 * The board is cloth over card, which is a diffuse surface, and grain is what
 * that looks like. Without it the shut book is a near-black rectangle with a
 * gradient on it. `overlay` does nothing to pure black and everything to a mid
 * tone, so the grain lands where the board is lit and stays out of its shadow.
 */
const GRAIN = `url("data:image/svg+xml,%3Csvg viewBox='0 0 140 140' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E")`;

/** the board's face, lit from the upper left and shaded toward its own foot */
const BOARD_LIGHT =
  "linear-gradient(152deg, rgb(255 255 255 / 0.1), rgb(255 255 255 / 0.02) 46%, rgb(0 0 0 / 0.28) 100%)";

/** paper is not flat white: a breath of shade toward the foot of the sheet */
const PAPER_LIGHT =
  "linear-gradient(to bottom, rgb(255 255 255 / 0) 55%, rgb(0 0 0 / 0.03) 100%)";

/**
 * Ruled lines, one per tile of the background box.
 *
 * A gradient rather than elements, since nine rules on fourteen sheets is 126
 * nodes to say "paper" with. The block is inset from the sheet's own edge, which
 * is what a page's margins are.
 */
const RULES =
  "linear-gradient(to bottom, var(--color-stroke) 0 1px, transparent 1px)";

/**
 * What a sheet is lifted by, and it ramps with the fan for a reason.
 *
 * Shut, all fourteen sheets are in the same place, so any shadow they carry is
 * painted fourteen times and the book sits in a dark halo. At 0 the leaves cast
 * nothing and the boards carry the whole book's shadow, which is what a shut
 * book has.
 *
 * Inline rather than a Tailwind `shadow-*`, because the alpha interpolates a
 * custom property and there is no readable way to write that as a utility. An
 * inline `boxShadow` overwrites a ring, though, since a ring is a box-shadow
 * too, so every sheet's hairline is a real `outline` instead.
 */
const LEAF_LIFT =
  "0 1px 2px rgb(0 0 0 / calc(var(--book-open, 0) * 0.08)), 0 6px 16px -4px rgb(0 0 0 / calc(var(--book-open, 0) * 0.18))";
const BOARD_LIFT =
  "0 1px 2px rgb(0 0 0 / 0.06), 0 6px 14px rgb(0 0 0 / 0.07), 0 18px 34px -10px rgb(0 0 0 / 0.16)";

/** a sheet's box. The boards overhang the leaves, which is a book's own square. */
const LEAF = "absolute inset-0 rounded-md";
const BOARD = "absolute -inset-1 rounded-lg transform-3d";

/** and a face of one, printed on one side only */
const FACE =
  "absolute inset-0 overflow-hidden rounded-[inherit] backface-hidden @container";

const GRAIN_LAYER = "pointer-events-none absolute inset-0 rounded-[inherit]";

/**
 * A sheet's face, one per material, hairline included.
 *
 * **`stroke-strong` and not `stroke`.** Sheets overlap by most of their width,
 * so a shadow between two of them lands on the one beneath and cancels, where an
 * edge does not, and at `stroke` the fan read as fog. On the pastedown `stroke`
 * could not read at all, being the same value as `fill-hover` to a pixel.
 *
 * **The pastedown is grey, and that is what gives the open book its ends.** The
 * two boards face away from the reader at full open, so with white paper on
 * their insides the fan finishes on the same white it is made of and reads as
 * loose sheets. A tinted pastedown is what a bound book has there anyway.
 */
const PAPER_EDGE = "bg-bg outline-1 -outline-offset-1 outline-stroke-strong";
const PASTEDOWN_EDGE =
  "bg-fill-hover outline-1 -outline-offset-1 outline-stroke-strong";
const BOARD_EDGE =
  "bg-inverse-bg outline-1 -outline-offset-1 outline-inverse-stroke";

type Mode = "hover" | "cursor";

const MODES: { id: Mode; label: string }[] = [
  { id: "hover", label: "Hover" },
  { id: "cursor", label: "Cursor" },
];

export default function BookOpening() {
  const [mode, setMode] = useState<Mode>("hover");
  const [intent, setIntent] = useState(false);

  const stage = useRef<HTMLDivElement>(null);
  const readout = useRef<HTMLSpanElement>(null);

  /*
   * The animation, in refs. `open` is where the book is, `target` is where it
   * has been asked to be, and neither belongs in a render: the only thing that
   * changes per frame is one custom property and one string of text, and both
   * are written straight to the DOM. Nothing in this component renders while the
   * book is moving.
   */
  const open = useRef(0);
  const target = useRef(0);
  const frame = useRef(0);
  const at = useRef(0);

  /** what the reach's label currently claims */
  const said = useRef(false);

  const reduced = useReducedMotion();

  const write = useCallback((value: number) => {
    stage.current?.style.setProperty("--book-open", value.toFixed(4));
    if (readout.current) readout.current.textContent = value.toFixed(3);
  }, []);

  /*
   * One frame. Named, because it hands itself to the next
   * `requestAnimationFrame`.
   *
   * Reduced motion takes the whole gap in one step. The book still opens, which
   * is the demo, it just does not travel: the same line `stamp-collection` draws
   * between a sequence, which is choreography, and its destination, which is
   * content.
   */
  const tick = useCallback(
    function tick(now: number) {
      const dt =
        at.current === 0
          ? FIRST_STEP
          : Math.min((now - at.current) / 1000, MAX_STEP);
      at.current = now;

      const to = target.current;
      const step = reduced
        ? 1
        : approach(to > open.current ? TAU.open : TAU.shut, dt);

      open.current = lerp(open.current, to, step);
      if (Math.abs(to - open.current) < EPSILON) open.current = to;

      write(open.current);
      frame.current = open.current === to ? 0 : requestAnimationFrame(tick);
    },
    [reduced, write],
  );

  /** point the book at a value, and make sure a frame is coming */
  const aim = useCallback(
    (to: number) => {
      target.current = to;

      // the label is discrete where the book is not, so it is only touched on
      // the crossing rather than on every sample of a pointer
      const claim = to > 0.5;
      if (said.current !== claim) {
        said.current = claim;
        setIntent(claim);
      }

      /*
       * Cancel and reschedule, rather than bailing out when a frame is already
       * pending.
       *
       * **The handle is for cancelling and is never a flag saying the loop is
       * alive.** Skipping the request while a handle is set assumes every frame
       * that was scheduled arrives, and one that does not then leaves a target
       * nothing will ever read: the book stops where it is and every later
       * gesture is inert, since each one does nothing but write that target. A
       * browser producing frames on demand rather than on a clock is enough to
       * do it. Measured in headless Chrome, which is one: between input bursts
       * the loop stops being called and the book rests a frame or two short, at
       * 0.998 rather than 1.
       *
       * The clock only restarts when the loop was idle. Resetting it on every
       * call would hand each frame of a pointer drag the same assumed step and
       * take the refresh rate back out of the maths, which is the whole point of
       * `approach`.
       */
      if (!frame.current) at.current = 0;
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(tick);
    },
    [tick],
  );

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  /**
   * Cursor mode: the pointer's distance left of the shut book's fore-edge, in
   * book widths.
   *
   * Read off the stage's own rect per move, the same call `stamp-collection`
   * makes. Nothing here invalidates layout, so the read is cheap, and a cached
   * rect would be one more thing to keep true across a resize.
   */
  const pull = (event: React.PointerEvent<HTMLDivElement>) => {
    if (mode !== "cursor") return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    aim(clamp01((FORE_EDGE - x) / (BOOK_WIDTH * PULL)));
  };

  /*
   * Hover is a mouse gesture, gated on the event's own `pointerType` rather than
   * on a `(hover: hover)` query, which answers for the device and reports true
   * for a laptop with a touchscreen. A tap fires enter, click and leave inside
   * about 60ms, so ungated it would open the book and shut it again in one
   * touch. The same call `tab-overview` makes.
   */
  const hover = (event: React.PointerEvent, to: number) => {
    if (mode !== "hover" || event.pointerType === "touch") return;
    aim(to);
  };

  /** the other way in: whichever end of the interpolation the book is not at */
  const toggle = () => aim(target.current > 0.5 ? 0 : 1);

  return (
    <div
      ref={stage}
      onPointerMove={pull}
      onPointerDown={pull}
      /*
       * A pointer that has left is a book with nothing asking it to be open, in
       * either mode.
       *
       * **A finger is the exception, and this was a bug.** A touch pointer stops
       * existing when it lifts, so it fires `pointerleave` then rather than on
       * going anywhere at all, and that leave lands after the `pointerup` the
       * tap is heard on. Ungated, a tap opened the book and shut it again inside
       * one gesture, and a pull could never leave it open, since letting go read
       * as leaving. Measured before the gate: a drag to full open fell back to 0
       * the moment the finger came off.
       */
      onPointerLeave={(event) => {
        if (event.pointerType === "touch") return;
        aim(0);
      }}
      className="relative w-full select-none overflow-hidden rounded-lg bg-fill-active [perspective:1400px]"
      style={{
        aspectRatio: STAGE_ASPECT,
        backgroundImage: GROUND,
        // a horizontal drag is ours and a vertical one is the page's, or the
        // demo eats a phone's scroll
        touchAction: mode === "cursor" ? "pan-y" : undefined,
      }}
    >
      {/* what the book casts. Centred on the stage in both states, since the
          drift above is exactly what keeps it there, so only its width moves. */}
      <div
        aria-hidden="true"
        className="absolute top-[70%] left-1/2 h-[9%] -translate-x-1/2 rounded-full bg-inverse-bg/20 blur-lg"
        style={{ width: FLOOR_WIDTH }}
      />

      {/* The book. Decoration: the reach below carries the label, and a sheet
          under the pointer must not be able to answer it. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute transform-3d"
        style={{
          left: BOOK_LEFT,
          top: BOOK_TOP,
          width: pct(BOOK_WIDTH),
          height: pct(BOOK_HEIGHT),
          transform: TILT,
        }}
      >
        {SHEETS.map((sheet) => {
          /* The cast is because `CSSProperties` has no index signature for
             custom properties. */
          const turn = {
            transform: SHEET_TURN,
            "--sheet-angle": `${sheet.angle}deg`,
            "--sheet-z": `${sheet.depth}px`,
          } as React.CSSProperties;

          if (sheet.kind === "leaf") {
            return (
              <div
                key={sheet.id}
                className={cn(LEAF, PAPER_EDGE, "origin-left")}
                style={{
                  ...turn,
                  boxShadow: LEAF_LIFT,
                  backgroundImage: PAPER_LIGHT,
                }}
              >
                <Rules />
              </div>
            );
          }

          const front = sheet.kind === "front";

          return (
            <div
              key={sheet.id}
              className={cn(BOARD, "origin-left")}
              style={{ ...turn, boxShadow: BOARD_LIFT }}
            >
              {front ? <Cover /> : <Endpaper mark="b" />}
              {front ? <Endpaper back mark="a" /> : <Board back />}
            </div>
          );
        })}
      </div>

      {/*
       * The reach. A real button, so a finger and a keyboard have a way in:
       * hover is the gesture this demo is about and it is also the one gesture a
       * phone cannot make.
       *
       * **A tap is heard on `pointerup` and a key press on `click`, which is
       * two handlers for what looks like one thing.** A click is the obvious
       * place for both and it does not hold: the click a browser synthesizes
       * after a tap is a compatibility event, it arrives after the whole
       * pointer sequence including the leave, and React did not dispatch it at
       * all on any tap after the first one here. A `pointerup` carrying
       * `pointerType` is the tap itself. A keyboard activation has no pointer
       * type to read and is the one press that arrives only as a click, where
       * `detail` of 0 is what says no pointer was involved.
       *
       * A mouse does nothing in either mode. The pointer is already saying what
       * it wants, and a toggle under it would fight whichever mode is running.
       */}
      <button
        type="button"
        aria-expanded={intent}
        aria-label={intent ? "Close the book" : "Open the book"}
        onPointerEnter={(event) => hover(event, 1)}
        onPointerLeave={(event) => hover(event, 0)}
        onPointerUp={(event) => {
          if (event.pointerType !== "touch" || mode !== "hover") return;
          toggle();
        }}
        onClick={(event) => {
          if (event.detail !== 0) return;
          toggle();
        }}
        className={cn(
          "absolute top-1/2 -translate-y-1/2 cursor-pointer rounded-md",
          FOCUS,
        )}
        style={{ left: REACH_LEFT, width: REACH_WIDTH, height: REACH_HEIGHT }}
      />

      {/*
       * Which input the book answers to. Two labelled pills, so neither needs a
       * tooltip, and the selected one is a background step, since nothing on
       * this site scales on press.
       *
       * White on the stage's own grey, which is the one place a pill can go here:
       * `bg-fill` is the table.
       */}
      <div className="absolute top-3 right-3 flex items-center gap-0.5 rounded-full bg-bg p-0.5 ring-1 ring-stroke ring-inset">
        {MODES.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            aria-pressed={mode === id}
            onClick={() => {
              setMode(id);
              // the other mode's input is gone, so nothing is asking for the
              // book to be open any more
              aim(0);
            }}
            className={cn(
              "cursor-pointer rounded-full px-2.5 py-1 text-meta transition-colors duration-200",
              mode === id
                ? "bg-fill-active text-text-primary"
                : "text-text-muted hover:bg-fill-hover hover:text-text-primary",
              FOCUS,
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* The number the whole demo is. Written straight to the node, so it costs
          no render, and it is the only thing on the stage saying that hover and
          cursor are two ways of driving one value. */}
      <p className="pointer-events-none absolute bottom-3 left-4 flex items-center gap-1.5 font-mono text-meta text-text-muted tabular-nums">
        <span>t</span>
        <span ref={readout}>0.000</span>
      </p>
    </div>
  );
}

/**
 * A page's ruled lines, inset from the sheet's own edge.
 *
 * The block is a proportion of the sheet rather than a step on the spacing
 * scale, so it holds whatever the stage is, and the tile height is what sets how
 * many rules there are.
 */
function Rules() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-[11%] top-[13%] bottom-[13%]"
      style={{ backgroundImage: RULES, backgroundSize: "100% 11%" }}
    />
  );
}

/**
 * The board, cloth over card. `back` is the one nothing ever sees, on the
 * outside of the book's own back cover, and it is painted because the sheet is
 * two sided whether or not both sides come round.
 */
function Board({ back }: { back?: boolean }) {
  return (
    <span
      className={cn(FACE, BOARD_EDGE, back && "[transform:rotateY(180deg)]")}
      style={{ backgroundImage: BOARD_LIGHT }}
    >
      <span
        className={cn(GRAIN_LAYER, "opacity-[0.2] mix-blend-overlay")}
        style={{ backgroundImage: GRAIN }}
      />
    </span>
  );
}

/**
 * The front board's outside, and the only thing on screen when the book is shut.
 *
 * Sized in `cqw` against the face, which is the query container, never against
 * itself: an element is a container for its descendants only, which is the trap
 * `document-pocket` documents at length. There is no token for any of these,
 * since they are proportions of a cover rather than steps on the type scale.
 */
function Cover() {
  return (
    <span
      className={cn(FACE, BOARD_EDGE)}
      style={{ backgroundImage: BOARD_LIGHT }}
    >
      <span
        className={cn(GRAIN_LAYER, "opacity-[0.2] mix-blend-overlay")}
        style={{ backgroundImage: GRAIN }}
      />
      <span className="relative flex size-full flex-col items-center justify-center gap-[5cqw] p-[10cqw]">
        <span className="text-[14cqw] leading-none text-inverse-text">
          Lerp
        </span>
        <span className="h-px w-[24cqw] bg-inverse-text/20" />
        <code className="font-mono text-[6cqw] leading-none text-inverse-text-secondary">
          a * (1 - t) + b * t
        </code>
      </span>
    </span>
  );
}

/**
 * A board's inside: paper pasted to the card, the way a bound book covers its
 * own boards.
 *
 * **It carries one end of the interpolation, against the fore-edge, which is the
 * only part of a sheet its neighbour does not cover.** Spacing the fore-edges
 * rather than the angles is what makes that strip wide enough to print on and
 * makes both of them wide enough to be the same strip twice: measured at full
 * open, 18.9px of the back board's pastedown shows and 25.6px of the front
 * board's, on a 153px sheet, and every strip between them lands inside 19 to 27.
 * On an even spread of angles the two ends were a few pixels and about eleven, so
 * a letter set on both was legible on one.
 *
 * **A back face's own left is the sheet's right**, since the face is turned about
 * its own centre. So `a` and `b` sit on opposite sides of one rule and land on
 * the same edge of the book.
 */
function Endpaper({ back, mark }: { back?: boolean; mark: string }) {
  return (
    <span
      className={cn(
        FACE,
        PASTEDOWN_EDGE,
        back && "[transform:rotateY(180deg)]",
      )}
      style={{ backgroundImage: PAPER_LIGHT }}
    >
      <Rules />
      <code
        className={cn(
          "absolute top-1/2 -translate-y-1/2 font-mono text-[7cqw] leading-none text-text-muted",
          back ? "left-[3cqw]" : "right-[3cqw]",
        )}
      >
        {mark}
      </code>
    </span>
  );
}
