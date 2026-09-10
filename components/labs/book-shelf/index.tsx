"use client";

import { motion, useReducedMotion } from "motion/react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  BOOKS,
  type Book,
  COVER,
  LABEL,
  LAYOUT,
  OVERHANG,
  ROW_WIDTH,
} from "./books";

/*
 * A shelf of books, and one of them comes out to the middle.
 *
 * The point is that the thing arriving in the centre is the same object that
 * was on the shelf, turned. A modal that grows out of a card is two elements
 * and a crossfade between them, and it reads as a card being replaced. A book
 * is a box: the spine is one face of it and the cover is another, so bringing
 * the cover to the reader is a rotation rather than a swap, and nothing has
 * to be faded into anything.
 *
 * Each book is a real box in one shared 3D scene. The spine is the front
 * face, the cover is the right face at `rotateY(90deg) translateZ(t / 2)`,
 * and turning the box by -90 puts the cover square to the reader with the
 * spine falling away to the left, which is where a spine is when a book is
 * held. That the cover lands centred on the box's own middle is what makes
 * the travel a plain translation: the offset to the stage's centre is known
 * from the layout, so nothing is measured.
 *
 * **The scrim is a plane in the same scene, not a layer over it.** A
 * `preserve-3d` context paints by depth and ignores `z-index`, so an overlay
 * put on top with a stacking order would sit behind the shelf regardless. At
 * `translateZ(100px)` it is in front of the shelf and behind the book, which
 * is what a scrim is, and it needs no z-index at all.
 */

/**
 * Cloth grain, inline so the page makes no request for it. A diffuse surface
 * scatters light and grain is what that looks like, which is most of what
 * separates book cloth from a coloured rectangle. `overlay` by its own maths
 * does nothing to black and everything to a mid tone, so it lands where the
 * cloth is lit and stays out of the shadows, which is the right way round.
 * The same call `document-pocket` makes for its pocket.
 */
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E\")";

/** how much frame is kept clear either side of the shelf */
const MARGIN = 70;

/** the stage, and where the shelf's surface sits in it */
const STAGE = 500;
const BASE = 410;
/** where a picked cover comes to rest, and how far out of the shelf it comes */
const CENTRE = 225;
const OUT = 210;
/**
 * How far the scrim floats in front of the shelf. It has to clear the board
 * as well as the spines: the board's front edge stands at half a cover's
 * depth, and anything the scrim does not cover stays lit while everything
 * around it dims, which reads as a hole rather than as a scrim.
 */
const SCRIM = 100;
/**
 * How a book answers a pointer: it tips its head out, which is how a hand
 * takes one off a shelf. Coming forward instead is almost nothing on screen,
 * since at this perspective 18px of depth moves a spine about a pixel and a
 * half, and a probe across all twelve boxes measured no box moving at all.
 *
 * **The tip is the one thing here that is not on the pick's spring.** That
 * spring carries a book across the stage, and 7 degrees on it spends most of
 * its time on the last fraction of a degree, which reads as the shelf being
 * slow rather than as a short move being short. A sharp ease-out front-loads
 * it: most of the angle is there in the first two frames, which is what a
 * pointer arriving wants to see.
 */
const TIP_OUT = 7;

