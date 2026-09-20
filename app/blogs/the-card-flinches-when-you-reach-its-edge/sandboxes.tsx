"use client";

import {
  ArrowRightIcon,
  CheckCircleIcon,
  CheckIcon,
  CircleIcon,
  CursorIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "motion/react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Two cards, one question.
 *
 * The reader takes the same move to the edge of both, says which one held it,
 * and only then is told what the difference was. `the-submenu-closes-before-
 * you-get-there` is the same build, and for the same reason: a side by side is
 * the shortest path from "I have felt this" to "here is what fixes it".
 *
 * **The one thing under test is where the hit target lives.** Both cards read
 * the pointer against the untransformed slot, so the tilt they compute is
 * identical, and the only difference is whether the `<button>` is a child of
 * the tilted card or a sibling of it. Anything else differing would make the
 * comparison say nothing.
 *
 * **It breaks the column on purpose**, by half the parent to the left and back
 * by half its own width, with a gutter taken off `100vw` so the escape cannot
 * cause a horizontal scrollbar of its own.
 */

/** The stage and the card inside it, in px. Nothing here is measured. */
const STAGE = { w: 316, h: 208 };
const CARD = { w: 268, h: 160 };

/**
 * Degrees at the far edge, and the perspective the tilt is seen through.
 *
 * **Both are turned up past what a real card would use, and that is the
 * demo exaggerating a mechanism so it can be aimed at.** A card at a sane 12
 * degrees pulls its near edge 6.8px in, and a strip only 6.8px wide is not a
 * target a reader can hold: measured, a hand aiming at the middle of a 16px
 * strip sat 8px in, which is 1.2px inside the card, and filled the bar on the
 * broken one. At 20 degrees through 700 the pull is 15.8px, so the whole strip
 * is past the edge with 3.8px to spare and the failure is something a reader
 * meets rather than hunts for.
 *
 * The eight pixels the post quotes is the real card in `foil-card`, measured on
 * a 420px card at 8.94 degrees, and it is a claim about tilt cards rather than
 * about this drawing.
 */
const TILT = 20;
const PERSPECTIVE = 700;

/** A card has mass, so it arrives with a little overshoot. */
const SPRING = { stiffness: 220, damping: 20 };

/**
 * The strip the reader is asked to hold, in px, and how long for.
 *
 * **The task is what makes the bug findable.** Told in prose to go to the edge,
 * a reader waves at the middle of the card, watches it tilt nicely and learns
 * nothing: the failure lives in about eight pixels at the rim and nothing was
 * pointing at them. A marked strip is somewhere to aim, and a bar that only
 * fills while the pointer is inside it turns "did you feel a flicker" into "can
 * you finish this", which is a question a reader cannot answer wrongly by
 * accident.
 *
 * 12px, and every pixel of it is past where the tilted card's edge lands, so
 * there is no part of the target that quietly works. The strip belongs to the
 * footprint and never to the card, since it marks a place on the screen rather
 * than a place on the object, and watching the card's own edge slide in behind
 * it is the bug drawn rather than described.
 */
const STRIP = 12;
const HOLD = 1200;

const ANSWERS = [
  { id: "left", label: "Only the left one" },
  { id: "right", label: "Only the right one" },
  { id: "both", label: "Both" },
  { id: "neither", label: "Neither" },
] as const;

type Answer = (typeof ANSWERS)[number]["id"];

/**
 * The true answer, graded with weight and `danger` rather than with a green.
 * The site ships one status tone and it means wrong, so the correct row takes
 * the emphatic neutral, which in a monochrome set already reads as "this one".
 */
const CORRECT: Answer = "right";

export default function Sandboxes() {
  const [choice, setChoice] = useState<Answer | null>(null);
  const [sent, setSent] = useState(false);
  const name = useId();

  return (
    <div className="my-8 flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <p className="font-mono text-meta text-text-muted">try this</p>
        <p className="text-pretty text-body text-text-primary">
          Hold the pointer inside the marked strip on each card until the bar
          fills. Do not chase the card if it moves.
        </p>
      </div>

      <div className="relative left-1/2 w-[min(100vw-2rem,46rem)] -translate-x-1/2">
        <div className="grid justify-items-center gap-4 sm:grid-cols-2">
          <Sandbox label="left" reveal={sent} />
          <Sandbox label="right" fixed reveal={sent} />
        </div>
      </div>

      <fieldset className="min-w-0 rounded-lg ring-1 ring-stroke ring-inset">
        <div className="flex flex-col gap-4 p-5">
          <legend className="text-body text-text-primary">
            Which one let you fill the bar?
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
                    sent && !right && !wrong && "text-text-muted",
                    !sent &&
                      (on
                        ? "bg-fill-active text-text-primary"
                        : "text-text-secondary hover:bg-fill hover:text-text-primary"),
                  )}
                >
                  {/* a real radio, visually hidden, so the group keeps its
                      arrow keys and its announcement */}
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
                  {right ? <Tag>correct</Tag> : null}
                  {wrong ? <Tag danger>your answer</Tag> : null}
                </label>
              );
            })}
          </div>
        </div>

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
              The right one answers the pointer on a box that never moves. On
              the left the hit target is inside the card, so tilting the card
              takes the target with it, you end up off the thing you were
              pointing at, and the bar starts again every time.
            </motion.p>
          ) : (
            <button
              type="button"
              disabled={choice === null}
              onClick={() => setSent(true)}
              className={cn(
                "flex h-9 items-center gap-1.5 rounded-full px-4 text-action transition-colors duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2",
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

function Sandbox({
  label,
  fixed,
  reveal,
}: {
  label: string;
  fixed?: boolean;
  reveal: boolean;
}) {
  const reduce = useReducedMotion();
  const slot = useRef<HTMLDivElement>(null);
  /** leaves fired while the pointer was still inside the card's layout box */
  const [drops, setDrops] = useState(0);
  const [done, setDone] = useState(false);

  const aimX = useMotionValue(0);
  const aimY = useMotionValue(0);
  const springX = useSpring(aimX, SPRING);
  const springY = useSpring(aimY, SPRING);
  /* `MotionProvider` governs motion components and never a `useSpring`, so
     reduced motion is picked here: the tilt is kept and the travel is not */
  const rotateX = reduce ? aimX : springX;
  const rotateY = reduce ? aimY : springY;

  /* how much of the hold is done, written per frame and rendered by nothing */
  const filled = useMotionValue(0);
  const since = useRef(0);
  const frame = useRef(0);

  const stopHold = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = 0;
    filled.set(0);
  }, [filled]);

  const startHold = useCallback(() => {
    if (frame.current) return;
    since.current = performance.now();
    const run = (now: number) => {
      const share = Math.min(1, (now - since.current) / HOLD);
      filled.set(share);
      if (share >= 1) {
        frame.current = 0;
        setDone(true);
        return;
      }
      frame.current = requestAnimationFrame(run);
    };
    frame.current = requestAnimationFrame(run);
  }, [filled]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  /*
   * The pointer is read against the slot, which is the card's untransformed
   * box, in both sandboxes. That leaves exactly one variable between them.
   */
  const track = (event: React.PointerEvent<HTMLButtonElement>) => {
    const el = slot.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width < 1) return;
    const x = event.clientX - r.left;
    const px = x / r.width;
    const py = (event.clientY - r.top) / r.height;
    aimX.set(-(py - 0.5) * 2 * TILT);
    aimY.set((px - 0.5) * 2 * TILT);

    if (done) return;
    /* the bar runs only while the pointer is in the strip. Anywhere else on the
       card would let a reader fill both of them from the middle, where there is
       no bug to meet. */
    if (x <= STRIP) startHold();
    else stopHold();
  };

  const leave = (event: React.PointerEvent<HTMLButtonElement>) => {
    const el = slot.current;
    if (el) {
      const r = el.getBoundingClientRect();
      /* a leave with the pointer still inside the box is the bug, and a leave
         with it outside is a reader who has simply gone somewhere else */
      if (
        event.clientX >= r.left &&
        event.clientX <= r.right &&
        event.clientY >= r.top &&
        event.clientY <= r.bottom
      ) {
        setDrops((n) => n + 1);
      }
    }
    if (!done) stopHold();
    aimX.set(0);
    aimY.set(0);
  };

  const control = (
    <button
      type="button"
      aria-label={`Hold the strip on the ${label} card`}
      onPointerMove={track}
      onPointerLeave={leave}
      className="absolute inset-0 cursor-pointer rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2"
    />
  );

  return (
    <figure className="flex w-full max-w-full flex-col items-center gap-3">
      <div
        className="relative grid w-full max-w-full place-items-center overflow-hidden rounded-lg bg-fill ring-1 ring-stroke ring-inset"
        style={{ height: STAGE.h, maxWidth: STAGE.w }}
      >
        <div
          ref={slot}
          className="relative"
          style={{ width: CARD.w, height: CARD.h }}
        >
          {/* where the card is when it is flat, so the gap the tilt opens is
              something the reader can see rather than something to take on
              trust */}
          <div className="pointer-events-none absolute inset-0 rounded-xl border border-stroke-strong border-dashed" />

          <motion.div
            style={{ rotateX, rotateY, transformPerspective: PERSPECTIVE }}
            className={cn(
              "absolute inset-0 flex flex-col justify-between rounded-xl bg-bg p-4 ring-1 ring-stroke",
              fixed && "pointer-events-none",
            )}
          >
            <div className="flex flex-col gap-1.5 pl-3">
              <span className="h-2 w-24 rounded-full bg-fill-active" />
              <span className="h-2 w-16 rounded-full bg-fill" />
            </div>
            <span className="ml-3 h-2 w-20 rounded-full bg-fill" />
            {!fixed && control}
          </motion.div>

          {/*
           * The target, and the bar, which are one object.
           *
           * It sits after the card so it paints over it, and it belongs to the
           * footprint rather than to the card, so what the reader watches is
           * the card's own edge sliding in behind a strip that has not moved.
           * Transparent to the pointer, or it would take the events from the
           * control it exists to send them to.
           */}
          <div
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-y-0 left-0 overflow-hidden rounded-l-xl border-r border-dashed transition-colors duration-200",
              done
                ? "border-text-primary/40 bg-text-primary/10"
                : "border-text-muted bg-fill-active",
            )}
            style={{ width: STRIP }}
          >
            <motion.div
              style={{ scaleY: filled }}
              className="absolute inset-0 origin-bottom bg-text-primary/30"
            />
            {/* somewhere to aim, since a 12px band of grey is a thing a reader
                has to go looking for and a dot is a thing they can point at */}
            {done ? (
              <CheckIcon
                aria-hidden="true"
                weight="bold"
                className="-translate-x-1/2 -translate-y-1/2 absolute top-1/2 left-1/2 size-2.5 text-text-primary"
              />
            ) : (
              <span
                aria-hidden="true"
                className="-translate-x-1/2 -translate-y-1/2 absolute top-1/2 left-1/2 size-1.5 rounded-full bg-text-muted"
              />
            )}
          </div>

          {fixed && control}
        </div>
      </div>

      <figcaption className="flex items-center gap-1.5 text-meta text-text-muted">
        <span className="font-mono">{label}</span>
        <span
          aria-hidden="true"
          className="inline-block size-1 shrink-0 rounded-full bg-stroke-strong"
        />
        {done ? (
          <span className="text-text-primary">held</span>
        ) : drops > 0 ? (
          <span className="text-danger">
            dropped {drops === 1 ? "once" : `${drops} times`}
          </span>
        ) : (
          <span>hold the strip</span>
        )}
        {reveal ? (
          <>
            <span
              aria-hidden="true"
              className="inline-block size-1 shrink-0 rounded-full bg-stroke-strong"
            />
            <span className="text-text-secondary">
              {fixed ? "target beside the card" : "target inside the card"}
            </span>
          </>
        ) : null}
      </figcaption>
    </figure>
  );
}

