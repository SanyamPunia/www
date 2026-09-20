"use client";

import {
  ArrowRightIcon,
  CheckCircleIcon,
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
import { useId, useRef, useState } from "react";
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
 * Twelve and 800 rather than any other pair, so the gap the post quotes is the
 * gap the demo opens: half of 268px turned 12 degrees goes back 27.9px, which
 * at this perspective shrinks by a factor of 0.966, so the near edge lands
 * 7.4px inside the dashed line. The prose says about eight pixels and means it
 * about the real card as well.
 */
const TILT = 12;
const PERSPECTIVE = 800;

/** A card has mass, so it arrives with a little overshoot. */
const SPRING = { stiffness: 220, damping: 20 };

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
          Take the pointer to the left edge of each card and hold it there. The
          dashed line is where the card is when it is flat.
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
            Which one held the tilt at its edge?
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
              the left the target is inside the card, so tilting the card takes
              the target with it and you end up off the thing you are pointing
              at.
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

  const aimX = useMotionValue(0);
  const aimY = useMotionValue(0);
  const springX = useSpring(aimX, SPRING);
  const springY = useSpring(aimY, SPRING);
  /* `MotionProvider` governs motion components and never a `useSpring`, so
     reduced motion is picked here: the tilt is kept and the travel is not */
  const rotateX = reduce ? aimX : springX;
  const rotateY = reduce ? aimY : springY;

  /*
   * The pointer is read against the slot, which is the card's untransformed
   * box, in both sandboxes. That leaves exactly one variable between them.
   */
  const track = (event: React.PointerEvent<HTMLButtonElement>) => {
    const el = slot.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width < 1) return;
    const px = (event.clientX - r.left) / r.width;
    const py = (event.clientY - r.top) / r.height;
    aimX.set(-(py - 0.5) * 2 * TILT);
    aimY.set((px - 0.5) * 2 * TILT);
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
    aimX.set(0);
    aimY.set(0);
  };

  const control = (
    <button
      type="button"
      aria-label={`Tilt the ${label} card`}
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
            <div className="flex flex-col gap-1.5">
              <span className="h-2 w-24 rounded-full bg-fill-active" />
              <span className="h-2 w-16 rounded-full bg-fill" />
            </div>
            <span className="h-2 w-20 rounded-full bg-fill" />
            {!fixed && control}
          </motion.div>

          {fixed && control}
        </div>
      </div>

      <figcaption className="flex items-center gap-1.5 text-meta text-text-muted">
        <span className="font-mono">{label}</span>
        <span
          aria-hidden="true"
          className="inline-block size-1 shrink-0 rounded-full bg-stroke-strong"
        />
        <span className={cn(drops > 0 && "text-danger")}>
          dropped {drops === 1 ? "once" : `${drops} times`}
        </span>
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
