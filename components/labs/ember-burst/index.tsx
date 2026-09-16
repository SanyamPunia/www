"use client";

import { FlameIcon, SlidersHorizontalIcon } from "@phosphor-icons/react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useVelocity,
} from "motion/react";
import type React from "react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { type Knob, Panel, Pill } from "@/components/lab/controls";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { approach } from "@/lib/lerp";
import { cn } from "@/lib/utils";
import {
  type Body,
  buildSprites,
  type Frame,
  paint,
  RANGE,
  SMOKE_COUNT,
  type Sprites,
  spawn,
  step,
  TUNING,
  type Tuning,
  tempAt,
} from "./burst";
import { armEmber, playCrackle, playSnuff, playStrike } from "./ember-sound";

/**
 * A wick on a dark stage. Tapping it strikes, and a shower of embers leaves the
 * flame's rim, rises, cools and goes out. Tapping it again snuffs it, and what
 * comes off then is smoke rather than sparks, because lighting something and
 * putting it out are different events.
 *
 * **Holding it blazes and dragging it draws.** A tap is a state change and a
 * hold is the flame being fed, so the wick emits continuously while the hand is
 * down, into a cone rather than a ring, at a rate that ramps the longer it is
 * held. Every spark leaves carrying the wick's own velocity, which is why
 * waving it streaks the shower behind the hand rather than throwing a ring at
 * every point along the way. Without those two this is a button you press and
 * watch, where every other lab on this site gives you something to hold.
 *
 * **The six knobs each turn off one of the six things that make it fire.** Run
 * `spray`, `drag`, `lift`, `pops` and `trail` down to their floors and back
 * comes the ring of dots expanding forever at one speed, which is the build
 * this replaced and the shape the reference has. `pixel-reveal` makes the same
 * argument about its own `drift`: leaving the floor reachable is what makes the
 * difference visible rather than asserted.
 *
 * `burst.ts` is the model and the painter, pure and DOM-free, the split
 * `halftone-ripple` makes with `ripple.ts`. Nothing in this file renders while
 * a burst is in the air: the bodies live in a ref, one frame loop paints them,
 * and the wall's brightness and the count go straight to their nodes.
 */

/** the grain the dark faces carry, `document-pocket`'s single inline turbulence */
const GRAIN = `url("data:image/svg+xml,%3Csvg viewBox='0 0 160 160' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E")`;

/** the flame on a lit wick, which is one step down the ember ramp from white */
const LIT = ((t: [number, number, number]) => `rgb(${t[0]} ${t[1]} ${t[2]})`)(
  tempAt(0.72),
);

/**
 * The room the burst lights. Only its opacity and its position move, both
 * written per frame, so the whole effect is a compositor transform and an
 * opacity rather than a second canvas or a gradient re-parsed on every one.
 *
 * The box is twice the stage in each direction, which is what lets it travel at
 * all: a gradient centred in a box the size of the stage shows its own edge the
 * moment it is moved, so the stops are at half the share they would otherwise
 * take.
 */
const ROOM = `radial-gradient(circle at 50% 50%, rgb(255 150 60 / 0.32), rgb(255 104 36 / 0.11) 17%, transparent 35%)`;

/**
 * What counts as a full room. Heat is the sum of every ember's own heat times
 * its size, so a full strike of the larger sparks lands near this. Clamped,
 * since a flurry can stack three bursts in the air at once and the wall has one
 * brightness.
 */
const HEAT_FULL = 170;

/** how fast the room answers the air, as a time constant in seconds */
const ROOM_TAU = 0.16;

/**
 * How far the room leans toward the heat, as a share of the way there. At 1 the
 * wall's bright spot sits exactly on the shower, which on a stage this size
 * puts it off the edge as often as not. At this it leans, which says the light
 * is coming from the sparks without the pool ever leaving the frame.
 */
const ROOM_LEAN = 0.55;

/** how fast the lit spot travels, as a time constant in seconds */
const LEAN_TAU = 0.13;

/** how long a press stays warm for the next one, in milliseconds */
const STREAK_WINDOW = 1200;

/** presses into a flurry before a strike throws everything it has */
const STREAK_MAX = 3;

/** how much more than a cold strike the end of a flurry throws */
const STREAK_GAIN = 0.9;