/* ─────────────────────────────────────────────────────────
 * REPLAY
 *
 * A loop, not an interaction. Nothing here answers a pointer, which is also
 * what a reader on a touch screen gets instead of the sandboxes above.
 *
 *     0ms   flat, the cursor parked on the left edge
 *   260ms   tilted, and the edge has pulled inside the dashed line
 *   900ms   the hover is gone and it has levelled again
 * ───────────────────────────────────────────────────────── */

export function Replay() {
  return (
    <figure className="my-8 flex flex-col items-center gap-3">
      <div
        className="relative grid w-full place-items-center overflow-hidden rounded-lg bg-fill ring-1 ring-stroke ring-inset"
        style={{ height: STAGE.h }}
      >
        <div className="relative" style={{ width: CARD.w, height: CARD.h }}>
          <div className="absolute inset-0 rounded-xl border border-stroke-strong border-dashed" />

          <motion.div
            animate={{ rotateY: [0, -TILT, -TILT, 0, 0] }}
            transition={{
              duration: 1.8,
              times: [0, 0.18, 0.4, 0.55, 1],
              ease: "easeOut",
              repeat: Number.POSITIVE_INFINITY,
            }}
            style={{ transformPerspective: PERSPECTIVE }}
            className="absolute inset-0 flex flex-col justify-between rounded-xl bg-bg p-4 ring-1 ring-stroke"
          >
            <div className="flex flex-col gap-1.5">
              <span className="h-2 w-24 rounded-full bg-fill-active" />
              <span className="h-2 w-16 rounded-full bg-fill" />
            </div>
            <span className="h-2 w-20 rounded-full bg-fill" />
          </motion.div>

          {/* parked, and never moved. Everything that happens to it happens
              because the card came and went underneath. */}
          <CursorIcon
            aria-hidden="true"
            weight="fill"
            className="-translate-x-1/2 -translate-y-1/2 absolute top-1/2 left-0 size-4 text-text-primary"
          />
        </div>
      </div>

      <figcaption className="text-meta text-text-muted">
        The pointer never moves. The card does.
      </figcaption>
    </figure>
  );
}

function Tag({ children, danger }: { children: string; danger?: boolean }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 font-mono text-meta",
        danger ? "bg-danger/10 text-danger" : "bg-bg text-text-secondary",
      )}
    >
      {children}
    </span>
  );
}
