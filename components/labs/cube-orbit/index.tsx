"use client";

import {
  ArrowCounterClockwiseIcon,
  ArrowsLeftRightIcon,
} from "@phosphor-icons/react";
import {
  animate,
  useInView,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TextMorph } from "torph/react";
import { FOCUS, Pill } from "@/components/lab/controls";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  COLOURS,
  cyclesOf,
  orbitOf,
  orderOf,
  permutationOf,
  prime,
  returnsOf,
  SEQUENCES,
} from "./cube";
import { AUDIBLE, armDial, playDetent, playHome } from "./dial-sound";
import {
  CUBE,
  CUBE_BOX,
  DIAL,
  dotFor,
  FACES,
  NOTE,
  nodeAt,
  radiusAt,
  STAGE,
  spacingFor,
} from "./layout";

/*
 * A Rubik's cube walked round its own cycle.
 *
 * Repeat a sequence of turns and the cube comes back to solved. The number of
 * repetitions it takes is not a fact about Rubik's cubes but a fact about the
 * sequence: every permutation splits into disjoint cycles, a cycle of length L
 * is home every L repetitions, so the whole cube is home at the least common
 * multiple of its cycles' lengths.
 *
 * **The dial is those cycles, one ring each, and a ring's rotation is the
 * permutation rather than a picture of it.** The stickers of a cycle are fixed
 * to their ring in the order the sequence sends them, so turning the ring by one
 * notch moves every one of them to where the sequence would have put it. That is
 * why the dial and the net can never disagree: they are the same arithmetic, and
 * nothing here animates a cube turning and then checks the answer.
 *
 * **Everything a reader has to be told is told in words.** The demo used to
 * report `cycles 4, 4, 4, 4, 4`, `order 4` and `home`, which is three pieces of
 * jargon for a reader who had not been told the premise, and the premise is the
 * whole surprise. One sentence under the stage carries it now, the sequence
 * control sits inside that sentence, and what a ring is arrives on demand when
 * one is pointed at. See CLAUDE.md.
 *
 * `cube.ts` is the permutation model, `layout.ts` the geometry, both pure, which
 * is the split `document-pocket` makes with `poses.ts`.
 */

/** The dial's grab region, a little outside the lap arc. */
const REACH = DIAL.arc + 10;

/** How far a flick carries, and how long the slowest one takes to stop. */
const COAST = { seconds: 0.36, max: 70, ease: [0.16, 1, 0.3, 1] } as const;

/**
 * A lap, which is one tween however far it has to go.
 *
 * The distance is 4 repetitions on one sequence and 1260 on another, so a fixed
 * rate is either a demo that is over before it starts or one that runs for two
 * minutes. A fixed duration with a hard landing reads the same at both: the
 * rings spin up, blur, and drop onto the index line one after another, and the
 * last notch is the part worth watching.
 */
const RUN = { min: 1.4, per: 0.03, max: 5.5, ease: [0.5, 0, 0.1, 1] } as const;

/** How long after the demo scrolls into view it plays itself once. */
const AUTOPLAY = 700;

/**
 * Opening the cube out into its net, and closing it back up.
 *
 * The drawer curve, which leaves at more than twice its own average speed: what
 * starts the fold is a pointer arriving on a ring, and an ease that begins flat
 * reads as the cube thinking about it. Folding back is quicker than opening,
 * since it is the demo tidying up rather than answering.
 */
const FOLD = {
  open: 0.52,
  shut: 0.4,
  ease: [0.32, 0.72, 0, 1],
} as const;

/**
 * How many of the lap's marks are drawn.
 *
 * Every repetition that puts something back gets one where there is room. Past
 * this the highest are kept, since a lap of 1260 with a two-cycle in it returns
 * something on every second step and 630 hairlines round a 600 unit circle is a
 * grey band rather than a reading.
 */
const MARKS = 170;

/** Speed, in repetitions a second, past which the drawing starts to smear. */
const SMEAR = { from: 7, per: 0.024, max: 4.4 } as const;

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));
const mod = (a: number, n: number) => ((a % n) + n) % n;