export default function BookShelf() {
  const reduce = useReducedMotion();
  const [picked, setPicked] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const stage = useRef<HTMLDivElement>(null);

  /* a modal closes on Escape, and this is a modal wearing a book */
  useEffect(() => {
    if (!picked) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPicked(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [picked]);

  /*
   * The scene is sized to the frame with a margin held back, so the shelf
   * has air around it rather than running to the edges, and so the row can
   * be sized for the column instead of for the narrowest screen it has to
   * survive. The scale is about the stage's own centre, so the margin it
   * leaves at the sides buys height at the top and bottom as well.
   */
  useEffect(() => {
    const node = stage.current;
    if (!node) return;
    const measure = () => {
      const fit = Math.min(
        1,
        (node.clientWidth - MARGIN * 2) / (ROW_WIDTH + 40),
      );
      node.style.setProperty("--fit", String(fit));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const spring = reduce
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 210, damping: 26 };
  /* the hover's own curve, front-loaded, since it is a short move */
  const snap = reduce
    ? { duration: 0 }
    : { duration: 0.16, ease: [0.16, 1, 0.3, 1] as const };

  return (
    <div
      ref={stage}
      className="relative w-full select-none overflow-hidden rounded-lg ring-1 ring-stroke ring-inset"
      style={{
        height: STAGE,
        /*
         * A wall rather than a white page. Three of the twelve books are
         * bound in cream, and on `bg` they were a hairline and a shadow: the
         * ground has to sit off white for pale cloth to read against it. The
         * pool of light is centred above the shelf, so the row is the
         * brightest thing in the frame and the corners fall away, which is
         * `flip-clock`'s call for its own lit table.
         */
        backgroundColor: "var(--color-surface)",
        backgroundImage:
          "radial-gradient(120% 82% at 50% 26%, var(--color-bg) 0%, var(--color-surface) 46%, var(--color-fill) 100%)",
      }}
    >
      <div
        className="absolute inset-0 transform-3d [perspective:1200px]"
        style={{
          perspectiveOrigin: `50% ${CENTRE}px`,
          /*
           * The scale pulls the shelf toward the stage's own centre, which
           * leaves it sitting high, since the books stand on a board near
           * the foot rather than filling the box. Measured at rest: 93px of
           * frame above the shelf against 134 below, and this evens them.
           */
          transform: "scale(var(--fit, 1)) translateY(-24px)",
        }}
      >
        {/*
         * The board, brought forward to the depth the spines stand at, or the
         * books float in front of the thing they are standing on. Its front
         * edge is the only part of it a reader ever sees.
         */}
        <div
          className="absolute left-1/2"
          style={{
            width: ROW_WIDTH + OVERHANG + 30,
            height: 9,
            top: BASE,
            marginLeft: -(ROW_WIDTH + OVERHANG + 30) / 2,
            transform: `translateZ(${COVER / 2}px)`,
            background: "var(--color-fill-active)",
            boxShadow: "inset 0 1px 0 var(--color-stroke-strong)",
          }}
        />
        {/* what the row casts on the board, which is the only shadow at rest */}
        <div
          className="absolute left-1/2 rounded-full bg-black/15 blur-md"
          style={{
            width: ROW_WIDTH + OVERHANG + 14,
            height: 10,
            top: BASE - 4,
            marginLeft: -(ROW_WIDTH + OVERHANG + 14) / 2,
            transform: `translateZ(${COVER / 2 - 2}px)`,
          }}
        />

        {/* the books */}
        <div
          className="absolute left-1/2 transform-3d"
          style={{
            width: ROW_WIDTH,
            height: BASE,
            top: 0,
            marginLeft: -(ROW_WIDTH + OVERHANG) / 2,
          }}
        >
          {BOOKS.map((book, index) => (
            <Spine
              key={book.id}
              book={book}
              index={index}
              picked={picked}
              hovered={hovered === book.id}
              spring={spring}
              snap={snap}
              onPick={() => setPicked(picked === book.id ? null : book.id)}
              onHover={setHovered}
            />
          ))}
        </div>

        {/*
         * The scrim, at a depth between the shelf and the book.
         *
         * **No `backdrop-filter` on it, and that is not a taste.** With one,
         * Chrome cut the backdrop it captures where the book in front of it
         * sits, and left two seams running the full height of the stage at
         * the cover's own edges. Measured: one-column spikes at 97.5px either
         * side of the centre, which is the cover's 158 magnified by the
         * perspective at the depth it comes out to. The dim does the work
         * instead. It is twice
         * the stage so that perspective cannot uncover a corner of it, and it
         * is a button because it is the other way out of the modal.
         */}
        <motion.button
          type="button"
          aria-label="Put the book back"
          tabIndex={picked ? 0 : -1}
          onClick={() => setPicked(null)}
          className={cn(
            "absolute top-1/2 left-1/2 bg-black/28",
            picked ? "cursor-pointer" : "pointer-events-none",
          )}
          style={{
            width: "200%",
            height: "200%",
            marginLeft: "-100%",
            marginTop: "-100%",
            transform: `translateZ(${SCRIM}px)`,
          }}
          initial={false}
          animate={{ opacity: picked ? 1 : 0 }}
          transition={reduce ? { duration: 0 } : { duration: 0.22 }}
        />
      </div>
    </div>
  );
}

/**
 * One book. Its whole state is three numbers: where it is, how far it has
 * turned, and how far it leans, and every one of them is derived from which
 * book is picked rather than kept anywhere.
 */
function Spine({
  book,
  index,
  picked,
  hovered,
  spring,
  snap,
  onPick,
  onHover,
}: {
  book: Book;
  index: number;
  picked: string | null;
  hovered: boolean;
  spring: object;
  snap: object;
  onPick: () => void;
  onHover: (id: string | null) => void;
}) {
  const left = LAYOUT.left[index];
  const isPicked = picked === book.id;
  const gap = picked ? BOOKS.findIndex((b) => b.id === picked) : -1;

  /*
   * The neighbours lean into the hole. A book only stands up because the
   * books either side of it do, so taking one out and leaving the row
   * perfectly upright is the one thing a shelf never does. It falls off with
   * distance, and the two nearest do nearly all of it.
   */
  const away = gap < 0 ? 0 : index - gap;
  /*
   * The tip is capped and a book that already leans takes none of it. A lean
   * pivots on the corner the book stands on, so it swings its head sideways
   * by its own height times the sine: at this scale ten degrees is 43px,
   * which is two neighbours away, and the row starts crossing itself.
   */
  const tip =
    gap < 0 || isPicked || book.lean !== 0 || Math.abs(away) > 3
      ? 0
      : (away > 0 ? -1 : 1) * (3 / Math.abs(away));

  /* the cover lands in the middle of the stage, which the layout already knows */
  const dx = (ROW_WIDTH + OVERHANG) / 2 - (left + book.thickness / 2);
  const dy = CENTRE - (BASE - book.height / 2);

  return (
    <motion.button
      type="button"
      aria-label={isPicked ? `Put ${book.title} back` : `Open ${book.title}`}
      onClick={onPick}
      onPointerEnter={(event: ReactPointerEvent) => {
        if (event.pointerType !== "touch") onHover(book.id);
      }}
      onPointerLeave={() => onHover(null)}
      className="absolute bottom-0 cursor-pointer transform-3d focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2"
      style={{
        left,
        width: book.thickness,
        height: book.height,
        /*
         * A book pivots on the corner it is standing on, and that corner is
         * at the front of the board rather than through the middle of it.
         * Without the z the tip rotates about the book's centre plane, which
         * swings the foot of the spine backwards and down, and the board it
         * is standing on then covers the bottom of it.
         */
        transformOrigin: `${book.lean > 0 ? "right" : "left"} bottom ${COVER / 2}px`,
      }}
      initial={false}
      animate={{
        x: isPicked ? dx : 0,
        y: isPicked ? dy : 0,
        z: isPicked ? OUT : 0,
        rotateX: !isPicked && hovered ? -TIP_OUT : 0,
        rotateZ: isPicked ? 0 : book.lean + tip,
      }}
      transition={{
        ...spring,
        /*
         * Out of the row, then turn. Back the other way round: turn first
         * and drop into the row last, or the book comes down level with its
         * neighbours while it is still travelling and passes through them.
         */
        z: { ...spring, delay: isPicked ? 0 : 0.16 },
        rotateX: snap,
      }}
    >
      <motion.div
        className="absolute inset-0 transform-3d"
        initial={false}
        animate={{ rotateY: isPicked ? -90 : 0 }}
        transition={{ ...spring, delay: isPicked ? 0.08 : 0 }}
      >
        {/* the spine, which is the face a shelf shows */}
        <div
          className="absolute inset-0 overflow-hidden rounded-[2px] backface-hidden"
          style={{
            background: book.cloth,
            transform: `translateZ(${COVER / 2}px)`,
            boxShadow:
              "inset -1px 0 0 rgb(0 0 0 / 0.3), inset 1px 0 0 rgb(255 255 255 / 0.14)",
          }}
        >
          {/* the round of the spine, which is a light along it, not a fill */}
          <span
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, rgb(0 0 0 / 0.28) 0%, rgb(255 255 255 / 0.16) 26%, rgb(255 255 255 / 0.05) 54%, rgb(0 0 0 / 0.3) 100%)",
            }}
          />
          <Grain />
          {/* the blind rules a binder presses either side of the panel */}
          <span
            className="absolute inset-x-[2px] inset-y-[9%]"
            style={{
              boxShadow:
                "inset 0 1px 0 rgb(0 0 0 / 0.35), inset 0 -1px 0 rgb(255 255 255 / 0.14)",
            }}
          />
          <Bands color={book.band} />
          {book.thickness >= 18 && (
            <span
              className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center font-medium text-[9px] tracking-wide [writing-mode:vertical-rl]"
              style={{
                color: book.ink,
                textShadow: "0 1px 0 rgb(0 0 0 / 0.3)",
              }}
            >
              {book.title}
            </span>
          )}
        </div>

        {/*
         * The page block, on the face opposite the spine. It is edge on
         * once the cover is square to the reader, so it costs nothing
         * there, and it is most of what the book looks like halfway
         * through the turn: without it the book is two boards with nothing
         * between them.
         */}
        <div
          className="absolute top-0 backface-hidden"
          style={{
            width: book.thickness,
            height: book.height,
            left: 0,
            transform: `rotateY(180deg) translateZ(${COVER / 2}px)`,
            background:
              "repeating-linear-gradient(90deg, #efe8d8 0px, #efe8d8 1px, #d8cfba 1px, #d8cfba 2px)",
            boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 0.2)",
          }}
        />

        {/* the cover, the right face of the same box */}
        <div
          className="absolute top-0 overflow-hidden rounded-[2px] backface-hidden"
          style={{
            width: COVER,
            height: book.height,
            left: (book.thickness - COVER) / 2,
            background: book.cloth,
            transform: `rotateY(90deg) translateZ(${book.thickness / 2}px)`,
            /* a box-shadow, never a filter: a filter flattens a 3D context */
            boxShadow: isPicked
              ? "inset 0 0 0 1px rgb(0 0 0 / 0.18), 0 18px 40px rgb(0 0 0 / 0.28), 0 3px 10px rgb(0 0 0 / 0.18)"
              : "inset 0 0 0 1px rgb(0 0 0 / 0.18)",
          }}
        >
          <Cover book={book} />
        </div>
      </motion.div>
    </motion.button>
  );
}