/**
 * How far the wick shakes on a tap, in pixels.
 *
 * It was a 5px shove on a spring, which at this size is the control sliding
 * across the stage and back rather than reacting: what a struck match does is
 * jolt, not travel. A short decaying oscillation along the press reads as the
 * knock without moving the thing anywhere, and it is over before a reader has
 * time to follow it.
 */
const SHAKE = 2.4;

/** the oscillation, as shares of `SHAKE`, and how long the whole thing lasts */
const RECOIL = {
  steps: [0, 1, -0.55, 0.26, -0.1, 0],
  duration: 0.24,
  ease: "easeOut",
} as const;

/**
 * The wick coming back when it is let go.
 *
 * It used to stay where it was dropped, which `sticker-peel` is right to do for
 * a sticker and is wrong here: this is the demo's one control, and a button
 * that permanently relocates itself reads as a loose object rather than as the
 * thing you press. A drag is a gesture, not a move. Critically damped, since
 * what is arriving is a control and not a thrown thing.
 */
const HOMING = { type: "spring", stiffness: 190, damping: 26 } as const;

/** how long the wick is held before it starts blazing, in milliseconds */
const HOLD = 180;

/** a press that travels this far is a drag rather than a tap, in pixels */
const SLOP = 6;

/** embers a second while blazing, at the start of a hold and once it is going */
const BLAZE = { from: 22, to: 58 };

/** how long a blaze takes to reach its rate, in milliseconds */
const BLAZE_RAMP = 900;

/** half the cone a blaze throws into, in radians, around straight up */
const BLAZE_CONE = 1.25;

/**
 * How much of the wick's own speed a spark leaves carrying. Not all of it: a
 * spark is thrown off a flame rather than welded to it, and at 1 a fast drag
 * hands the whole shower the hand's velocity and it reads as a rigid comet.
 */
const CARRY = 0.62;

/** how far an arrow key moves the wick, in pixels */
const STEP = 14;

/** how much stage a moved wick leaves round itself, in pixels */
const EDGE = 6;

/**
 * The stage width every length in `burst.ts` was tuned against, which is the
 * column's own inside the frame's padding. A narrower stage scales the whole
 * burst down by its share of this, so the reach is a fraction of the frame
 * rather than a number of pixels: on a 390px phone the stage is 313 wide, where
 * a full-size burst is out through the top and both sides before it has cooled
 * at all. It never scales up, since a wide frame is not a reason for bigger
 * sparks.
 */
const TUNED_AT = 538;

/**
 * The six numbers, and each turns off one of the six things that separate a
 * spark from a particle, so reading down the panel is reading the argument the
 * demo is making.
 */
const KNOBS: Array<Knob<keyof Tuning>> = [
  {
    key: "count",
    label: "sparks",
    ...RANGE.count,
    format: (v) => String(Math.round(v)),
  },
  { key: "drag", label: "drag", ...RANGE.drag, format: (v) => v.toFixed(2) },
  {
    key: "lift",
    label: "lift",
    ...RANGE.lift,
    format: (v) => String(Math.round(v)),
  },
  {
    key: "spray",
    label: "spray",
    ...RANGE.spray,
    format: (v) => `${Math.round(v)}ms`,
  },
  {
    key: "pops",
    label: "pops",
    ...RANGE.pops,
    format: (v) => `${Math.round(v * 100)}%`,
  },
  {
    key: "trail",
    label: "trail",
    ...RANGE.trail,
    format: (v) => `${Math.round(v)}ms`,
  },
];

