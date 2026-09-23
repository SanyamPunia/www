"use client";

import {
  animate,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
} from "motion/react";
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { approach } from "@/lib/lerp";
import { cn } from "@/lib/utils";
import { armMarbles, playClear } from "./marble-sound";
import { MARBLE } from "./marbles";
import {
  angleAt,
  clamp,
  GAP,
  geometry,
  LAP,
  OPEN,
  PEEK,
  poseAt,
  RIDERS,
  railAt,
  STEP,
  spread,
} from "./track";

/*
 * A launcher whose items ride an arc. Press the plus and five marbles file out
 * from under it, one after another, and swing round a circle to where they
 * rest. Press it again and they retract the way they came.
 *
 * One scalar carries it. `advance` is how far the leader has travelled from
 * the mouth, and every other ball's own travel is a link in a chain that
 * follows it. A ball's angle, its size and whether it is on screen at all come
 * off its travel, so a press, an arrow key and a hand cranking the plus round
 * the arc are that one number moving at different speeds. `track.ts` holds the
 * geometry, `marbles.tsx` draws what rides it.
 */

const BUBBLES = RIDERS.map((rider) => ({ ...rider, ...MARBLE[rider.marble] }));

type Tween = {
  duration: number;
  ease: readonly [number, number, number, number];
};

/**
 * Opening, which never changes: the drawer curve, which leaves at over twice
 * its own average speed. A press is answered in the first few frames or it is
 * not answered, and its flat tail is right here because five balls are coming
 * to rest on screen.
 */
const OUT: Tween = { duration: 0.8, ease: [0.32, 0.72, 0, 1] };

/**
 * Shutting. It matches the open's launch, so the two read as one gesture and
 * its reverse, and it lands while still moving, which costs nothing because at
 * that instant the only thing on screen is the leader going behind the button.
 *
 * **It cannot be the open's own curve, and that is not a taste.** One scalar
 * carries five balls, so their passages through the mouth are five samples of
 * the same curve taken at five points along it: whichever is last through
 * spends its whole passage in whatever part of the curve the end of the move
 * lands on. On the way out that is the tail, the smallest ball, easing into
 * place with the rest, which is what the drawer curve's flat tail is for. On
 * the way in it is the leader, the biggest ball on the stage, and measured per
 * frame it took 408ms to shrink into the button against 33 for every one of
 * the others.
 *
 * An accelerating curve was the first fix and it fixed the wrong half: it puts
 * the slow part at the start, where the strand is still spread and nothing is
 * in the mouth at all, and what that reads as is a close with no answer in it.
 */
const IN: Tween = { duration: 0.42, ease: [0.25, 0.6, 0.7, 0.95] };

/**
 * How far behind the one ahead each ball runs, as a time constant.
 *
 * The strand is a chain rather than a rail: every ball follows the one in
 * front through its own exponential instead of sitting a fixed arc behind the
 * leader, so it pays out under a fast hand and gathers when the hand stops,
 * which is what a string of beads does and what makes the crank feel like one.
 * At 12ms and the open's peak that is about 14 degrees of lag a link and 56
 * across the strand, so it stretches by a quarter of its own length and comes
 * back.
 */
/** how long a link takes to cover 63% of the gap to the one ahead */
const LINK_TAU = 0.012;

const NUDGE: Tween = { duration: 0.26, ease: OUT.ease };
/** the peek a hover on the trigger shows, and its own way back. Short, since
 * what moves is a sliver of one ball */
const PEEK_OUT: Tween = { duration: 0.22, ease: OUT.ease };
const PEEK_IN: Tween = { duration: 0.18, ease: IN.ease };

const instant = { duration: 0 } as const;

/** the scale a ball counts as clear of the mouth at, which is what clicks */
const FULL = 0.999;

/** how far the hand moves before a press on the plus is a crank */
const SLOP = 6;
/** inside this share of the radius a pointer's angle is noise, not a turn */
const DEAD = 0.25;
/** radians a second past which a release is a throw rather than a placement */
const FLICK = 2;

