"use client";

import { MinusIcon, PlusIcon, ShuffleIcon } from "@phosphor-icons/react";
import {
  AnimatePresence,
  animate,
  type MotionValue,
  motion,
  motionValue,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { TextMorph } from "torph/react";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Stem, VIEW_H, VIEW_W } from "./stem";
import { armStems, playAdd, playRemove } from "./stem-sound";
import {
  angleAt,
  inOrder,
  lengthAt,
  MAX,
  MIN,
  reshuffle,
  TWINE,
  TWINE_DEEP,
  VARIETIES,
} from "./stems";

/*
 * A quantity stepper where the thing being counted is the thing you see.
 *
 * Press the plus and a stem arrives: it starts under the knot, small and
 * invisible, swings up on an arc and settles into the fan. Press the minus and
 * the newest one is lifted back out. The bunch never empties, the floor is one
 * stem.
 *
 * **The arrival and the resting place are the same geometry, and that is the
 * whole design.** Every stem is pinned at the knot and differs from its
 * neighbours by one number, the angle it leans at, so a stem arriving is that
 * angle changing and nothing travels a path invented for the occasion. Arc an
 * item into a straight row instead and the arc is decoration laid over the top:
 * the item swings in, then stops somewhere the swing does not explain.
 *
 * **Depth is scale about the knot, not a z translate.** A stem enters at 0.62
 * and grows to 1 with its origin at the tie, so its bloom starts close to the
 * knot and travels outward as it rises. That reads as something coming forward,
 * and it costs no perspective, no `preserve-3d` and no stacking order.
 *
 * **Two springs, because two things happen on one press.** The stem that
 * arrives is being placed, and the ones already there shuffle over to make
 * room. On one spring the whole bunch bounces every time, which reads as the
 * table being knocked rather than a flower being added. So `rotate` takes the
 * quieter spring and `scale` the livelier one, and since only the arriving stem
 * ever animates its scale, the bounce lands on that stem alone.
 *
 * **The stems touch.** A landing stem knocks the two beside it, hardest on the
 * nearest, and they swing back. Without it the arrival and the re-spread are
 * two independent animations that happen to overlap, which is what every
 * stepper demo looks like. The knock is what makes them objects in contact.
 */

/* ─────────────────────────────────────────────────────────────
 * ARRIVAL STORYBOARD
 *
 *     0ms   under the knot: rotated past its slot, 0.62 scale,
 *           dropped by 9% of its own length, invisible
 *     0ms   the stems already in the bunch start opening out
 *   180ms   the knock in the sound, where the cut end lands
 *   180ms   the two stems beside the slot are nudged aside
 *   240ms   the new stem is fully faded in, still travelling
 *   360ms   the fan has finished re-spreading
 *   420ms   the new stem lands and overshoots a touch
 *   ~640ms  the nudge has decayed, everything settled
 * ───────────────────────────────────────────────────────────── */

/**
 * The drawing's height as a share of the stage's width, and the box to match.
 *
 * Sized so the bunch, the stepper and the line under it leave a real gutter
 * inside the stage rather than filling it. At 37 the column came to 57 of the
 * stage's 62.5, which is 15px of air top and bottom and reads as content
 * pressed against a frame.
 */
/*
 * Two values, because the stage is 8:5 on a column and square on a phone. At
 * one share the bunch came to 93px at 390 against a 75px stepper, which is a
 * drawing no larger than the controls that change it. The wide stage has width
 * to spare and the narrow one does not, so the narrow one spends far more of
 * it.
 *
 * It is a custom property rather than a number, since the breakpoint has to be
 * CSS. Everything sized off the stem is a `calc` against it.
 */
const STEM = "[--stem:52cqw] sm:[--stem:31cqw]";
/** the drawing's own ratio, and the longest a hand-cut stem gets */
const RATIO = VIEW_W / VIEW_H;
const LONGEST = 1.08;
const wide = (share: number) =>
  `calc(var(--stem) * ${(RATIO * share).toFixed(4)})`;

/**
 * How far past its own slot a stem starts.
 *
 * It enters from the open side of the fan, which is where a hand adding to a
 * bunch comes from, and it is a swing rather than a slide so the entry is the
 * same rotation the rest of the experiment is made of.
 */
const SWING = 34;
const ENTER_SCALE = 0.62;
/** a share of the stem's own length, so the drop scales with the stage */
const ENTER_DROP = "9%";