/** the cloth's tooth, over any surface that is meant to be cloth */
function Grain() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 opacity-[0.35] mix-blend-overlay"
      style={{ backgroundImage: GRAIN, backgroundSize: "120px 120px" }}
    />
  );
}

/** the head and tail bands, which is most of what says hardback */
function Bands({ color }: { color: string }) {
  return (
    <>
      <span
        className="absolute inset-x-0 top-[13%] h-[3px]"
        style={{ background: color }}
      />
      <span
        className="absolute inset-x-0 bottom-[13%] h-[3px]"
        style={{ background: color }}
      />
    </>
  );
}

/** the front of the book: a rule, the title, the author, and a pressed mark */
function Cover({ book }: { book: Book }) {
  return (
    <>
      {/* the board's own light, before anything is printed on it */}
      <span
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(118deg, rgb(255 255 255 / 0.14) 0%, transparent 38%, transparent 62%, rgb(0 0 0 / 0.2) 100%)",
        }}
      />
      <Grain />

      {/*
       * The blind border, pressed into the board rather than printed on it,
       * which is a light edge on one side of the line and a dark one on the
       * other. Every bit of depth here is white and black at low alpha over
       * the book's own colour, which is the rule `document-pocket` sets for
       * shading a surface.
       */}
      <span
        className="absolute inset-[9px] rounded-[1px]"
        style={{
          boxShadow:
            "inset 0 1px 0 rgb(0 0 0 / 0.3), inset 1px 0 0 rgb(0 0 0 / 0.24), inset 0 -1px 0 rgb(255 255 255 / 0.16), inset -1px 0 0 rgb(255 255 255 / 0.12)",
        }}
      />

      {/* the label, pasted on, so it sits proud of the cloth and casts */}
      <div
        className="absolute inset-x-[22px] top-[19%] rounded-[2px] px-3 py-3"
        style={{
          background: LABEL.paper,
          boxShadow:
            "0 2px 5px rgb(0 0 0 / 0.32), inset 0 0 0 1px rgb(0 0 0 / 0.12)",
        }}
      >
        <span
          className="mb-2 block h-[2px] w-8"
          style={{ background: book.band }}
        />
        <p
          className="font-medium text-[15px] leading-tight"
          style={{ color: LABEL.ink }}
        >
          {book.title}
        </p>
        <p
          className="mt-1 text-[10px]"
          style={{ color: LABEL.ink, opacity: 0.6 }}
        >
          {book.author}
        </p>
      </div>

      {/* the stamp at the foot, pressed rather than printed */}
      <span
        className="absolute bottom-5 left-6 size-5 rounded-full"
        style={{
          boxShadow: `inset 0 0 0 1px ${book.band}, inset 0 1px 0 rgb(0 0 0 / 0.25)`,
        }}
      />
    </>
  );
}