/**
 * The light on a ball. Two gradients over the drawing, both in percentages so
 * one string serves a 27px marble and a 69px one: a soft light off the upper
 * left, and the far edge falling away from it. One lamp over the stage rather
 * than one per ball, which is why it lives here and not in `marbles.tsx`.
 *
 * It was a full glass treatment first, a hard specular and a heavy rim, and
 * five of those read as a bag of toys. What a circle needs to be an object on
 * the page rather than a hole cut in it is one light and an edge.
 */
const GLASS = [
  "radial-gradient(circle at 38% 22%, rgba(255,255,255,0.28), rgba(255,255,255,0) 62%)",
  "radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 68%, rgba(0,0,0,0.18) 100%)",
].join(", ");

/**
 * The edge and the lift, which are the two things a percentage cannot carry,
 * both a share of the ball's own radius. Translucent black rather than the
 * `stroke` token, since what is under it is a drawing rather than a surface,
 * which is the one case the shared rule leaves to an inset outline.
 */
const shell = (r: number, picked: string | null) =>
  [
    picked ? `0 0 0 2px ${picked}` : "inset 0 0 0 1px rgba(0,0,0,0.12)",
    `0 ${r * 0.06}px ${r * 0.14}px rgba(0,0,0,0.1)`,
  ].join(", ");