/**
 * Leaving is a lift, not the arrival reversed.
 *
 * A hand taking a stem out of a bunch pulls it clear and turns it further out
 * on the way. Playing the entry backwards is the lazy default and it reads as
 * an undo rather than as a stem being taken.
 */
const LIFT_TURN = 7;
const LIFT_RISE = "-16%";

/**
 * The bounce is the character and the duration is not, so tightening this went
 * at the durations and left `bounce` where it was. Dropping the overshoot
 * instead makes it quick and dead, which is a different interaction.
 */
const OPEN = { type: "spring", visualDuration: 0.36, bounce: 0.18 } as const;
const LAND = { type: "spring", visualDuration: 0.42, bounce: 0.34 } as const;
const FADE = { duration: 0.24, ease: "easeOut" } as const;
const LEAVE = { duration: 0.22, ease: "easeIn" } as const;

/**
 * The knock a landing stem gives its neighbours, in degrees, and how far down
 * the fan it carries.
 *
 * It falls off with the square of the distance, so the stem next to the slot
 * takes nearly all of it and the one past that barely moves, which is what one
 * object striking a row of them does. Any further and the whole bunch sways,
 * which is the thing the two springs exist to avoid.
 */
const KICK = 2.8;
const KICK_REACH = 2;
/** the knock lands when the stem does, not when the button goes down */
const KICK_AT = 0.18;

/** hold either control and the count runs, the way every real stepper does */
const HOLD_AFTER = 380;
const HOLD_EVERY = 165;

/**
 * The bunch is the control, and the tie is where you hold it.
 *
 * Two grey circles beside a picture is a button demo. A bunch you can grip and
 * pull stems out of is the thing itself answering the hand, which is what every
 * other experiment here does. The stepper stays, for the keyboard and for
 * anyone who wants it, and the drag becomes the primary gesture.
 *
 * `DRAG_STEP` is how far the hand travels per stem. At 30 the whole range is
 * 240px, which is most of the stage and about the length of a comfortable pull.
 */
const DRAG_STEP = 30;
/**
 * Past either end the bunch gives a little rather than going dead, and springs
 * back on release. A hard stop feels like hitting a wall where resistance says
 * there is nothing further, which is the rule every gesture follows here.
 */
const STRAIN_GIVE = 0.34;
const STRAIN_MAX = 15;
const RELEASE = { type: "spring", visualDuration: 0.42, bounce: 0.36 } as const;

/**
 * A held bunch answers the hand that is near it. One degree either side, which
 * is under the threshold for reading as an animation and over the threshold for
 * reading as alive. Mouse and pen only, `folder-stack`'s gate: a touch has no
 * hover to take back.
 */
const LEAN_MAX = 2.4;
const LEAN_SPRING = { stiffness: 120, damping: 20, mass: 0.6 } as const;

const MORPH = {
  duration: 200,
  ease: "cubic-bezier(0.32, 0.72, 0, 1)",
} as const;

/** the site's quiet pill, plus the disabled pair the shared rules ask for */
const STEP =
  "flex size-14 shrink-0 cursor-pointer items-center justify-center rounded-full bg-fill text-text-secondary transition-colors duration-150 hover:bg-fill-hover hover:text-text-primary active:bg-fill-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-fill disabled:hover:text-text-secondary";