export default function CubeOrbit() {
  const reduce = useReducedMotion();
  const [pick, setPick] = useState(0);
  const [running, setRunning] = useState(false);
  /**
   * Where the dial came to rest.
   *
   * Only `settle` writes it, so a drag across seventy repetitions is one render
   * rather than seventy. It exists for the one question a per-frame DOM write
   * cannot answer, which is whether the control that goes back to solved has
   * anything left to do, and that is only ever asked of a dial standing still.
   */
  const [step, setStep] = useState(0);

  const sequence = SEQUENCES[pick];

  /*
   * Everything the drawing needs, walked once when the sequence changes. The
   * orbit is at most 1260 arrangements of 54 bytes, so scrubbing the dial is a
   * lookup rather than a chain of permutations applied per frame.
   */
  const plan = useMemo(() => {
    const perm = permutationOf(sequence);
    const cycles = cyclesOf(perm);
    const order = orderOf(cycles);
    return {
      cycles,
      order,
      orbit: orbitOf(perm, order),
      /*
       * The lap's own marks: a tick at every repetition that puts part of the
       * cube back, as long as it is one of them, sized by how much.
       */
      marks: (() => {
        const home = returnsOf(cycles, order);
        const at: number[] = [];
        for (let k = 1; k < order; k++) if (home[k]) at.push(k);
        at.sort((a, b) => home[b] - home[a]);
        const top = Math.max(1, ...at.map((k) => home[k]));
        return at
          .slice(0, MARKS)
          .map((k) => {
            const angle = ((-90 + (k * 360) / order) * Math.PI) / 180;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const out =
              DIAL.tick.base + DIAL.tick.min + DIAL.tick.max * (home[k] / top);
            return `M${(DIAL.cx + DIAL.tick.base * cos).toFixed(2)} ${(DIAL.cy + DIAL.tick.base * sin).toFixed(2)}L${(DIAL.cx + out * cos).toFixed(2)} ${(DIAL.cy + out * sin).toFixed(2)}`;
          })
          .join("");
      })(),
      /** which cycle each facelet belongs to, for the ring a pointer is on */
      owner: cycles.reduce((out, cycle, i) => {
        for (const slot of cycle) out[slot] = i;
        return out;
      }, new Int8Array(54).fill(-1)),
    };
  }, [sequence]);

  /** repetitions, fractional while the dial is being turned */
  const pos = useMotionValue(0);
  /** 1 is a cube and 0 is its net, and one number drives every hinge */
  const fold = useMotionValue(1);
  /** the reader has asked for the net, and it stays out until they say so */
  const [pinned, setPinned] = useState(false);

  const stage = useRef<HTMLDivElement>(null);
  const grip = useRef<HTMLDivElement>(null);
  const rings = useRef<(SVGGElement | null)[]>([]);
  const tracks = useRef<(SVGCircleElement | null)[]>([]);
  const stickers = useRef<(HTMLDivElement | null)[]>([]);
  const netBox = useRef<HTMLDivElement>(null);
  const dotBox = useRef<SVGGElement>(null);
  const lap = useRef<SVGCircleElement>(null);
  const cube = useRef<HTMLButtonElement>(null);
  const count = useRef<SVGTextElement>(null);
  const counter = useRef<SVGGElement>(null);
  const togo = useRef<SVGTextElement>(null);
  const done = useRef<SVGTextElement>(null);
  const note = useRef<HTMLParagraphElement>(null);

  /** what is already on screen, so a frame only writes what changed */
  const painted = useRef({ step: -1, blur: -1, lit: -1 });
  /** the colours already on the net, so a frame writes only what moved */
  const shown = useRef(new Uint8Array(54).fill(255));
  /** the last frame this painted, which is where the smear's speed comes from */
  const was = useRef({ k: 0, at: 0, step: -1 });
  const turning = useRef<{ angle: number } | null>(null);
  const flight = useRef<ReturnType<typeof animate> | null>(null);

  const stop = useCallback(() => {
    flight.current?.stop();
    flight.current = null;
    setRunning(false);
  }, []);

  /**
   * One frame: every ring's rotation and the lap arc, and, when the nearest
   * notch has changed, the net and the count.
   *
   * Nothing in here renders. A ring is one `transform`, the arc is one dash
   * offset, a sticker is one `fill` and only if its colour moved, which is the
   * bar `book-opening` and the signature player set.
   */
  const paint = useCallback(() => {
    const k = pos.get();

    for (let i = 0; i < plan.cycles.length; i++) {
      const ring = rings.current[i];
      if (!ring) continue;
      const turn = (k * 360) / plan.cycles[i].length;
      ring.setAttribute(
        "transform",
        `rotate(${turn.toFixed(3)} ${DIAL.cx} ${DIAL.cy})`,
      );
    }

    /* the arc is `pathLength="1"` with a dash of 1 and a gap of 1, so an offset
       of one whole length hides it and an offset of zero fills it */
    lap.current?.setAttribute(
      "stroke-dashoffset",
      (1 - mod(k, plan.order) / plan.order).toFixed(4),
    );

    /*
     * **The smear is what makes a fast run watchable rather than a strobe.** A
     * run of 1260 repetitions in five seconds repaints all 54 stickers on every
     * frame, and a full-field colour change at 60Hz is both unreadable and the
     * kind of flashing nobody asked to look at. Blurring by speed turns it into
     * the wash a spinning thing actually looks like, and it costs one filter.
     *
     * **The speed is this frame against the last one, never the motion value's
     * own velocity, and that was a bug worth keeping.** Motion works a velocity
     * out from the frame before, so a `set` that lands after a long idle divides
     * a real change by a 30ms floor and reports a value that never happened: a
     * sequence swap sets the dial back to zero from wherever it was left, which
     * read as 400 repetitions a second and pinned the blur at its maximum for
     * as long as the drawing sat still. A frame's own delta cannot say that.
     */
    const now = performance.now();
    const gap = Math.max(now - was.current.at, 8);
    const speed = (Math.abs(k - was.current.k) / gap) * 1000;
    was.current.k = k;
    was.current.at = now;
    const blur = clamp((speed - SMEAR.from) * SMEAR.per, 0, SMEAR.max);
    if (Math.abs(blur - painted.current.blur) > 0.05) {
      painted.current.blur = blur;
      const filter = blur < 0.06 ? "none" : `blur(${blur.toFixed(2)}px)`;
      if (netBox.current) netBox.current.style.filter = filter;
      if (dotBox.current) dotBox.current.style.filter = filter;
    }

    const at = mod(Math.round(k), plan.order);
    if (at === painted.current.step) return;
    painted.current.step = at;

    const state = plan.orbit[at];
    for (let i = 0; i < 54; i++) {
      if (state[i] === shown.current[i]) continue;
      shown.current[i] = state[i];
      const cell = stickers.current[i];
      if (cell) cell.style.backgroundColor = COLOURS[state[i]];
    }

    if (count.current) count.current.textContent = String(at);
    /*
     * **The label under the count is how far is left, not the unit.** Both ways
     * home are then on screen at once: the count is how far back solved is
     * behind you and this is how far on it is ahead, which is the whole of the
     * shortest path on a cycle. `repeats` was a word that said nothing the
     * sentence under the stage had not already said.
     */
    if (togo.current) togo.current.textContent = `${plan.order - at} to go`;
    /*
     * **The count and the word are two elements that trade places, never one
     * label that changes.** A `0` with `solved` under it reads as "zero
     * solved", which is the opposite of what has happened, and at rest the
     * count is zero and carries nothing anyway. So arriving is the number
     * being replaced by the word, which is also the only thing that marks it.
     */
    if (counter.current) counter.current.style.opacity = at ? "1" : "0";
    if (done.current) done.current.style.opacity = at ? "0" : "1";

    /* a click a notch while the dial is being turned at a pace a click can
       belong to, and the tone only on the one arrival worth marking */
    if (was.current.step >= 0) {
      if (!at) playHome();
      else if (speed < AUDIBLE) playDetent(at / plan.order);
    }
    was.current.step = at;
    grip.current?.setAttribute("aria-valuenow", String(at));
    grip.current?.setAttribute(
      "aria-valuetext",
      at ? `${at} repeats, ${plan.order - at} from solved` : "solved",
    );
  }, [plan, pos]);

  useEffect(() => pos.on("change", paint), [paint, pos]);

  /* one property per frame while it folds, and nothing renders */
  useEffect(
    () =>
      fold.on("change", (v) =>
        cube.current?.style.setProperty("--fold", v.toFixed(4)),
      ),
    [fold],
  );

  /**
   * Show the net, or put the cube back.
   *
   * **Pressing the cube is the only thing that folds it, and that was a
   * correction.** Pointing at a ring used to unfold it too, on the grounds that
   * a ring's stickers are spread over all six faces. What that missed is that
   * the dial is also the drag surface and the only keyboard target on the
   * stage, so reaching it with a mouse at all, which is what focusing it takes,
   * unfolded the cube, and any twitch of the hand afterwards unfolded it again.
   * The bands of the rings meet, so there is no part of the dial that was not
   * also a trigger. A control's own job has to survive being approached.
   */
  const flatten = useCallback(
    (flat: boolean) => {
      const want = flat ? 0 : 1;
      if (fold.get() === want) return;
      animate(
        fold,
        want,
        reduce
          ? { duration: 0 }
          : { duration: flat ? FOLD.open : FOLD.shut, ease: FOLD.ease },
      );
    },
    [fold, reduce],
  );

  /** the one place the drawing is told a flight is over, so the smear clears */
  const settle = useCallback(() => {
    painted.current.blur = -1;
    paint();
    setStep(painted.current.step);
    if (netBox.current) netBox.current.style.filter = "none";
    if (dotBox.current) dotBox.current.style.filter = "none";
    painted.current.blur = 0;
  }, [paint]);

  /**
   * Light one cycle: its stickers on the net, its own track, and a line saying
   * what it is.
   *
   * This is the only thing joining the two drawings, and it is what replaced a
   * permanent `cycles 15, 7, 7, 3`. A ring is twelve dots on a circle until you
   * can see which twelve squares of the cube they are, and the count is worth
   * nothing until it is attached to the thing it counts.
   */
  const light = useCallback(
    (index: number) => {
      if (index === painted.current.lit) return;
      painted.current.lit = index;
      for (let i = 0; i < 54; i++) {
        const dim = index >= 0 && plan.owner[i] !== index;
        const node = stickers.current[i];
        // the property rather than the presentation attribute, or the
        // `transition-opacity` beside it has nothing to transition
        if (node) node.style.opacity = dim ? "0.22" : "1";
      }
      /* the ring's own dots stay lit with its stickers, so what the pointer
         picks out is one loop and the squares it holds rather than a loop on
         its own. Without it the net says "these four" and the dial says
         nothing about which four dots it meant. */
      for (let i = 0; i < plan.cycles.length; i++) {
        tracks.current[i]?.setAttribute(
          "stroke-opacity",
          i === index ? "0.8" : "0.42",
        );
        const ring = rings.current[i];
        if (ring) ring.style.opacity = index >= 0 && i !== index ? "0.26" : "1";
      }
      if (note.current) {
        const size = index >= 0 ? plan.cycles[index].length : 0;
        note.current.textContent = size
          ? `${size} stickers, back every ${size} repeats`
          : "";
        note.current.style.opacity = size ? "1" : "0";
      }
    },
    [plan],
  );

  /*
   * A fresh sequence is a fresh cube, and the dial goes back to the top.
   *
   * The highlight has to be cleared rather than forgotten. A ring's stickers
   * belong to the sequence that drew them, so a `lit` left at its old index
   * refuses the very call that puts the net back, and the cube keeps two thirds
   * of itself dimmed under a set of rings that no longer holds it.
   */
  useEffect(() => {
    stop();
    pos.set(0);
    painted.current = { step: -1, blur: -1, lit: -2 };
    shown.current.fill(255);
    was.current = { k: 0, at: performance.now(), step: -1 };
    light(-1);
    settle();
  }, [light, pos, settle, stop]);

  /** Forward to the next repetition on which the cube is solved. */
  const runFrom = useCallback(
    (from: number) => {
      const target = from + (mod(plan.order - from, plan.order) || plan.order);
      setRunning(true);
      flight.current = animate(pos, target, {
        duration: clamp((target - from) * RUN.per, RUN.min, RUN.max),
        ease: RUN.ease,
        onComplete: () => {
          setRunning(false);
          settle();
        },
      });
    },
    [plan.order, pos, settle],
  );

  /*
   * **It plays itself once when it scrolls into view**, which is the signature
   * player's call and for its reason: without it the demo is two diagrams
   * sitting still, and a reader has no way to know that either of them moves or
   * what pressing anything would do. One lap on the opening sequence is four
   * repetitions and about a second and a half, so what a reader is shown is the
   * whole claim rather than a sample of it.
   *
   * **The autoplay is gated and the controls are not**, which is exactly the
   * line: a press is a request and an autoplay is not. It waits for the
   * preference to resolve rather than reading `null` as "no", since the hook
   * returns null until it has an answer.
   */
  const seen = useInView(stage, { once: true, amount: 0.6 });
  const played = useRef(false);
  useEffect(() => {
    if (!seen || played.current || reduce !== false) return;
    played.current = true;
    const id = window.setTimeout(() => runFrom(0), AUTOPLAY);
    return () => window.clearTimeout(id);
  }, [seen, reduce, runFrom]);

  /** Where the pointer is on the dial, as an angle and a radius in stage units. */
  const readPointer = (event: { clientX: number; clientY: number }) => {
    const box = grip.current?.getBoundingClientRect();
    if (!box) return null;
    const dx = event.clientX - (box.left + box.width / 2);
    const dy = event.clientY - (box.top + box.height / 2);
    return {
      angle: Math.atan2(dy, dx),
      radius: (Math.hypot(dx, dy) / (box.width / 2)) * REACH,
    };
  };

  /**
   * A turn of the dial is a turn of the outer ring, notch for notch.
   *
   * One repetition is one notch of the largest cycle, so a hand that grabs a
   * sticker on the outer ring and drags it to the next slot has applied the
   * sequence once. Every inner ring is turning faster than the hand, which is
   * the whole picture: they come home more often, and the cube only comes home
   * when they all do at once.
   */
  const notch = () => (Math.PI * 2) / plan.cycles[0].length;

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const at = readPointer(event);
    if (!at) return;
    armDial();
    stop();
    light(-1);
    event.currentTarget.setPointerCapture(event.pointerId);
    turning.current = { angle: at.angle };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const at = readPointer(event);
    if (!at) return;

    /* a move with nothing held ends a turn whose lift was never heard, which is
       nib's rule: a window that loses focus mid-drag sends no `pointerup`, and
       a dial that keeps turning under a hand that is no longer down is worse
       than one that lets go early */
    if (turning.current && event.buttons === 0) {
      onPointerUp();
      return;
    }

    const held = turning.current;

    /*
     * **A hand on the dial is turning it, not reading it, so the highlight is
     * off for as long as one is down.** It dims five sixths of the cube, and a
     * drag is the one moment the whole cube is worth watching: left on, the net
     * goes dark for the length of every turn and the churn that is the point of
     * the gesture happens behind it.
     *
     * It comes back on the next move rather than on the release, and that falls
     * out of there being no move event to answer. A pointer left where it was is
     * a pointer that did not hover anything, which is `stamp-collection`'s call
     * for a stamp arriving under a hand that never moved.
     *
     * Hover is a hovering pointer's, `folder-stack`'s gate: a finger has no way
     * to take a highlight back, so a tap would leave one on screen for good.
     */
    if (!held && event.pointerType !== "touch") {
      const band = spacingFor(plan.cycles.length) / 2 || DIAL.dot * 2;
      const index = plan.cycles.findIndex(
        (_, i) => Math.abs(at.radius - radiusAt(i, plan.cycles.length)) <= band,
      );
      light(index);
    }

    if (!held) return;
    let delta = at.angle - held.angle;
    /* the shortest way round, or crossing the top of the dial is a whole lap */
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    held.angle = at.angle;
    pos.set(pos.get() + delta / notch());
  };

  /**
   * Letting go coasts to a notch and stops on it.
   *
   * A dial with detents does not rest between two of them, so the flick's
   * target is rounded before it is animated to rather than snapped to
   * afterwards: two animations in a row is a coast and then a correction, and
   * the correction is the part a reader sees.
   */
  const onPointerUp = () => {
    if (!turning.current) return;
    turning.current = null;
    const at = pos.get();
    if (reduce) {
      pos.set(Math.round(at));
      settle();
      return;
    }
    const carried = clamp(
      pos.getVelocity() * COAST.seconds,
      -COAST.max,
      COAST.max,
    );
    const target = Math.round(at + carried);
    flight.current = animate(pos, target, {
      duration: clamp(Math.abs(target - at) * 0.045, 0.22, 1.6),
      ease: COAST.ease,
      onComplete: settle,
    });
  };

  const nudge = (by: number) => {
    stop();
    const target = Math.round(pos.get()) + by;
    if (reduce) {
      pos.set(target);
      settle();
      return;
    }
    flight.current = animate(pos, target, {
      duration: 0.22,
      ease: COAST.ease,
      onComplete: settle,
    });
  };

  /**
   * Run a lap, or stop one.
   *
   * **Under reduced motion it applies the sequence once instead, and the label
   * says so.** A lap that arrives in one step is a lap from solved back to
   * solved, which is a control that visibly does nothing, and a demo whose one
   * control does nothing is not a demo: that is `flip-clock`'s line about a
   * clock that does not change. One repetition is the same claim with no travel
   * in it at all, and it is the better half of the claim anyway, since what a
   * press shows is every ring stepping one notch at once.
   */
  const run = () => {
    if (reduce) {
      nudge(1);
      return;
    }
    if (running) {
      stop();
      settle();
      return;
    }
    runFrom(Math.round(pos.get()));
  };

  const home = () => {
    stop();
    const at = pos.get();
    const target = Math.round(at) - mod(Math.round(at), plan.order);
    if (reduce || Math.abs(target - at) < 0.001) {
      pos.set(target);
      settle();
      return;
    }
    flight.current = animate(pos, target, {
      duration: clamp(Math.abs(target - at) * 0.03, 0.3, 1.1),
      ease: COAST.ease,
      onComplete: settle,
    });
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const by =
      event.key === "ArrowRight" || event.key === "ArrowUp"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowDown"
          ? -1
          : event.key === "PageUp"
            ? 10
            : event.key === "PageDown"
              ? -10
              : 0;
    if (by) {
      event.preventDefault();
      nudge(by);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      home();
    }
  };

  return (
    <div className="flex w-full flex-col">
      {/* the picture. `select-none` because every gesture here is a drag across
          a diagram, and one that misses paints a selection over it. */}
      <div
        ref={stage}
        className="@container relative w-full select-none overflow-hidden rounded-t-lg bg-bg ring-1 ring-stroke ring-inset"
      >
        <svg
          viewBox={`0 0 ${STAGE.w} ${STAGE.h}`}
          className="block aspect-8/5 w-full"
          role="img"
          aria-label={`${plan.cycles.length} rings, one per cycle of the sequence ${sequence}`}
        >
          {/*
           * The lap: the arc that gives the count a scale, since a number
           * running to 1260 says nothing about how far along it is, and inside
           * it the marks that say the lap is not featureless. A tick stands at
           * every repetition that puts part of the cube back and is as long as
           * the part is big, so the arc sweeps past them and the cube visibly
           * half-assembles on the ones that matter.
           */}
          <g>
            <path
              d={plan.marks}
              stroke="var(--color-text-muted)"
              strokeOpacity={0.4}
              strokeWidth={1.2}
              fill="none"
            />
            <circle
              cx={DIAL.cx}
              cy={DIAL.cy}
              r={DIAL.arc}
              fill="none"
              /* quiet but present, which is what a track is: the fill running
                 round it is the content and this only has to say where it will
                 run */
              stroke="var(--color-stroke-strong)"
              strokeWidth={2.5}
            />
            <circle
              ref={lap}
              cx={DIAL.cx}
              cy={DIAL.cy}
              r={DIAL.arc}
              fill="none"
              /*
               * **The arc is `text-muted`, which is the quietest tone that
               * still reads as a filled arc.** It went near-black first and
               * then `text-secondary`, and both made a readout the loudest
               * thing in a drawing whose subject is six colours. At 2.85:1 on
               * white it is a soft grey against a `stroke-strong` track, which
               * is all the separation a lap needs, and the cube keeps the eye.
               */
              stroke="var(--color-text-muted)"
              strokeWidth={2.5}
              pathLength={1}
              strokeDasharray="1 1"
              strokeDashoffset={1}
              /* butt rather than round, or a lap at zero paints a dot at the
                 top where there is nothing to report */
              strokeLinecap="butt"
              transform={`rotate(-90 ${DIAL.cx} ${DIAL.cy})`}
            />
          </g>

          {/* the index line, and the caret that says where a lap starts and
              ends. Quiet along its length, since what has to read is the dots
              sitting on it, and firm at the top. */}
          <g>
            <line
              x1={DIAL.cx}
              y1={DIAL.cy - DIAL.outer}
              x2={DIAL.cx}
              y2={DIAL.cy}
              stroke="var(--color-stroke-strong)"
              strokeWidth={1}
            />
            <path
              d={`M${DIAL.cx - 4.5} ${DIAL.cy - DIAL.caret - 8} L${DIAL.cx} ${DIAL.cy - DIAL.caret} L${DIAL.cx + 4.5} ${DIAL.cy - DIAL.caret - 8} Z`}
              fill="var(--color-text-secondary)"
            />
          </g>

          {/* one track per cycle, largest outermost */}
          <g>
            {plan.cycles.map((cycle, i) => (
              <circle
                key={`${sequence}-track-${cycle[0]}`}
                ref={(node) => {
                  tracks.current[i] = node;
                }}
                cx={DIAL.cx}
                cy={DIAL.cy}
                r={radiusAt(i, plan.cycles.length)}
                fill="none"
                /* `stroke-strong` is 1.27:1 on white and a ring of it at this
                   width is not there. The tracks are the graph's own edges
                   rather than chrome, so they take the muted tone at alpha and
                   the one under the pointer takes it whole. */
                stroke="var(--color-text-muted)"
                strokeOpacity={0.42}
                strokeWidth={1.1}
                className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
              />
            ))}
          </g>

          {/*
           * The stickers on their rings.
           *
           * A dot carries the colour of the facelet that starts in its slot, and
           * the group turns as one, so after k repetitions the dot standing in
           * slot j holds whatever the sequence has moved into it. The rotation
           * is not an illustration of the permutation, it is the permutation.
           *
           * The rotating group is its own element, under a group that carries
           * the smear: a per-frame `transform` write and a CSS transition on the
           * same node is the split `crack-button` and `stem-picker` document.
           */}
          <g ref={dotBox}>
            {plan.cycles.map((cycle, i) => (
              <g
                key={`${sequence}-ring-${cycle[0]}`}
                ref={(node) => {
                  rings.current[i] = node;
                }}
              >
                <g className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
                  {cycle.map((slot, j) => {
                    const at = nodeAt(
                      radiusAt(i, plan.cycles.length),
                      j,
                      cycle.length,
                    );
                    const r = dotFor(plan.cycles.length);
                    return (
                      <circle
                        key={slot}
                        cx={at.x}
                        cy={at.y}
                        r={j === 0 ? r * 1.24 : r}
                        fill={COLOURS[(slot / 9) | 0]}
                        /*
                         * **The mark on a home dot is a step in the same grey,
                         * never a near-black rim.** At `text-primary` the four
                         * to six of them stacked on the index line at rest were
                         * a dark column down the middle of the dial, which is
                         * the heaviest thing in a drawing whose subject is the
                         * colours. `text-secondary` against the other dots'
                         * `text-muted`, at half a pixel more, is a step that
                         * reads without becoming ink.
                         */
                        stroke={
                          j === 0
                            ? "var(--color-text-secondary)"
                            : "var(--color-text-muted)"
                        }
                        strokeWidth={j === 0 ? 1.4 : 1}
                      />
                    );
                  })}
                </g>
              </g>
            ))}
          </g>

          {/* the count, in the hole the innermost ring leaves, and the word
              that takes its place when the cube is home */}
          <g>
            <g
              ref={counter}
              className="opacity-0 transition-opacity duration-200"
            >
              <text
                ref={count}
                x={DIAL.cx}
                y={DIAL.cy + 1}
                textAnchor="middle"
                className="tabular-nums"
                fontSize={24}
                fontWeight={500}
                fill="var(--color-text-primary)"
              >
                0
              </text>
              <text
                ref={togo}
                x={DIAL.cx}
                y={DIAL.cy + 17}
                textAnchor="middle"
                className="tabular-nums"
                fontSize={12}
                fill="var(--color-text-muted)"
              />
            </g>
            <text
              ref={done}
              x={DIAL.cx}
              y={DIAL.cy + 5}
              textAnchor="middle"
              className="transition-opacity duration-200"
              fontSize={15}
              fontWeight={500}
              fill="var(--color-text-primary)"
            >
              solved
            </text>
          </g>
        </svg>

        {/*
         * The cube, which is the net and the net is the cube.
         *
         * **A button, because pressing it is how a reader keeps the net out**,
         * and because that is the whole of the touch path: a finger has no
         * hover to open it with. `aria-pressed` carries the pin rather than the
         * peek, since the peek is the pointer's and not a state anyone chose.
         *
         * It is HTML and not part of the SVG, because CSS is the only thing on
         * this page that can fold paper: `transform-style: preserve-3d` has no
         * meaning inside an `<svg>`. Everything in it is sized as a share of
         * the stage, so it scales with the drawing beside it.
         */}
        <button
          type="button"
          onClick={() => {
            setPinned(!pinned);
            flatten(!pinned);
          }}
          aria-pressed={pinned}
          aria-label={pinned ? "Fold the cube up" : "Unfold the cube flat"}
          ref={cube}
          className={cn(
            "absolute cursor-pointer rounded-lg",
            /* a long lens rather than a wide one: at 22 faces back the cube's far
               edge converged hard enough to read as a fish-eye, and a cube is a
               thing people have seen photographed */
            "[--depth:calc(var(--block)*34)]",
            FOCUS,
          )}
          style={
            {
              left: `${((CUBE.cx - CUBE_BOX.w / 2) / STAGE.w) * 100}%`,
              top: `${((CUBE.cy - CUBE_BOX.h / 2) / STAGE.h) * 100}%`,
              width: `${(CUBE_BOX.w / STAGE.w) * 100}%`,
              height: `${(CUBE_BOX.h / STAGE.h) * 100}%`,
              "--block": `${(CUBE.block / STAGE.w) * 100}cqw`,
              "--fold": 1,
            } as React.CSSProperties
          }
        >
          {/*
           * One transform carries the camera: the net's own offset from the
           * front face, how much bigger a folded cube has to be to hold the
           * footprint its net had, and the angle three faces show from. Every
           * one of them is the same `--fold`.
           */}
          {/*
           * **The smear goes on this box and never on the scene inside it.**
           * A `filter` makes its own element a grouping element, which forces
           * `transform-style` to compute to `flat`, so writing the blur onto
           * the element carrying the cube collapsed all six faces onto one
           * plane: a run showed a single 3x3 square and the cube came back the
           * frame the blur cleared. One wrapper between the two is the whole
           * fix, since flattening applies to the element that has the filter
           * and not to its descendants.
           */}
          <div ref={netBox} className="absolute inset-0">
            <div
              className="-translate-x-1/2 -translate-y-1/2 absolute top-1/2 left-1/2 transform-3d"
              style={{
                width: "var(--block)",
                height: "var(--block)",
                transform: [
                  "perspective(var(--depth))",
                  "translateX(calc(var(--block) * -0.5 * (1 - var(--fold))))",
                  `scale(calc(1 + ${CUBE.grow} * var(--fold)))`,
                  `rotateX(calc(${CUBE.view.x}deg * var(--fold)))`,
                  `rotateY(calc(${CUBE.view.y}deg * var(--fold)))`,
                  /* half a face forward along the front's own normal, which is
                   what centres the box rather than the face it is built out
                   from: a cube grows backward from its front, so left alone its
                   middle sits up and to the right of where the net's was, by a
                   measured 27px across and 17 up */
                  "translateZ(calc(var(--block) * 0.5 * var(--fold)))",
                ].join(" "),
              }}
            >
              <Face index={2} stickers={stickers} />
              <Face index={0} stickers={stickers} />
              <Face index={3} stickers={stickers} />
              <Face index={4} stickers={stickers} />
              {/* the back hangs off the right, which is where the paper puts it */}
              <Face index={1} stickers={stickers}>
                <Face index={5} stickers={stickers} />
              </Face>
            </div>
          </div>
        </button>

        {/*
         * What the ring under the pointer is, in words, where the stickers it
         * names are already lit. Absolute, so nothing in the strip moves when it
         * arrives, and anchored to its foot so it grows upward on a narrow
         * column rather than off the stage.
         */}
        <p
          ref={note}
          aria-hidden="true"
          /* balanced, because the caption is wider than the net it sits
             under and an unbalanced wrap leaves one word alone on a second
             line. Two even lines under a figure is a caption, a widow is not. */
          className="pointer-events-none absolute text-balance text-center text-meta text-text-secondary opacity-0 transition-opacity duration-200"
          style={{
            left: `${((CUBE.cx - NOTE.w / 2) / STAGE.w) * 100}%`,
            top: `${(NOTE.top / STAGE.h) * 100}%`,
            width: `${(NOTE.w / STAGE.w) * 100}%`,
          }}
        />

        {/*
         * The dial's own control, over the drawing.
         *
         * An HTML box rather than an SVG circle, since the project's focus ring
         * is a box-shadow and a box-shadow does not paint on an SVG element. It
         * is a percentage of the stage, and the stage and the viewBox are both
         * exactly 8:5, so it lands on the drawing at every width.
         *
         * `role="slider"`, because that is what a dial with detents is, and the
         * two numbers it reports are written to the node beside the drawing
         * rather than rendered: a drag is a value per frame and none of it is a
         * render.
         */}
        <div
          ref={grip}
          role="slider"
          tabIndex={0}
          aria-label={`Repetitions of ${sequence}`}
          aria-valuemin={0}
          aria-valuemax={plan.order - 1}
          aria-valuenow={step}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={() => light(-1)}
          onKeyDown={onKeyDown}
          className={cn(
            "absolute cursor-grab touch-none rounded-full active:cursor-grabbing",
            FOCUS,
          )}
          style={{
            left: `${((DIAL.cx - REACH) / STAGE.w) * 100}%`,
            top: `${((DIAL.cy - REACH) / STAGE.h) * 100}%`,
            width: `${((REACH * 2) / STAGE.w) * 100}%`,
            height: `${((REACH * 2) / STAGE.h) * 100}%`,
          }}
        />
      </div>

      {/* the frame is `flush`, so the stage runs to its edges and the strip
          under it carries its own padding, which is `ember-burst`'s build */}
      <div className="flex flex-col items-center gap-5 px-6 pt-5">
        <TooltipProvider delayDuration={200}>
          {/*
           * The claim, in one line, with the control that changes it inside it.
           *
           * This is the demo's entry point and it replaced three readouts that
           * named the mechanism before the reader had been told the premise. The
           * sequence picker lives in the sentence rather than in the row below,
           * so the thing being repeated is named once and is visibly the thing
           * the sentence is about. A flex row rather than prose with an inline
           * pill, since a real line box round a control is `InlineLink`'s
           * problem and this needs none of it.
           */}
          <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2 text-body text-text-secondary">
            <span>repeat</span>
            {/* the site's own mode selector: one control whose label is the
                current value, with two arrows saying a press swaps it, which is
                `book-opening`'s call. The sequence keeps its casing, since
                lowercase is a different turn in cube notation and this is data
                rather than copy. */}
            <Pill
              onClick={() => setPick((i) => (i + 1) % SEQUENCES.length)}
              label={`Change the sequence, now ${sequence}`}
              disabled={running}
            >
              <ArrowsLeftRightIcon aria-hidden="true" className="size-3" />
              <span className="[text-transform:none] font-mono">
                <TextMorph duration={200} ease="cubic-bezier(0.4, 0, 0.2, 1)">
                  {prime(sequence)}
                </TextMorph>
              </span>
            </Pill>
            <span>
              <span className="text-text-primary tabular-nums">
                {plan.order}
              </span>{" "}
              times and the cube solves itself
            </span>
          </p>

          <div className="flex items-center gap-2">
            {/* one width for both labels, since the row is centred and a pill
                that shrinks on press slides the control beside it. Under
                reduced motion the label never changes, so it sizes itself. */}
            <Pill
              onClick={() => {
                armDial();
                run();
              }}
              lead
            >
              <span
                className={cn(
                  "whitespace-nowrap text-center",
                  !reduce && "w-8",
                )}
              >
                {reduce ? "Repeat once" : running ? "Stop" : "Run"}
              </span>
            </Pill>

            <Tooltip label="Back to solved">
              <Pill
                onClick={home}
                label="Back to solved"
                icon
                disabled={running || step === 0}
              >
                <ArrowCounterClockwiseIcon
                  aria-hidden="true"
                  className="size-3.5"
                />
              </Pill>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>

      {/* the frame has no padding of its own, so this is the strip's foot */}
      <div className="h-7" />
    </div>
  );
}