export default function ArcMenu() {
  const reduce = useReducedMotion();
  const listId = useId();
  const stage = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const beads = useRef<(HTMLButtonElement | null)[]>([]);
  const advance = useMotionValue(0);

  const [box, setBox] = useState({ w: 0, h: 0 });
  const [open, setOpen] = useState(false);
  const [cranking, setCranking] = useState(false);
  const [tip, setTip] = useState(false);
  const [chosen, setChosen] = useState<number | null>(null);

  const geo = useMemo(() => geometry(box.w, box.h), [box]);

  /* the stage is measured rather than queried, since the poses are stage px */
  useLayoutEffect(() => {
    const node = stage.current;
    if (!node) return;
    const read = () => {
      const w = node.clientWidth;
      const h = node.clientHeight;
      setBox((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /*
   * The loop reads things a render cannot hand it, so they are mirrored into
   * refs: a crank and a close both run entirely outside React.
   */
  const chained = useRef(true);
  useEffect(() => {
    /* a lag is nothing but travel, so reduced motion gets a rigid strand */
    chained.current = !reduce;
  }, [reduce]);

  /** each ball's own travel from the mouth, which is what the loop advances */
  const travel = useRef<number[]>(BUBBLES.map(() => 0));
  /** the scale each ball painted last frame, which is what the click reads */
  const was = useRef<number[]>(BUBBLES.map(() => 0));

  const paint = useCallback(() => {
    for (let i = 0; i < BUBBLES.length; i += 1) {
      const node = beads.current[i];
      if (!node) continue;
      const pose = poseAt(travel.current[i], geo);
      const r = geo.bubble[i];
      node.style.transform = `translate3d(${pose.x - r}px, ${pose.y - r}px, 0) scale(${pose.scale})`;

      /*
       * The click, off the crossing the scale ramp already draws: a ball is
       * through the mouth when its scale reaches 1, so it knocks on the way
       * out and again on the way back in.
       */
      const before = was.current[i];
      const scale = pose.scale;
      was.current[i] = scale;
      if (before < FULL !== scale < FULL) playClear(BUBBLES[i].size);
    }
  }, [geo]);

  const raf = useRef(0);
  const at = useRef(0);
  const held = useRef(false);

  const frame = useCallback(
    (now: number) => {
      const dt = Math.min(0.05, (now - at.current) / 1000);
      at.current = now;

      const t = travel.current;
      t[0] = advance.get();
      let settled = true;
      for (let i = 1; i < t.length; i += 1) {
        const target = Math.max(0, t[i - 1] - GAP[i]);
        if (chained.current) {
          t[i] += (target - t[i]) * approach(LINK_TAU, dt);
          if (Math.abs(target - t[i]) > 1e-4) settled = false;
        } else {
          t[i] = target;
        }
      }
      paint();

      if (!settled || held.current || advance.isAnimating()) {
        raf.current = requestAnimationFrame(frame);
        return;
      }
      /* a chain only ever approaches its target, so the last frame lands it,
         or a ball sits a ten thousandth of a radian out of the mouth forever
         and never reads as gone */
      for (let i = 1; i < t.length; i += 1)
        t[i] = Math.max(0, t[i - 1] - GAP[i]);
      paint();
      raf.current = 0;
    },
    [advance, paint],
  );

  const run = useCallback(() => {
    if (raf.current) return;
    at.current = performance.now();
    raf.current = requestAnimationFrame(frame);
  }, [frame]);

  useMotionValueEvent(advance, "change", run);
  useLayoutEffect(() => {
    /* one frame on mount and after a resize, so the strand is where it says */
    at.current = performance.now();
    const t = travel.current;
    t[0] = advance.get();
    for (let i = 1; i < t.length; i += 1) t[i] = railAt(advance.get(), i);
    paint();
  }, [paint, advance]);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  /*
   * A ball in flight is a target moving under the pointer, so the layer is
   * transparent to it for as long as anything is travelling. Written to the
   * node rather than held in state: a crank would otherwise render twice a
   * gesture for something no pixel depends on.
   */
  const freeze = useCallback((frozen: boolean) => {
    const node = layer.current;
    if (node) node.style.pointerEvents = frozen ? "none" : "";
  }, []);

  const running = useRef<ReturnType<typeof animate> | null>(null);
  const move = useCallback(
    (target: number, tween: Tween) => {
      running.current?.stop();
      freeze(true);
      /* a tween's duration is fixed however far it goes, so a snap back from
         most of the way open would take as long as the whole move */
      const share = Math.max(0.35, Math.abs(target - advance.get()) / OPEN);
      running.current = animate(advance, target, {
        ...(reduce
          ? instant
          : { duration: tween.duration * share, ease: [...tween.ease] }),
        onComplete: () => {
          running.current = null;
          freeze(false);
          setOpen(spread(advance.get()));
        },
      });
      run();
    },
    [advance, reduce, freeze, run],
  );

  /* whether a hover is currently showing the peek, and whether one may */
  const peeking = useRef(false);
  const armed = useRef(true);

  /* a press shuts it if the strand is showing rather than peeking, so the plus
     and what it does cannot disagree after a hover or a hand */
  const toggle = useCallback(() => {
    const target = spread(advance.get()) ? 0 : OPEN;
    peeking.current = false;
    armed.current = false;
    setOpen(target > 0);
    move(target, target > 0 ? OUT : IN);
  }, [advance, move]);

  /*
   * The peek. Hovering the trigger lifts a sliver of the leader past the
   * button's rim, which is the only thing saying the plus has a strand under
   * it at all. Mouse and pen, the gate `folder-stack` documents: a touch has
   * no hover to take back.
   *
   * It is off under reduced motion, which is the line `book-opening` draws
   * between a state and the travel to it. A peek is nothing but travel and it
   * answers a hover rather than a press, so nobody asked for it.
   */
  const peekIn = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (reduce || event.pointerType === "touch") return;
    if (!armed.current || grab.current || spread(advance.get())) return;
    peeking.current = true;
    move(PEEK, PEEK_OUT);
  };
  const peekOut = () => {
    armed.current = true;
    if (!peeking.current) return;
    peeking.current = false;
    move(0, PEEK_IN);
  };

  /* Escape shuts it, which is the courtesy anything that opens over a page owes */
  useEffect(() => {
    if (!open) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      peeking.current = false;
      move(0, IN);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, move]);

  /*
   * The crank. The plus is the handle, and what a hand turning about the
   * track's centre writes is the angle it turns through, so a degree of hand
   * is a degree of strand and the leader rides with it. Pixels of travel would
   * be the wrong unit: the same hand movement is a different amount of arc at
   * the top of the dial than at its side.
   *
   * It is the turn and not the bearing, so the strand keeps whatever it
   * already had. A hand that presses the plus while the peek is showing has
   * the leader a peek ahead of it rather than under it, which is the same
   * thing a second crank from a strand left part way out does.
   *
   * On nib's rules: down on the plus, move, up, cancel and blur on the window,
   * and `buttons === 0` ends a crank whose lift was never heard.
   */
  const grab = useRef<{
    id: number;
    last: number;
    from: number;
    turned: number;
    x0: number;
    y0: number;
    moved: boolean;
  } | null>(null);
  const cranked = useRef(false);
  /* ends a crank in flight, so an unmount mid-gesture leaves nothing bound */
  const end = useRef<() => void>(() => {});
  useEffect(() => () => end.current(), []);

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (grab.current) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const rect = stage.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + geo.cx;
    const cy = rect.top + geo.cy;

    armMarbles();
    setTip(false);
    cranked.current = false;
    grab.current = {
      id: event.pointerId,
      last: angleAt(event.clientX - cx, event.clientY - cy),
      from: advance.get(),
      turned: 0,
      x0: event.clientX,
      y0: event.clientY,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);

    const finish = (lift: boolean) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("blur", cancel);
      const was = grab.current;
      grab.current = null;
      held.current = false;
      end.current = () => {};
      setCranking(false);
      if (!was?.moved) {
        freeze(false);
        return;
      }
      /*
       * A release resolves to one of the two ends rather than parking where it
       * was let go. A menu left a third of the way out is not a state anyone
       * asked for, and the throw decides it when there is one: Motion's own
       * velocity, which reads zero once a value has been still for a frame or
       * two, so a hand that stopped before letting go is a placement.
       */
      const velocity = lift ? advance.getVelocity() : 0;
      const opening =
        velocity > FLICK
          ? true
          : velocity < -FLICK
            ? false
            : advance.get() > OPEN / 2;
      setOpen(opening);
      move(opening ? OPEN : 0, opening ? OUT : IN);
    };

    const onMove = (e: PointerEvent) => {
      const g = grab.current;
      if (!g || e.pointerId !== g.id) return;
      if (e.buttons === 0) {
        finish(false);
        return;
      }
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const angle = angleAt(dx, dy);
      /* a hand passing near the centre has no bearing to report, so it turns
         nothing rather than spinning the strand through half a lap */
      const near = Math.hypot(dx, dy) < geo.r * DEAD;
      const turn = near ? 0 : ((angle - g.last + Math.PI * 3) % LAP) - Math.PI;
      g.last = angle;
      /* accumulated from the press rather than from the moment the crank
         engages, so the slop costs the leader no ground */
      g.turned += turn;
      if (!g.moved) {
        if (Math.hypot(e.clientX - g.x0, e.clientY - g.y0) < SLOP) return;
        g.moved = true;
        cranked.current = true;
        held.current = true;
        running.current?.stop();
        running.current = null;
        freeze(true);
        setCranking(true);
        peeking.current = false;
        armed.current = false;
      }
      advance.set(clamp(g.from + g.turned));
      run();
    };
    const up = (e: PointerEvent) => {
      if (grab.current && e.pointerId === grab.current.id) finish(true);
    };
    const cancel = () => finish(false);
    end.current = () => finish(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("blur", cancel);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const back = event.key === "ArrowLeft" || event.key === "ArrowUp";
    const on = event.key === "ArrowRight" || event.key === "ArrowDown";
    if (!back && !on) return;
    event.preventDefault();
    armMarbles();
    move(clamp(advance.get() + (on ? STEP : -STEP)), NUDGE);
  };

  /** picking one is what the menu is for: it is held, and the mouth says so */
  const pick = (i: number) => {
    setChosen(i);
    setOpen(false);
    peeking.current = false;
    armed.current = false;
    move(0, IN);
  };

  const label = open ? "Send the marbles back in" : "Fan the marbles out";
  const ring = chosen === null ? null : BUBBLES[chosen].mark;

  return (
    <TooltipProvider delayDuration={200} skipDelayDuration={0}>
      <div
        ref={stage}
        data-crank={cranking || undefined}
        /* the crank's cursor is written on the stage and repeated on its
             descendants, since the plus declares its own and an inherited
             value loses to a declared one, which is `sticker-peel`'s pair */
        className="relative aspect-8/5 min-h-78 w-full select-none overflow-hidden rounded-lg bg-fill ring-1 ring-stroke ring-inset data-[crank]:cursor-grabbing data-[crank]:[&_*]:cursor-grabbing"
      >
        {/* the mouth. It paints over the marbles, so they come out from
              behind it and file back in behind it, and the scale ramp is the
              arc each one spends inside it.

              It sits before them in the tree and over them by `z-10`, since
              the two orders are not the same question: what a reader tabs into
              first is the trigger, and what paints last is the thing hiding
              the mouth */}
        <Tooltip
          label={label}
          side="bottom"
          open={tip}
          onOpenChange={(v) => setTip(v && !grab.current)}
        >
          <button
            type="button"
            aria-expanded={open}
            aria-controls={listId}
            aria-label={label}
            onPointerDown={onPointerDown}
            onPointerEnter={peekIn}
            onPointerLeave={peekOut}
            onKeyDown={onKeyDown}
            onClick={() => {
              if (cranked.current) {
                cranked.current = false;
                return;
              }
              armMarbles();
              toggle();
            }}
            style={{
              width: geo.button * 2,
              height: geo.button * 2,
              transform: `translate3d(${geo.cx - geo.button}px, ${geo.buttonY - geo.button}px, 0)`,
            }}
            className="group absolute top-0 left-0 z-10 block cursor-pointer touch-none rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2"
          >
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-full bg-text-primary"
              style={{
                boxShadow: ring
                  ? `0 0 0 2px ${ring}, 0 ${geo.button * 0.08}px ${geo.button * 0.2}px rgba(0,0,0,0.16)`
                  : `0 ${geo.button * 0.08}px ${geo.button * 0.2}px rgba(0,0,0,0.16)`,
              }}
            />
            {/* the light on it, and the two washes hover and press step
                  through. White at alpha over a dark face, never a fill token,
                  and the step in is instant where only the step back is timed.
                  The hover wash is paired with `aria-expanded`, since a trigger
                  that lets go while its menu is open is a bug */}
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-full"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 36% 22%, rgba(255,255,255,0.12), rgba(255,255,255,0) 64%)",
              }}
            />
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-full opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-aria-expanded:opacity-100"
              style={{ backgroundColor: "rgba(255,255,255,0.09)" }}
            />
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-full opacity-0 transition-opacity duration-200 group-active:opacity-100 group-active:duration-0"
              style={{ backgroundColor: "rgba(255,255,255,0.11)" }}
            />
            {/* the plus, drawn rather than imported: it is part of a face
                  sized by the stage, so its weight is a share of the button and
                  not an icon's stroke, and turning it 45 degrees is the cross
                  for free */}
            <span
              aria-hidden="true"
              className={cn(
                "absolute inset-0 grid place-items-center transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
                open && "rotate-45",
              )}
            >
              <span
                className="absolute rounded-full bg-bg"
                style={{
                  width: geo.button * 0.62,
                  height: geo.button * 0.09,
                }}
              />
              <span
                className="absolute rounded-full bg-bg"
                style={{
                  width: geo.button * 0.09,
                  height: geo.button * 0.62,
                }}
              />
            </span>
          </button>
        </Tooltip>

        <div
          ref={layer}
          id={listId}
          className="absolute inset-0 z-0"
          inert={!open}
        >
          {BUBBLES.map((bubble, i) => {
            const r = geo.bubble[i];
            return (
              <Tooltip key={bubble.marble} label={bubble.name}>
                <button
                  type="button"
                  aria-label={bubble.name}
                  aria-pressed={chosen === i}
                  onClick={() => pick(i)}
                  ref={(node) => {
                    beads.current[i] = node;
                  }}
                  style={{ width: r * 2, height: r * 2 }}
                  className="group absolute top-0 left-0 block cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2"
                >
                  {/* the ball. The lift lives here rather than on the button,
                        since a ring is a box-shadow too and an inline one
                        replaces it */}
                  <span
                    className="relative block size-full overflow-hidden rounded-full transition-transform duration-200 group-hover:scale-105 group-focus-visible:scale-105"
                    style={{
                      boxShadow: shell(r, chosen === i ? bubble.mark : null),
                    }}
                  >
                    <svg
                      viewBox="0 0 100 100"
                      aria-hidden="true"
                      focusable="false"
                      className="block size-full"
                    >
                      <bubble.Art />
                    </svg>
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 rounded-full"
                      style={{ backgroundImage: GLASS }}
                    />
                  </span>
                </button>
              </Tooltip>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}