export default function StemPicker() {
  const [count, setCount] = useState(MIN);
  const reduce = useReducedMotion();

  /*
   * The count is read outside render by the repeat timer and by `step`, which
   * needs the current value to decide whether it has anything to do. Keeping it
   * in a ref alongside the state is what lets the side effects sit in the
   * handler rather than inside a state updater, where React is free to run them
   * twice.
   */
  const countRef = useRef(count);
  const nudges = useRef(new Map<number, MotionValue<number>>());
  const hold = useRef<number | null>(null);

  /** which variety is in which slot. the shuffle is the only thing that moves it */
  const [order, setOrder] = useState(inOrder);

  /** the pull, and what the bunch does when it has nowhere left to go */
  const drag = useRef<{ y: number; from: number } | null>(null);
  const strain = useMotionValue(0);
  const lean = useSpring(useMotionValue(0), LEAN_SPRING);
  /*
   * A press that ran the count still ends in a `click`, which would add one
   * more on top of everything the hold already did. The flag is what tells a
   * plain press from the tail of a held one.
   */
  const repeated = useRef(false);

  const nudgeFor = (index: number): MotionValue<number> => {
    const existing = nudges.current.get(index);
    if (existing) return existing;
    const fresh = motionValue(0);
    nudges.current.set(index, fresh);
    return fresh;
  };

  /** knock the stems beside `slot`, hardest on the nearest */
  const jostle = useCallback(
    (slot: number, direction: 1 | -1) => {
      if (reduce) return;
      for (let away = 1; away <= KICK_REACH; away += 1) {
        const value = nudges.current.get(slot - away);
        if (!value) continue;
        animate(value, [0, (direction * KICK) / (away * away), 0], {
          duration: 0.46,
          times: [0, 0.3, 1],
          ease: ["easeOut", "easeInOut"],
          delay: direction === -1 ? KICK_AT : 0,
        });
      }
    },
    [reduce],
  );

  const stopHold = useCallback(() => {
    if (hold.current !== null) window.clearTimeout(hold.current);
    hold.current = null;
  }, []);

  const step = useCallback(
    (delta: 1 | -1) => {
      const current = countRef.current;
      const next = Math.min(MAX, Math.max(MIN, current + delta));
      if (next === current) {
        stopHold();
        return false;
      }
      countRef.current = next;
      setCount(next);
      if (delta === 1) {
        playAdd((next - 1) / (MAX - 1));
        jostle(next - 1, -1);
      } else {
        playRemove();
        jostle(current - 1, 1);
      }
      return true;
    },
    [jostle, stopHold],
  );

  const startHold = useCallback(
    (delta: 1 | -1) => {
      armStems();
      stopHold();
      repeated.current = false;
      const repeat = () => {
        repeated.current = true;
        if (!step(delta)) return;
        hold.current = window.setTimeout(repeat, HOLD_EVERY);
      };
      hold.current = window.setTimeout(repeat, HOLD_AFTER);
    },
    [step, stopHold],
  );

  useEffect(() => stopHold, [stopHold]);

  /*
   * The drag tracks the hand rather than easing toward it, and the count
   * commits on the detents it crosses, so every stem still arrives as its own
   * event with its own sound and its own knock. One step per move, which rate
   * limits a flick without a timer and reads better than several landing at
   * once.
   */
  const onGrip = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { y: event.clientY, from: countRef.current };
    armStems();
  };

  const onPull = (event: React.PointerEvent<HTMLDivElement>) => {
    const held = drag.current;
    if (!held) return;
    const pulled = (held.y - event.clientY) / DRAG_STEP;
    const wanted = held.from + Math.round(pulled);
    const target = Math.min(MAX, Math.max(MIN, wanted));
    if (target > countRef.current) step(1);
    else if (target < countRef.current) step(-1);
    /* whatever the pull asked for past the ends is what the bunch resists by */
    const over = wanted - target;
    strain.set(
      reduce
        ? 0
        : Math.max(
            -STRAIN_MAX,
            Math.min(STRAIN_MAX, -over * DRAG_STEP * STRAIN_GIVE),
          ),
    );
  };

  const onLetGo = () => {
    if (!drag.current) return;
    drag.current = null;
    if (reduce) strain.set(0);
    else animate(strain, 0, RELEASE);
  };

  /** the bunch leans toward a pointer that is near it, but never while held */
  const onHover = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch" || drag.current) return;
    const box = event.currentTarget.getBoundingClientRect();
    const across = (event.clientX - box.left) / box.width - 0.5;
    lean.set(reduce ? 0 : across * 2 * LEAN_MAX);
  };

  const stems = Array.from({ length: count }, (_, index) => index);
  const names = stems.map((index) => VARIETIES[order[index]].name).join(", ");

  return (
    <div
      className={cn(
        "@container relative flex aspect-square w-full select-none flex-col items-center justify-center gap-7 overflow-hidden rounded-lg bg-bg p-8 ring-1 ring-stroke ring-inset sm:aspect-8/5",
        STEM,
      )}
    >
      <div
        className="relative w-full shrink-0"
        style={{ height: `calc(var(--stem) * ${LONGEST})` }}
        onPointerMove={onHover}
        onPointerLeave={() => lean.set(0)}
      >
        {/* the bunch is the only thing in the frame casting anything, and it
            spreads as the fan does, so the shadow widens with the count */}
        <motion.div
          className="-translate-x-1/2 pointer-events-none absolute bottom-0 left-1/2 rounded-[50%] bg-black blur-md"
          style={{ height: wide(0.22) }}
          animate={{
            width: wide(0.5 + count * 0.09),
            opacity: 0.07 + count * 0.006,
          }}
          transition={reduce ? { duration: 0 } : OPEN}
        />

        {/* the bunch strains and leans as one object. the shadow above is on
            the ground and stays where it is. */}
        <motion.div
          className="absolute inset-0 origin-bottom"
          style={{ y: strain, rotate: lean }}
          role="img"
          aria-label={`${count} ${count === 1 ? "stem" : "stems"}: ${names}`}
        >
          <AnimatePresence initial={false}>
            {stems.map((index) => {
              const angle = angleAt(index, count);
              const rest = { rotate: angle, scale: 1, y: 0, opacity: 1 };
              const under = {
                rotate: angle + SWING,
                scale: ENTER_SCALE,
                y: ENTER_DROP,
                opacity: 0,
              };
              const lifted = {
                rotate: angle + LIFT_TURN,
                scale: 1.02,
                y: LIFT_RISE,
                opacity: 0,
              };
              /*
               * Atmospheric perspective across the fan. A bunch has a front and a
               * back, and this one was nine equals on one plane. Keyed off the
               * index rather than the current count, so a stem's own depth never
               * changes under it as the bunch fills.
               */
              const depth = index / (MAX - 1);

              return (
                <motion.div
                  key={index}
                  className="absolute bottom-0 origin-bottom"
                  style={{
                    left: `calc(50% - ${wide(0.5)})`,
                    width: wide(1),
                    height: `calc(var(--stem) * ${lengthAt(index).toFixed(4)})`,
                    zIndex: index,
                  }}
                  initial={reduce ? { opacity: 0, rotate: angle } : under}
                  animate={reduce ? { opacity: 1, rotate: angle } : rest}
                  exit={
                    reduce
                      ? { opacity: 0, transition: LEAVE }
                      : { ...lifted, transition: LEAVE }
                  }
                  transition={{
                    rotate: OPEN,
                    scale: LAND,
                    y: LAND,
                    opacity: FADE,
                  }}
                >
                  {/*
                   * The knock lives on its own element. The box above owns the fan
                   * angle declaratively, and a motion value handed to `style` owns
                   * that transform outright, so the two cannot share one `rotate`.
                   * `crack-button`'s repair makes the same split for the same
                   * reason.
                   */}
                  <motion.div
                    className="size-full origin-bottom"
                    style={{
                      rotate: nudgeFor(index),
                      opacity: 1 - (1 - depth) * 0.14,
                      scale: 0.97 + depth * 0.03,
                    }}
                  >
                    <Stem
                      index={index}
                      lean={angle}
                      variety={VARIETIES[order[index]]}
                    />
                  </motion.div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/*
           * The tie, drawn over every stem so they read as one bunch.
           *
           * It is not there at one stem. Twine holds a bunch together and there is
           * nothing to hold together yet, so a band around a lone stem reads as a
           * pot rather than as a wrap. It arrives with the second stem on that
           * stem's own spring, so the two land together.
           */}
          <motion.div
            className="-translate-x-1/2 pointer-events-none absolute bottom-0 left-1/2 origin-bottom"
            style={{ width: wide(0.44), zIndex: MAX + 1 }}
            animate={{
              opacity: count > MIN ? 1 : 0,
              scale: count > MIN ? 1 : 0.72,
            }}
            transition={reduce ? { duration: 0 } : LAND}
          >
            <svg
              viewBox="0 0 28 30"
              className="w-full"
              aria-hidden="true"
              focusable="false"
            >
              <title>Twine</title>
              <rect
                x={3}
                y={3}
                width={22}
                height={24}
                rx={5}
                fill={TWINE}
                stroke={TWINE_DEEP}
                strokeWidth={1.2}
              />
              <path
                d="M5 9h18M5 15h18M5 21h18"
                stroke={TWINE_DEEP}
                strokeWidth={1}
                strokeLinecap="round"
                opacity={0.55}
              />
            </svg>
          </motion.div>
        </motion.div>

        {/*
         * The tie is the handle, which is where a hand takes a bunch anyway.
         *
         * `touch-action: none` is on this alone and nowhere else, which is
         * `window-shade`'s trade: a vertical drag here is the gesture and a
         * vertical drag anywhere else on the stage is still the page scrolling
         * past. The stage keeps the browser default rather than `pan-y`, since
         * nothing here wants the horizontal axis either.
         *
         * The minimum size is not decoration. `cqw` shrinks with the stage, and
         * on a 390px phone 12 by 9 works out at 36 by 27, which is under the
         * floor for something a thumb has to find. It is a `slider` rather than
         * a bare div with handlers, since that is what it is, and the arrows are
         * the keyboard's version of the pull.
         */}
        <div
          className="-translate-x-1/2 absolute bottom-0 left-1/2 min-h-14 min-w-14 cursor-grab touch-none rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2 active:cursor-grabbing"
          style={{ width: wide(1.1), height: wide(0.8), zIndex: MAX + 2 }}
          role="slider"
          tabIndex={0}
          aria-label="Stems in the bunch"
          aria-valuenow={count}
          aria-valuemin={MIN}
          aria-valuemax={MAX}
          onPointerDown={onGrip}
          onPointerMove={onPull}
          onPointerUp={onLetGo}
          onPointerCancel={onLetGo}
          onKeyDown={(event) => {
            const by =
              event.key === "ArrowUp" || event.key === "ArrowRight"
                ? 1
                : event.key === "ArrowDown" || event.key === "ArrowLeft"
                  ? -1
                  : 0;
            if (!by) return;
            event.preventDefault();
            armStems();
            step(by);
          }}
        />
      </div>

      <div className="flex flex-col items-center gap-2.5">
        {/* a real `fieldset`, which is what a group of related controls is.
            `min-w-0` because a fieldset's default `min-width: min-content` is
            one of the few boxes that does not start at zero. */}
        <fieldset
          className="flex min-w-0 items-center gap-5 border-0 p-0"
          aria-label="Stem count"
        >
          <button
            type="button"
            className={cn(STEP)}
            onPointerDown={() => startHold(-1)}
            onPointerUp={stopHold}
            onPointerLeave={stopHold}
            onPointerCancel={stopHold}
            onClick={() => {
              if (repeated.current) {
                repeated.current = false;
                return;
              }
              step(-1);
            }}
            disabled={count === MIN}
            aria-label="One fewer stem"
          >
            <MinusIcon className="size-4" aria-hidden="true" />
          </button>

          {/* the count is the value being corrected, which is what `torph` is
              for. off the type scale on purpose: it is the object the two
              controls act on rather than copy, the standing `flip-clock`'s
              numerals have. */}
          <span
            className="w-10 text-center font-medium text-[1.625rem] text-text-primary tabular-nums"
            aria-live="polite"
          >
            <TextMorph duration={MORPH.duration} ease={MORPH.ease}>
              {String(count)}
            </TextMorph>
          </span>

          <button
            type="button"
            className={cn(STEP)}
            onPointerDown={() => startHold(1)}
            onPointerUp={stopHold}
            onPointerLeave={stopHold}
            onPointerCancel={stopHold}
            onClick={() => {
              if (repeated.current) {
                repeated.current = false;
                return;
              }
              step(1);
            }}
            disabled={count === MAX}
            aria-label="One more stem"
          >
            <PlusIcon className="size-4" aria-hidden="true" />
          </button>
        </fieldset>

        {/* the line under the stepper is a second readout on the same count, so
            it is corrected the same way the number is. `whitespace-nowrap` and
            never `truncate`: torph lays its characters out itself and an
            `overflow-hidden` box on the same element clips them mid-morph,
            which is `event-stacking`'s note. */}
        <div className="flex items-center gap-2">
          <p className="whitespace-nowrap text-meta text-text-muted">
            <TextMorph duration={MORPH.duration} ease={MORPH.ease}>
              {count === MAX ? "the whole bucket" : "hand tied, market bunch"}
            </TextMorph>
          </p>
          <TooltipProvider>
            <Tooltip label="Mix the bunch again">
              <button
                type="button"
                className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-text-muted transition-colors duration-150 hover:bg-fill hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2"
                onClick={() => setOrder(reshuffle)}
                aria-label="Mix the bunch again"
              >
                <ShuffleIcon className="size-3.5" aria-hidden="true" />
              </button>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}