/**
 * One face: nine stickers on a block of plastic, hinged to whatever it hangs
 * from in the net.
 *
 * **`backface-visibility: hidden` is what leaves exactly three faces showing
 * once it is folded**, which is `book-opening`'s call for its two boards. CSS
 * sorts planes by depth rather than by pixel, so without it the inside of the
 * far faces paints through the near ones and the cube is a box of ghosts.
 *
 * The hinge is one rotation about the edge the face already shares with its
 * parent, so nothing here computes a position: the paper's own layout is the
 * geometry.
 */
function Face({
  index,
  stickers,
  children,
}: {
  index: number;
  stickers: React.RefObject<(HTMLDivElement | null)[]>;
  children?: React.ReactNode;
}) {
  const face = FACES[index];
  const base = index * 9;
  const seat: React.CSSProperties =
    face.side === "top" || face.side === "bottom"
      ? { [face.side]: "100%", left: 0 }
      : face.side
        ? { [face.side]: "100%", top: 0 }
        : { top: 0, left: 0 };

  return (
    <div
      className="absolute grid grid-cols-3 backface-hidden transform-3d"
      style={{
        ...seat,
        width: "var(--block)",
        height: "var(--block)",
        padding: "calc(var(--block) * 0.065)",
        gap: "calc(var(--block) * 0.045)",
        borderRadius: "calc(var(--block) * 0.09)",
        // the one dark object on a light stage, which is the narrow use of the
        // inverse set `book-opening`'s boards take: a cube is a black plastic
        // thing, and a white sticker needs a ground
        backgroundColor: "var(--color-inverse-bg)",
        transformOrigin: face.origin,
        transform: face.deg
          ? `rotate${face.axis}(calc(${face.deg}deg * var(--fold)))`
          : undefined,
      }}
    >
      {Array.from({ length: 9 }, (_, i) => (
        <div
          // a facelet's place on its face is fixed, so its index is its key
          // biome-ignore lint/suspicious/noArrayIndexKey: a face is a fixed nine slots
          key={i}
          ref={(node) => {
            stickers.current[base + i] = node;
          }}
          className="transition-opacity duration-200"
          style={{
            borderRadius: "calc(var(--block) * 0.05)",
            backgroundColor: COLOURS[index],
          }}
        />
      ))}

      {/* the light on it, which fades out with the fold: six faces lying flat
          all point the same way and there is nothing for one to catch */}
      {face.shade !== 0 && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            borderRadius: "inherit",
            backgroundColor:
              face.shade > 0
                ? `rgb(255 255 255 / ${face.shade})`
                : `rgb(0 0 0 / ${-face.shade})`,
            opacity: "var(--fold)",
          }}
        />
      )}
      {children}
    </div>
  );
}