export default function EmberBurst() {
  const [lit, setLit] = useState(false);
  const [open, setOpen] = useState(false);
  /**
   * The wick's own tooltip, controlled, so a hold does not leave its label
   * sitting over the demo for the length of the gesture. Radix still decides
   * when one wants to be open and this only refuses while a hand is down.
   */
  const [tip, setTip] = useState(false);
  const [tuning, setTuning] = useState<Tuning>(TUNING);
  const reduce = useReducedMotion();
  const panelId = useId();
  const hintId = useId();

  const stage = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const room = useRef<HTMLDivElement>(null);
  const readout = useRef<HTMLSpanElement>(null);

  const ctx = useRef<CanvasRenderingContext2D | null>(null);
  const sprites = useRef<Sprites | null>(null);
  const bloom = useRef<HTMLCanvasElement | null>(null);
  const size = useRef({ w: 0, h: 0 });
  const scale = useRef(1);
  /** the wick's resting centre in canvas pixels, before any drag */
  const home = useRef({ x: 0, y: 0 });
  const radius = useRef(38);

  const bodies = useRef<Body[]>([]);
  const frame = useRef(0);
  const last = useRef(0);
  /** what the wall is showing, eased toward the heat so it does not cut out */
  const glow = useRef(0);
  /** where it is showing it, eased toward the heat's own middle */
  const at = useRef({ x: 0, y: 0 });
  const still = useRef(false);
  /*
   * The loop reads state it is not rendered by, so it reads it off refs: the
   * knobs, because a drag on a lane must reach what is already in the air, and
   * the lit flag, because a hold decides whether to strike from inside a
   * handler rather than from a render.
   */
  const knobs = useRef(tuning);
  const isLit = useRef(false);

  const pressedAt = useRef(Number.NEGATIVE_INFINITY);
  const streak = useRef(0);

  /* the gesture */
  const held = useRef(false);
  const dragged = useRef(false);
  /**
   * Whether this gesture became a hold, which is not the same as whether it is
   * feeding the flame: under reduced motion there is no continuous emission to
   * run, and a hold still has to end lit rather than falling through to the tap
   * that would snuff it.
   */
  const blazed = useRef(false);
  const blazing = useRef(false);
  const blazeFrom = useRef(0);
  const owed = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const grab = useRef({ x: 0, y: 0, bx: 0, by: 0, wx: 0, wy: 0 });
  /** the window listeners are bound once, so they call through this */
  const onRelease = useRef<() => void>(() => {});

  /* the wick's own offset and the tap's knock, on two elements so neither owns
     both: a motion value handed to `style` owns that transform outright, which
     `crack-button` and `stem-picker` both document running into */
  const wx = useMotionValue(0);
  const wy = useMotionValue(0);
  const vx = useVelocity(wx);
  const vy = useVelocity(wy);
  const kx = useMotionValue(0);
  const ky = useMotionValue(0);

  useEffect(() => {
    still.current = reduce ?? false;
  }, [reduce]);

  useEffect(() => {
    knobs.current = tuning;
  }, [tuning]);

  useEffect(() => {
    isLit.current = lit;
  }, [lit]);

  /* size the canvas to the stage, and find the wick inside it */
  useEffect(() => {
    const box = stage.current;
    const c = canvas.current;
    if (!box || !c) return;
    const context = c.getContext("2d");
    if (!context) return;
    ctx.current = context;

    let dpr = 0;
    const measure = () => {
      const stageBox = box.getBoundingClientRect();
      if (stageBox.width < 1 || stageBox.height < 1) return;

      const next = Math.min(window.devicePixelRatio || 1, 2);
      /*
       * The sprites are rasterised, so a ratio change has to rebuild them.
       * Everything else on the stage is vector and would not have shown it.
       */
      if (next !== dpr) {
        dpr = next;
        sprites.current = buildSprites(dpr);
      }

      c.width = Math.round(stageBox.width * dpr);
      c.height = Math.round(stageBox.height * dpr);
      /* setting either dimension resets the transform, so it goes back on after */
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      size.current = { w: stageBox.width, h: stageBox.height };
      scale.current = Math.min(stageBox.width / TUNED_AT, 1);

      /*
       * An eighth of the backing store, which is the whole of the bloom: the
       * browser's own bilinear filter blurs on the way down and again on the
       * way back up, so two `drawImage` calls buy what a gaussian would cost a
       * filter pass for.
       */
      if (!bloom.current) bloom.current = document.createElement("canvas");
      bloom.current.width = Math.max(8, Math.round(c.width / 8));
      bloom.current.height = Math.max(8, Math.round(c.height / 8));

      const wickBox = button.current?.getBoundingClientRect();
      if (wickBox) {
        radius.current = wickBox.width / 2;
        /* the drag is backed out, so home is where the wick rests and not where
           the hand has currently put it */
        home.current = {
          x: wickBox.left + wickBox.width / 2 - stageBox.left - wx.get(),
          y: wickBox.top + wickBox.height / 2 - stageBox.top - wy.get(),
        };
      } else {
        home.current = { x: stageBox.width / 2, y: stageBox.height / 2 };
      }
      at.current = {
        x: home.current.x + wx.get(),
        y: home.current.y + wy.get(),
      };
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, [wx, wy]);

  /** the wick's centre right now, which a drag moves */
  const wick = useCallback(
    () => ({ x: home.current.x + wx.get(), y: home.current.y + wy.get() }),
    [wx, wy],
  );

  /** how far the wick may go and still sit wholly on the stage */
  const limit = useCallback(
    () => ({
      x: Math.max(0, size.current.w / 2 - radius.current - EDGE),
      y: Math.max(0, size.current.h / 2 - radius.current - EDGE),
    }),
    [],
  );

  const run = useCallback(() => {
    if (frame.current) return;
    last.current = performance.now();
    frame.current = requestAnimationFrame(loopRef.current);
  }, []);

  const loopRef = useRef<() => void>(() => {});

  /*
   * One frame. It stops asking for frames once the air is empty, the wall has
   * finished dimming and nothing is being held, so a stage nobody is touching
   * costs nothing.
   */
  const loop = useCallback(() => {
    const context = ctx.current;
    const sheet = sprites.current;
    const c = canvas.current;
    if (!context || !sheet || !c) {
      frame.current = 0;
      return;
    }

    const now = performance.now();
    /* a tab that was hidden or a stall would otherwise take every body through
       the wall in one step, `rain-splatter`'s clamp */
    const dt = Math.min((now - last.current) / 1000, 0.05);
    last.current = now;

    /*
     * A blaze owes embers at a rate rather than on a beat, so the count it
     * throws is the rate times the frame and the fraction carries over. A timer
     * instead emits in clumps on any display that is not 60Hz.
     */
    if (blazing.current && !still.current) {
      const ramp = Math.min((now - blazeFrom.current) / BLAZE_RAMP, 1);
      owed.current += (BLAZE.from + (BLAZE.to - BLAZE.from) * ramp) * dt;
      const due = Math.floor(owed.current);
      if (due > 0) {
        owed.current -= due;
        const w = wick();
        spawn(bodies.current, {
          kind: "ember",
          cx: w.x,
          cy: w.y,
          count: due,
          bx: 0,
          by: 0,
          /* what the hand is doing to the flame, which the sparks leave with */
          vx: vx.get() * CARRY,
          vy: vy.get() * CARRY,
          cone: BLAZE_CONE,
          now,
          scale: scale.current,
          still: false,
          tuning: knobs.current,
        });
      }
    }

    const result: Frame = step(
      bodies.current,
      dt,
      now,
      still.current,
      knobs.current,
    );

    const target = Math.min(result.heat / (HEAT_FULL * scale.current), 1);
    glow.current += (target - glow.current) * approach(ROOM_TAU, dt);

    const w = wick();
    const toward = result.heat > 0 ? result : { x: w.x, y: w.y };
    const ease = approach(LEAN_TAU, dt);
    at.current.x += (toward.x - at.current.x) * ease;
    at.current.y += (toward.y - at.current.y) * ease;

    paint(
      {
        ctx: context,
        canvas: c,
        w: size.current.w,
        h: size.current.h,
        sprites: sheet,
        bloom: bloom.current,
      },
      bodies.current,
      now,
      { x: at.current.x, y: at.current.y, level: glow.current },
    );

    if (room.current) {
      room.current.style.opacity = glow.current.toFixed(3);
      const dx = (at.current.x - size.current.w / 2) * ROOM_LEAN;
      const dy = (at.current.y - size.current.h / 2) * ROOM_LEAN;
      room.current.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0)`;
    }
    if (readout.current) {
      readout.current.textContent = String(bodies.current.length).padStart(
        2,
        "0",
      );
    }

    /* a crackle is a spark coming apart, which is most of what a fire sounds
       like. Capped, since a flurry can break several on one frame. */
    for (let i = 0; i < Math.min(result.pops, 2); i++) playCrackle();

    const alive =
      bodies.current.length > 0 || glow.current > 0.002 || blazing.current;
    if (alive) {
      frame.current = requestAnimationFrame(loopRef.current);
      return;
    }

    /* land the wall on nothing rather than on the last thousandth */
    glow.current = 0;
    if (room.current) room.current.style.opacity = "0";
    frame.current = 0;
  }, [vx, vy, wick]);

  loopRef.current = loop;

  /** a tap: the state changes and one burst goes out */
  const toggle = useCallback(
    (bx: number, by: number) => {
      const now = performance.now();
      streak.current =
        now - pressedAt.current < STREAK_WINDOW
          ? Math.min(streak.current + 1, STREAK_MAX)
          : 0;
      pressedAt.current = now;

      const next = !isLit.current;
      isLit.current = next;
      setLit(next);

      if (!still.current) {
        /*
         * A keyframe array rather than a value to spring toward, since what
         * this is is a jolt with a direction and not a displacement to recover
         * from. A tap with no direction in it, which is the keyboard's, shakes
         * sideways, because a shake is sideways.
         */
        const dx = bx || (by ? 0 : 1);
        animate(
          kx,
          RECOIL.steps.map((k) => k * dx * SHAKE),
          { duration: RECOIL.duration, ease: RECOIL.ease },
        );
        animate(
          ky,
          RECOIL.steps.map((k) => k * by * SHAKE),
          { duration: RECOIL.duration, ease: RECOIL.ease },
        );
      }

      const w = wick();
      spawn(bodies.current, {
        kind: next ? "ember" : "smoke",
        cx: w.x,
        cy: w.y,
        count: next
          ? Math.round(
              knobs.current.count *
                (1 + STREAK_GAIN * (streak.current / STREAK_MAX)),
            )
          : SMOKE_COUNT,
        bx,
        by,
        vx: 0,
        vy: 0,
        now,
        scale: scale.current,
        still: still.current,
        tuning: knobs.current,
      });

      if (next) playStrike();
      else playSnuff();
      run();
    },
    [kx, ky, run, wick],
  );

  const startBlaze = useCallback(() => {
    if (blazed.current) return;
    blazed.current = true;

    /* a hold on a cold wick catches it first, which is the match taking, and a
       hold never puts one out */
    if (!isLit.current) {
      isLit.current = true;
      setLit(true);
      playStrike();
      const w = wick();
      spawn(bodies.current, {
        kind: "ember",
        cx: w.x,
        cy: w.y,
        count: knobs.current.count,
        bx: 0,
        by: 0,
        vx: 0,
        vy: 0,
        now: performance.now(),
        scale: scale.current,
        still: still.current,
        tuning: knobs.current,
      });
    }

    /* and then it feeds, which is travel, so under the setting it does not.
       The wick is lit and the flame is on, there is simply no shower coming off
       it, which is the line `book-opening` draws between a state and a flight */
    if (!still.current) {
      blazing.current = true;
      blazeFrom.current = performance.now();
      owed.current = 0;
    }
    run();
  }, [run, wick]);

  /** the wick back to the middle, unless the setting says not to travel */
  const goHome = useCallback(() => {
    if (wx.get() === 0 && wy.get() === 0) return;
    if (still.current) {
      wx.set(0);
      wy.set(0);
      return;
    }
    animate(wx, 0, HOMING);
    animate(wy, 0, HOMING);
    run();
  }, [run, wx, wy]);

  const release = useCallback(() => {
    if (!held.current) return;
    held.current = false;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;

    blazing.current = false;
    /* only a press that stayed a press is a tap */
    if (!blazed.current && !dragged.current) {
      toggle(grab.current.bx, grab.current.by);
    }
    if (dragged.current) goHome();
    blazed.current = false;
    dragged.current = false;
    setTip(false);
  }, [goHome, toggle]);

  onRelease.current = release;

  /*
   * The gesture ends on the window, so a hand that runs off the wick or off the
   * frame is still the hand that was holding it, which is nib's rule. Bound
   * once and gated on the ref, and the release goes through a ref of its own so
   * a listener bound on mount is never calling a stale one.
   */
  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (!held.current) return;
      const dx = event.clientX - grab.current.x;
      const dy = event.clientY - grab.current.y;
      if (!dragged.current && Math.hypot(dx, dy) < SLOP) return;
      dragged.current = true;
      startBlaze();

      const edge = limit();
      wx.set(Math.max(-edge.x, Math.min(grab.current.wx + dx, edge.x)));
      wy.set(Math.max(-edge.y, Math.min(grab.current.wy + dy, edge.y)));
    };
    const up = () => onRelease.current();
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("blur", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("blur", up);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [limit, startBlaze, wx, wy]);

  const arm = useCallback(
    (bx: number, by: number, x: number, y: number) => {
      armEmber();
      held.current = true;
      dragged.current = false;
      blazed.current = false;
      setTip(false);
      grab.current = { x, y, bx, by, wx: wx.get(), wy: wy.get() };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        if (held.current) startBlaze();
      }, HOLD);
    },
    [startBlaze, wx, wy],
  );

  const press = (event: React.PointerEvent<HTMLButtonElement>) => {
    const el = button.current;
    if (!el) return;
    /*
     * A press off centre pushes a tap's burst the way the hand went, and knocks
     * the disc the same way. It is measured here and carried to the release,
     * since only a release that never became a hold is a tap.
     */
    const box = el.getBoundingClientRect();
    const dx = event.clientX - (box.left + box.width / 2);
    const dy = event.clientY - (box.top + box.height / 2);
    const d = Math.hypot(dx, dy);
    let bx = 0;
    let by = 0;
    if (d > 1) {
      const reach = Math.min(d / (box.width / 2), 1);
      bx = (-dx / d) * reach;
      by = (-dy / d) * reach;
    }
    arm(bx, by, event.clientX, event.clientY);
  };

  const key = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      if (event.repeat) return;
      /*
       * The default action of this keydown is the click a button synthesises,
       * so preventing it is what keeps the keyboard on the same two gestures
       * the pointer has rather than firing a toggle underneath a hold.
       */
      event.preventDefault();
      arm(0, 0, 0, 0);
      return;
    }

    const nudge: Record<string, [number, number]> = {
      ArrowLeft: [-STEP, 0],
      ArrowRight: [STEP, 0],
      ArrowUp: [0, -STEP],
      ArrowDown: [0, STEP],
    };
    const move = nudge[event.key];
    if (!move) return;
    /* the keyboard's own version of the drag, so the one path that moves the
       wick is not pointer-only, which is what `event-stacking`'s hint argues */
    event.preventDefault();
    const edge = limit();
    wx.set(Math.max(-edge.x, Math.min(wx.get() + move[0], edge.x)));
    wy.set(Math.max(-edge.y, Math.min(wy.get() + move[1], edge.y)));
    run();
  };

  const keyUp = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      release();
      return;
    }
    /* held, an arrow walks the wick out on the browser's own key repeat, and
       letting go brings it back, which is the pointer's gesture spelled out on
       a keyboard rather than a second way for the control to move */
    if (event.key.startsWith("Arrow")) goHome();
  };

  const tuneLabel = open
    ? "Hide the burst's numbers"
    : "Show the burst's numbers";
  const what = lit ? "Snuff the wick" : "Strike the wick";

  return (
    /* `@container` here as well as on the stage, since a container governs its
       descendants and never its siblings: the panel sits outside the stage, so
       without this its `@md:` columns never match and six lanes stack. */
    <div className="@container flex w-full flex-col">
      <div
        ref={stage}
        /* `select-none` because the gesture is a flurry of presses and drags on
           one small control, and a rapid multi-click anchors a selection on the
           nearest text it can find, which is `crack-button`'s case exactly.
           `touch-action` is left alone here and taken only on the wick, so a
           thumb scrolling past the demo is never trapped by the stage, which is
           the trade `window-shade` documents for its own grip. */
        className="@container relative isolate aspect-8/5 w-full select-none overflow-hidden rounded-t-lg bg-inverse-bg"
        /* The wick is a share of the stage, so a phone gets the same picture
           rather than a full-size disc with a scaled-down burst around it. The
           property is set here and read by the descendants, which is the only
           arrangement that works: an element is a query container for what is
           inside it and never for itself, the trap `document-pocket` documents.
           The floor keeps it a real touch target. */
        style={
          { "--wick": "clamp(3rem, 15.7cqw, 4.8rem)" } as React.CSSProperties
        }
      >
        {/* the wall, lit by whatever is in the air and from where it is. Under
            the grain, so the tooth shows up where the light falls and stays out
            of the shadows, which is what `mix-blend-overlay` on a near-black
            ground buys. */}
        <div
          aria-hidden="true"
          ref={room}
          className="pointer-events-none absolute -inset-1/2 opacity-0 will-change-transform"
          style={{ backgroundImage: ROOM }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.2] mix-blend-overlay"
          style={{ backgroundImage: GRAIN }}
        />

        <div className="absolute inset-0 grid place-items-center">
          <motion.div style={{ x: wx, y: wy }}>
            <motion.div className="relative" style={{ x: kx, y: ky }}>
              {/* the lit wick's own halo, which is a light rather than a ring:
                  the outer box carries the on state and the inner one the
                  flicker, since an animation outranks a normal declaration and
                  the two would otherwise fight over `opacity`. */}
              <div
                aria-hidden="true"
                className={cn(
                  "pointer-events-none absolute transition-opacity duration-500",
                  lit ? "opacity-100" : "opacity-0",
                )}
                style={{ inset: "calc(var(--wick) * -0.417)" }}
              >
                <div
                  className={cn(
                    "size-full rounded-full",
                    lit &&
                      "motion-safe:animate-[ember-flicker_1.7s_ease-in-out_infinite]",
                  )}
                  style={{
                    backgroundImage:
                      "radial-gradient(circle, rgb(255 152 58 / 0.34), rgb(255 110 40 / 0.08) 42%, transparent 68%)",
                  }}
                />
              </div>

              <TooltipProvider delayDuration={200}>
                {/* a toggle's tooltip names what a press will do, since the
                    glyph and `aria-pressed` already say what is true. The
                    signature player's loop button documents it. */}
                <Tooltip
                  label={`${what} (hold to blaze)`}
                  open={tip}
                  onOpenChange={(next) => setTip(next && !held.current)}
                >
                  <button
                    type="button"
                    ref={button}
                    aria-pressed={lit}
                    aria-label={what}
                    aria-describedby={hintId}
                    onPointerDown={press}
                    onKeyDown={key}
                    onKeyUp={keyUp}
                    onClick={(event) => {
                      /* only a click nothing else produced, which is the one an
                         assistive technology synthesises: the keyboard's own is
                         prevented above and the pointer is already served */
                      if (event.detail === 0 && !held.current) toggle(0, 0);
                    }}
                    style={{ width: "var(--wick)", height: "var(--wick)" }}
                    className={cn(
                      "relative grid cursor-grab touch-none place-items-center overflow-hidden rounded-full active:cursor-grabbing",
                      /*
                       * Hover goes lighter and only the press goes darker, the
                       * opposite of the site's own order and `book-opening`'s
                       * call: the usual `fill` steps assume a white page and
                       * both of them move toward the ground here.
                       */
                      /*
                       * No fill at rest, which is the whole of it. `inverse-fill`
                       * is a fixed near-black, so the moment the room lights up
                       * the one thing that does not is the object throwing the
                       * sparks, and a black puck in the middle of a fire reads as
                       * a placeholder rather than as a wick. Transparent, the
                       * room light and the burst behind it show through and it
                       * lights with everything else. The hairline is what says
                       * there is a control here, and hover and press are light at
                       * alpha over it rather than a darker fill.
                       */
                      "bg-transparent hover:bg-inverse-text/8 active:bg-inverse-text/14",
                      "ring-1 ring-inverse-text/12 ring-inset hover:ring-inverse-text/20",
                      /* the step in is instant and only the step back is timed,
                         `tether-button`'s asymmetry: at 200ms both ways a quick
                         click never reaches its own colour. Nothing scales. */
                      "transition-colors duration-200 active:duration-0",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inverse-text/30 focus-visible:ring-offset-2 focus-visible:ring-offset-inverse-bg",
                    )}
                  >
                    {/* A lit wick is hot, so it glows rather than staying a
                        hole. `inverse-fill` on a lit stage is the darkest thing
                        in the frame, and the object throwing the sparks read as
                        a black disc with a fire behind it. Light over the dark
                        fill, which is the rule for shading a dark surface, and
                        it sits under the glyph so the flame still has an edge.
                        `overflow-hidden` is what keeps it inside the disc. */}
                    <span
                      aria-hidden="true"
                      className={cn(
                        "pointer-events-none absolute inset-0 rounded-full transition-opacity duration-500",
                        lit ? "opacity-100" : "opacity-0",
                      )}
                      style={{
                        backgroundImage:
                          "radial-gradient(circle at 50% 64%, rgb(255 146 54 / 0.34), rgb(255 108 38 / 0.13) 42%, rgb(255 96 32 / 0.04) 70%, transparent 100%)",
                      }}
                    />

                    {/* a lit flame leans and breathes, anchored at its base.
                        `origin-bottom` is what makes the top of it the part the
                        air moves, and the 1.35s period is deliberately not the
                        halo's 1.7s, so the two never come back into step. */}
                    <span
                      className={cn(
                        "relative flex origin-bottom transition-colors duration-200",
                        lit &&
                          "motion-safe:animate-[flame-waver_1.35s_ease-in-out_infinite]",
                      )}
                      style={{
                        width: "calc(var(--wick) * 0.375)",
                        height: "calc(var(--wick) * 0.375)",
                        ...(lit ? { color: LIT } : null),
                      }}
                    >
                      <FlameIcon
                        aria-hidden="true"
                        className={cn(
                          "size-full shrink-0 transition-colors duration-200",
                          !lit && "text-inverse-text-secondary",
                        )}
                      />
                      <FlameIcon
                        aria-hidden="true"
                        weight="fill"
                        className={cn(
                          "absolute inset-0 size-full transition-opacity duration-200",
                          lit ? "opacity-100" : "opacity-0",
                        )}
                      />
                    </span>
                  </button>
                </Tooltip>
              </TooltipProvider>
            </motion.div>
          </motion.div>
        </div>

        {/* over the wick, since a spark leaving a flame passes in front of it */}
        <canvas
          ref={canvas}
          className="pointer-events-none absolute inset-0 size-full"
        />

        {/* the two gestures a name cannot carry. A button's accessible name is
            read on every focus, so it stays the action alone and the rest is a
            description, which is announced once. */}
        <span id={hintId} className="sr-only">
          Hold to blaze, drag or use the arrow keys to move it.
        </span>

        {/* what is in the air, which is the honest number behind the picture:
            these are bodies, and the wall's brightness is their heat. Written
            straight to the node, so a burst renders nothing. */}
        <div className="pointer-events-none absolute bottom-4 left-4 flex items-baseline gap-2 font-mono text-meta text-inverse-text-secondary">
          <span>aloft</span>
          <span ref={readout} className="tabular-nums text-inverse-text">
            00
          </span>
        </div>
      </div>

      {/* the bar above the lanes, so the panel grows from the edge nobody is
          looking at and neither the stage nor the pill moves when it opens,
          which is `rain-splatter`'s call for the same disclosure. The frame is
          `flush`, so the stage runs to its edges and only this strip is padded. */}
      <div className="flex justify-center px-6 pt-4">
        <TooltipProvider delayDuration={200}>
          <Tooltip label={tuneLabel}>
            <Pill
              onClick={() => setOpen((o) => !o)}
              label={tuneLabel}
              icon
              expanded={open}
              controls={panelId}
            >
              <SlidersHorizontalIcon aria-hidden="true" className="size-3.5" />
            </Pill>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/*
       * A grid whose single row goes from `0fr` to `1fr`, with the panel in an
       * `overflow-hidden` child, which is the one way to animate to a height the
       * browser works out for itself. `inert` while shut is not optional: a
       * `0fr` row is invisible and its six ranges are still in the tab order.
       */}
      <div
        id={panelId}
        inert={!open}
        className={cn(
          "grid w-full px-6 motion-safe:transition-all motion-safe:duration-200",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="pt-5">
            <Panel
              knobs={KNOBS}
              values={tuning}
              onChange={(k, value) => setTuning((t) => ({ ...t, [k]: value }))}
            />
          </div>
        </div>
      </div>

      {/* the frame has no padding of its own, so the strip below the stage
          carries its own, and this is its foot */}
      <div className="h-6" />
    </div>
  );
}
