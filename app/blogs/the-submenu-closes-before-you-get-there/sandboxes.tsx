"use client";

import {
  ArrowRightIcon,
  CaretRightIcon,
  CheckCircleIcon,
  CheckIcon,
  CircleIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import { motion } from "motion/react";
import { useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  BLOCK_H,
  BLOCK_W,
  CHILDREN,
  type Grace,
  graceFrom,
  ITEMS,
  inGrace,
  inRect,
  MENU_H,
  MENU_W,
  PAD,
  PARENT,
  type Point,
  type Rect,
  ROW_H,
  rowAt,
  SUB_H,
  SUB_X,
  SUB_Y,
  TARGET,
} from "./menu";

/**
 * Two menus, one question.
 *
 * The reader tries the same move in both, says which one let them, and only then
 * is told what the difference was. That is the whole piece: no steps, no replay,
 * no narration. A side by side is the shortest path from "I have felt this" to
 * "here is what fixes it", and it needs no prose at all to work.
 *
 * **It breaks the column on purpose.** Two menus at 288px each will not sit next
 * to each other inside a 537px measure, and stacking them is not a comparison.
 * The escape is the standard one: half the parent's width to the left, then
 * pulled back by half its own. `100vw` would include the scrollbar and cause a
 * horizontal one of its own, so the width subtracts a gutter first.
 */

const ANSWERS = [
  { id: "left", label: "Only the left one" },
  { id: "right", label: "Only the right one" },
  { id: "both", label: "Both" },
  { id: "neither", label: "Neither" },
] as const;

type Answer = (typeof ANSWERS)[number]["id"];

/**
 * The true answer, which the card grades against.
 *
 * **The correct row is marked with weight and the wrong one with `danger`,
 * because this site has one status tone and it means "this is wrong".** There
 * is deliberately no success green to reach for, and inventing one for a single
 * quiz would put a colour in the token table that nothing else on the site can
 * use. In a monochrome set the emphatic neutral already reads as "this is the
 * one": a filled row, primary type, a solid check.
 */
const CORRECT: Answer = "right";

export default function Sandboxes() {
  const [choice, setChoice] = useState<Answer | null>(null);
  const [sent, setSent] = useState(false);
  const name = useId();

  return (
    <div className="my-8 flex flex-col gap-5">
      {/*
       * The task, and the loudest thing before the boxes.
       *
       * It was `text-body text-text-secondary`, a step quieter than the prose
       * around it, so the one instruction the reader has to follow was the least
       * prominent sentence on the page.
       *
       * **The fix is tone and structure, not size.** It stays on `text-body`,
       * the size every other paragraph here is: the type scale is the site's and
       * one component does not get to grow out of it. What ranks it instead is
       * `text-primary` against the prose's `text-secondary`, an eyebrow marking
       * it as an instruction rather than another paragraph. One sentence rather
       * than a sentence and a caption, since the constraint is what makes the
       * move the move: a reader who stops or goes sideways has not done a
       * different amount of the task, they have done a different task.
       */}
      <div className="flex flex-col gap-2">
        <p className="font-mono text-meta text-text-muted">try this</p>
        <p className="text-body text-text-primary text-pretty">
          Open <Row>Move to</Row> in both boxes, then take one diagonal straight
          at <Row>Trash</Row>. Do not stop on the way and do not go sideways
          first.
        </p>
      </div>

      {/*
       * **Only the boxes break the column.** Everything else here is prose and
       * belongs on the same measure as the rest of the post: running the
       * instruction, the question and the options at 46rem while every
       * paragraph around them sits at 33.6rem puts two measures on one page,
       * and nothing lines up with anything.
       *
       * The escape is the usual one, half the parent to the left and then back
       * by half of its own width. `100vw` would count the scrollbar and cause a
       * horizontal one, so the width takes a gutter off first.
       */}
      <div className="relative left-1/2 w-[min(100vw-2rem,46rem)] -translate-x-1/2">
        <div className="grid justify-items-center gap-4 sm:grid-cols-2">
          <Sandbox label="left" reveal={sent} />
          <Sandbox label="right" fixed reveal={sent} />
        </div>
      </div>

      {/*
       * The question. Radios rather than a select, because four options that
       * all fit on one line should not be hidden behind a click, and pills
       * rather than the native control, because a native radio cannot be given
       * a hit target worth pressing.
       *
       * The inputs are real and visually hidden, so the group keeps its arrow
       * keys and its screen reader announcement, and the pill is a `<label>`
       * pointing at one. A `div` with `role="radio"` is the version that has to
       * rebuild all of that by hand.
       */}
      {/*
       * The question, as a card.
       *
       * It was a heading, a row of chips and a button, all loose on the page
       * background with a hairline above them. Nothing said those three things
       * were one thing, and horizontal chips read as filters rather than as
       * answers: they are ragged, since "both" and "only the right one" are
       * nowhere near the same width, and there is no column for the eye to run
       * down. Every question anyone has answered on a screen is a stack of
       * full-width rows inside a boundary, with the action in a footer.
       *
       * No border on the `fieldset` itself. A legend is laid out inside its
       * fieldset's top border, so the border paints only to the right of the
       * text and looks like a rule someone abandoned. The card is the boundary.
       */}
      <fieldset className="min-w-0 rounded-lg ring-1 ring-stroke ring-inset">
        <div className="flex flex-col gap-4 p-5">
          <legend className="text-body text-text-primary">
            Which one let you reach Trash?
          </legend>

          <div className="flex flex-col gap-1">
            {ANSWERS.map((answer) => {
              const on = choice === answer.id;
              const right = sent && answer.id === CORRECT;
              const wrong = sent && on && answer.id !== CORRECT;
              const Mark = wrong
                ? XCircleIcon
                : right || on
                  ? CheckCircleIcon
                  : CircleIcon;

              return (
                <label
                  key={answer.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2.5 text-action transition-colors duration-200",
                    "focus-within:outline-none focus-within:ring-2 focus-within:ring-text-primary/15 focus-within:ring-inset",
                    sent && "cursor-default",
                    right && "bg-fill-active text-text-primary",
                    wrong && "bg-danger/8 text-danger",
                    /* answered, and neither the answer nor your mistake */
                    sent && !right && !wrong && "text-text-muted",
                    !sent &&
                      (on
                        ? "bg-fill-active text-text-primary"
                        : "text-text-secondary hover:bg-fill hover:text-text-primary"),
                  )}
                >
                  {/*
                   * A real radio, visually hidden. The group keeps its arrow
                   * keys and its announcement, and the row is a `<label>`
                   * pointing at one. A `div` with `role="radio"` has to rebuild
                   * both by hand and usually rebuilds neither.
                   */}
                  <input
                    type="radio"
                    name={name}
                    value={answer.id}
                    checked={on}
                    disabled={sent}
                    onChange={() => setChoice(answer.id)}
                    className="sr-only"
                  />
                  <Mark
                    aria-hidden="true"
                    weight={wrong || right || on ? "fill" : "regular"}
                    className={cn(
                      "size-4 shrink-0",
                      wrong
                        ? "text-danger"
                        : right || on
                          ? "text-text-primary"
                          : "text-text-muted",
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {answer.label}
                  </span>
                  {/* which row is which, in words, since the fill alone cannot
                      say "this is the answer" and "this is what you picked" */}
                  {right ? <Tag>correct</Tag> : null}
                  {wrong ? <Tag danger>your answer</Tag> : null}
                </label>
              );
            })}
          </div>
        </div>

        {/* the footer: the action, or what the action revealed */}
        <div className="border-stroke border-t p-5">
          {sent ? (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="text-meta text-text-secondary"
            >
              <span
                className={cn(
                  choice === CORRECT ? "text-text-primary" : "text-danger",
                )}
              >
                {choice === CORRECT ? "That is it." : "Not quite."}
              </span>{" "}
              The right one ignores every hover inside that wedge. The rows your
              cursor crossed were real hovers, they just stopped counting while
              you were on your way somewhere.
            </motion.p>
          ) : (
            <button
              type="button"
              disabled={choice === null}
              onClick={() => setSent(true)}
              className={cn(
                "flex h-9 items-center gap-1.5 rounded-full px-4 text-action transition-colors duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2",
                /*
                 * Quiet until there is an answer to send. A black pill at 50%
                 * opacity is a solid mid-grey, which made the one control that
                 * does nothing the heaviest thing in the block.
                 */
                choice === null
                  ? "cursor-not-allowed bg-fill text-text-muted"
                  : "cursor-pointer bg-text-primary text-bg hover:bg-text-primary/85 active:bg-text-primary/70",
              )}
            >
              Show which is which
              <ArrowRightIcon
                aria-hidden="true"
                className="size-3.5 shrink-0"
              />
            </button>
          )}
        </div>
      </fieldset>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
 * REPLAY STORYBOARD
 *
 * A loop, not an interaction. Nothing here answers a pointer.
 *
 *     0ms   the cursor sits on Move to
 *     0ms   it starts travelling, straight at Trash
 *  1500ms   it arrives
 *  2400ms   it cuts back to the start and goes again
 * ───────────────────────────────────────────────────────── */

const SIM = {
  travel: 1.5, // seconds crossing the diagonal
  hold: 0.9, // seconds parked on Trash before it loops
  cursor: 15, // px tall, which is about a real one
};

/*
 * The path, in the block's own coordinates, from the constants that lay the
 * menus out. Nothing is measured and nothing is recorded: this is the move the
 * post has been describing, drawn once so it can be watched instead of tried.
 */
const FROM = { x: MENU_W / 2, y: PAD + PARENT * ROW_H + ROW_H / 2 };
const TO = {
  x: SUB_X + MENU_W / 2,
  y: SUB_Y + PAD + (CHILDREN.length - 1) * ROW_H + ROW_H / 2,
};

/**
 * Where that path leaves the parent row, which is the wedge's apex.
 *
 * Worked out rather than eyeballed: the row's bottom edge is a horizontal line,
 * so the crossing is one interpolation along the path. Eyeballing it puts the
 * apex a few pixels off the row and the whole wedge tells a small lie.
 */
const EXIT_T = (PAD + (PARENT + 1) * ROW_H - FROM.y) / (TO.y - FROM.y);
const EXIT = {
  x: FROM.x + (TO.x - FROM.x) * EXIT_T,
  y: PAD + (PARENT + 1) * ROW_H,
};

/**
 * The same menu with nobody driving it, on a loop.
 *
 * The post ends on the geometry, and geometry is easier to watch than to read
 * about. This is the move it has been describing: one slanted run at the last
 * row, with the area that keeps the submenu open shaded underneath it.
 *
 * It is deliberately not the interactive one with a flag. That component is all
 * hit testing and state, none of which a loop needs, and threading a "pretend"
 * mode through it would mean every branch in there growing a second meaning.
 */
export function Replay() {
  const wedge = graceFrom(EXIT, {
    x: SUB_X,
    y: SUB_Y,
    w: MENU_W,
    h: SUB_H,
  });

  return (
    <div className="my-8 flex flex-col items-center gap-3">
      <div className="w-fit select-none rounded-lg bg-fill p-5 ring-1 ring-stroke ring-inset">
        <div style={{ width: BLOCK_W, height: BLOCK_H }} className="relative">
          <div
            style={{ width: MENU_W, height: MENU_H }}
            className="absolute top-0 left-0"
          >
            <Menu
              items={ITEMS.map((i) => i.label)}
              on={PARENT}
              caret={PARENT}
            />
          </div>

          <div
            style={{ left: SUB_X, top: SUB_Y, width: MENU_W, height: SUB_H }}
            className="absolute"
          >
            <Menu items={CHILDREN} on={CHILDREN.length - 1} />
          </div>

          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 size-full"
          >
            <polygon
              points={`${wedge.from.x},${wedge.from.y} ${wedge.top.x},${wedge.top.y} ${wedge.bottom.x},${wedge.bottom.y}`}
              strokeWidth={1}
              className="fill-text-primary/8 stroke-text-primary/25"
            />
            <line
              x1={FROM.x}
              y1={FROM.y}
              x2={TO.x}
              y2={TO.y}
              strokeWidth={1}
              strokeDasharray="3 3"
              className="stroke-text-primary/30"
            />
          </svg>

          {/*
           * The cursor. A real arrow rather than a dot, because a dot travelling
           * across a menu reads as a loading spinner going somewhere and an
           * arrow reads as a hand.
           */}
          <motion.svg
            aria-hidden="true"
            viewBox="0 0 11 17"
            style={{ width: (SIM.cursor * 11) / 17, height: SIM.cursor }}
            className="absolute top-0 left-0"
            initial={{ x: FROM.x, y: FROM.y }}
            animate={{ x: [FROM.x, TO.x], y: [FROM.y, TO.y] }}
            transition={{
              duration: SIM.travel,
              repeat: Number.POSITIVE_INFINITY,
              repeatDelay: SIM.hold,
              ease: "easeInOut",
            }}
          >
            <path
              d="M0.5,0.5 L0.5,13 L3.6,10 L5.8,15.6 L7.7,14.8 L5.6,9.4 L9.8,9.2 Z"
              className="fill-text-primary stroke-bg"
              strokeWidth={1}
            />
          </motion.svg>
        </div>
      </div>

      <p className="text-meta text-text-muted">
        the shaded wedge is everywhere the cursor can be and still count as
        heading for the second menu
      </p>
    </div>
  );
}

/** the verdict on one row, at the end of it */
function Tag({ children, danger }: { children: string; danger?: boolean }) {
  return (
    <span
      className={cn(
        "shrink-0 text-meta",
        danger ? "text-danger" : "text-text-muted",
      )}
    >
      {children}
    </span>
  );
}

/** a row name in prose, so the reader can match the word to the thing */
function Row({ children }: { children: string }) {
  return (
    <span className="rounded-md bg-fill-active px-1.5 py-0.5 text-text-primary">
      {children}
    </span>
  );
}

/**
 * One menu, and either the fix or not.
 *
 * **Every hit test happens in one `pointermove`**, against rectangles built from
 * the same constants that lay the menus out. Per-row `pointerenter` and
 * `pointerleave` cannot express this: falling out of the wedge while already
 * inside a row fires no event at all, so the menu freezes in a state nothing
 * will correct.
 *
 * There is no state for whether the submenu is open, because that is not a fact
 * of its own. It is what a highlighted parent row means.
 */
function Sandbox({
  label,
  fixed = false,
  reveal,
}: {
  label: string;
  fixed?: boolean;
  reveal: boolean;
}) {
  const stage = useRef<HTMLButtonElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const [child, setChild] = useState<number | null>(null);
  const [grace, setGrace] = useState<Grace | null>(null);

  /**
   * The previous sample. **The wedge may only be armed on the sample that leaves
   * the row.** Arming it on any sample outside the row re-anchors it to the
   * pointer every time, so it never expires and moving straight down to a lower
   * row cannot close the submenu at all.
   *
   * The apex is the last point known to be inside the row rather than the first
   * known to be outside it, since a fast diagonal samples a row or more apart.
   */
  const last = useRef<{ at: Point; row: number | null } | null>(null);

  const open = active === PARENT;

  const rects = (w: number, h: number) => {
    const x = (w - BLOCK_W) / 2;
    const y = (h - BLOCK_H) / 2;
    return {
      menu: { x, y, w: MENU_W, h: MENU_H } satisfies Rect,
      sub: { x: x + SUB_X, y: y + SUB_Y, w: MENU_W, h: SUB_H } satisfies Rect,
    };
  };

  const local = (clientX: number, clientY: number) => {
    const el = stage.current;
    if (!el) return null;
    const box = el.getBoundingClientRect();
    return {
      at: { x: clientX - box.left, y: clientY - box.top },
      ...rects(box.width, box.height),
    };
  };

  const sample = (clientX: number, clientY: number) => {
    const hit = local(clientX, clientY);
    if (!hit) return;
    const { at, menu, sub } = hit;
    const row = rowAt(at, menu, ITEMS.length);
    const prev = last.current;
    last.current = { at, row };
    const leaving = prev?.row === PARENT && row !== PARENT;

    if (open && inRect(at, sub)) {
      setChild(rowAt(at, sub, CHILDREN.length));
      if (grace) setGrace(null);
      return;
    }
    setChild(null);

    /* the wedge short circuits everything, which is the entire fix */
    if (fixed && grace) {
      if (inGrace(at, grace)) return;
      setGrace(null);
    }

    if (row === active) return;

    if (fixed && open && leaving && prev) {
      setGrace(graceFrom(prev.at, sub));
      return;
    }

    setActive(row);
  };

  const keys = (event: React.KeyboardEvent) => {
    const end = CHILDREN.length - 1;
    const move =
      event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;

    if (move !== 0) {
      event.preventDefault();
      if (child !== null) {
        setChild(Math.min(Math.max(child + move, 0), end));
        return;
      }
      setActive(Math.min(Math.max((active ?? -1) + move, 0), ITEMS.length - 1));
      return;
    }
    if (event.key === "ArrowRight" && open && child === null) {
      event.preventDefault();
      setChild(0);
      return;
    }
    if (event.key === "ArrowLeft" && child !== null) {
      event.preventDefault();
      setChild(null);
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <button
        ref={stage}
        type="button"
        aria-label={`${label} menu. Arrow keys move, right opens the submenu, enter picks.`}
        onKeyDown={keys}
        onPointerMove={(event) => {
          if (event.pointerType === "touch") return;
          sample(event.clientX, event.clientY);
        }}
        onPointerDown={(event) => {
          /* a phone has no hover, so a tap both aims and opens */
          if (event.pointerType !== "touch") return;
          sample(event.clientX, event.clientY);
        }}
        onPointerLeave={() => {
          last.current = null;
          setActive(null);
          setChild(null);
          setGrace(null);
        }}
        onClick={(event) => {
          if (event.detail === 0) {
            return;
          }
          const hit = local(event.clientX, event.clientY);
          if (!hit || !open) return;
          if (rowAt(hit.at, hit.sub, CHILDREN.length) !== TARGET) return;
          setChild(TARGET);
        }}
        className={cn(
          /* `select-none`: dragging across the menu is the gesture the whole
             piece is about, and without this it paints a text selection over
             every row on the way past */
          "relative block w-fit cursor-default select-none overflow-hidden rounded-lg bg-fill p-5 text-left ring-1 ring-stroke ring-inset",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/20",
        )}
      >
        <div style={{ width: BLOCK_W, height: BLOCK_H }} className="relative">
          {/*
           * The submenu's seat, drawn while it is empty.
           *
           * The block reserves the submenu's width whether or not it is open, so
           * nothing moves when one appears. The cost was that two thirds of a
           * closed box was grey nothing and the menu looked shoved into a
           * corner. A dashed outline turns the reserve into a signpost: this is
           * where the other menu goes.
           */}
          {open ? null : (
            <div
              aria-hidden="true"
              style={{ left: SUB_X, top: SUB_Y, width: MENU_W, height: SUB_H }}
              className="absolute rounded-md border border-stroke-strong border-dashed"
            />
          )}

          <div
            style={{ width: MENU_W, height: MENU_H }}
            className="absolute top-0 left-0"
          >
            <Menu
              items={ITEMS.map((i) => i.label)}
              on={active}
              caret={PARENT}
            />
          </div>

          {open ? (
            <div
              style={{ left: SUB_X, top: SUB_Y, width: MENU_W, height: SUB_H }}
              className="absolute"
            >
              <Menu items={CHILDREN} on={child} target={TARGET} />
            </div>
          ) : null}
        </div>

        {/*
         * The wedge stays hidden until the answer is in. Drawing it up front
         * would tell the reader which menu is which before they have tried
         * either, and the whole question is whether they can feel the
         * difference.
         */}
        {reveal && fixed && grace ? (
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 size-full"
          >
            <motion.polygon
              points={`${grace.from.x},${grace.from.y} ${grace.top.x},${grace.top.y} ${grace.bottom.x},${grace.bottom.y}`}
              strokeWidth={1}
              className="fill-text-primary/8 stroke-text-primary/25"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.16 }}
            />
          </svg>
        ) : null}
      </button>

      {/*
       * The caption names the box and, after the answer is in, what was in it.
       *
       * **It used to say "you got there" the moment you clicked Trash, and that
       * had to go.** It answered the question before the question, and it
       * answered it wrong: the left box can be beaten by going sideways first,
       * so a reader who did that saw "you got there" under both boxes and was
       * then told the correct answer was "only the right one". The demo should
       * not be scoring the attempt. The reader's own hands are the evidence.
       */}
      <div className="flex min-h-6 items-center gap-2 text-action">
        <span className="text-text-secondary">{label}</span>
        {reveal ? (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-text-primary"
          >
            {fixed ? "has the fix" : "no fix"}
          </motion.span>
        ) : null}
      </div>
    </div>
  );
}

/**
 * A menu: rows and a highlight.
 *
 * No transition on the highlight. A native menu marks the row under the cursor
 * on the frame it arrives, and anything softer reads as the menu thinking about
 * it, which is the one thing this piece cannot afford to look like.
 *
 * `fill-active` and not `fill`, because the stage ground is `fill` and a
 * highlighted last row in `fill` dissolves into the ground it sits on.
 */
function Menu({
  items,
  on,
  caret,
  target,
}: {
  items: readonly string[];
  on: number | null;
  caret?: number;
  target?: number;
}) {
  return (
    <ul
      style={{ paddingBlock: PAD }}
      /* `overflow-hidden`, or a highlighted first or last row paints its square
         corners past the menu's radius */
      className="absolute inset-0 overflow-hidden rounded-md bg-bg ring-1 ring-stroke ring-inset"
    >
      {items.map((label, index) => (
        <li
          key={label}
          style={{ height: ROW_H }}
          className={cn(
            "flex items-center justify-between gap-2 px-2.5 text-action",
            index === on
              ? "bg-fill-active text-text-primary"
              : "text-text-secondary",
          )}
        >
          <span className="truncate">{label}</span>
          {index === caret ? (
            <CaretRightIcon
              aria-hidden="true"
              className="size-3 shrink-0 text-text-muted"
            />
          ) : null}
          {index === target ? (
            <CheckIcon
              aria-hidden="true"
              className="size-3 shrink-0 text-text-muted"
            />
          ) : null}
        </li>
      ))}
    </ul>
  );
}
