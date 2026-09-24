"use client";

import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { approach } from "@/lib/lerp";
import { cn } from "@/lib/utils";
import {
  DROP,
  type Drop,
  drops,
  EMPTY,
  FULL,
  fillPaths,
  outline,
  POLE,
  type Pose,
  shadePath,
  splashPath,
} from "./flag";
import { armFlag, playSnap } from "./flag-sound";

/*
 * A flag toggle. Press it and the flag runs up the pole, a gust rolls along
 * the cloth from the pole to the tails with the fill riding behind it, the
 * tails whip out and three splashes come off them. Press again and it goes
 * back down, empty. The splashes land with a snap. While it is up it never
 * stops fluttering, and a pointer moving past it is wind.
 *
 * Nothing renders while any of it moves. One frame loop writes six path
 * strings straight to the DOM. It stops once everything has landed, which a
 * raised flag never does, so it also stops whenever the stage is off screen.
 */

/**
 * The ground and the ink, the lab's one scoped pair. A flag is a thing that is
 * meant to be seen, so the stage takes a saturated ground rather than the
 * site's white, and it is a cobalt rather than the reference's tomato. The
 * cream is 6.1:1 on it, and at rest the flag drops to 70% of it so a raised
 * flag is the brightest thing on the stage. The fold shading punches the
 * ground's own colour through the cloth. Not tokens, and nothing else may
 * reach for them.
 */
const GROUND = "#2c4bdb";
const INK = "#fff4dc";

/**
 * Film grain over the ground, `document-pocket`'s tile. `overlay` works on the
 * mid-tone cobalt where it would do nothing to black, so the grain reads as a
 * tooth in the cloth ground rather than as dust sitting on it.
 */
const GRAIN = `url("data:image/svg+xml,%3Csvg viewBox='0 0 160 160' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E")`;

/**
 * The hoist, as a spring on the cloth's offset down the pole.
 *
 * Underdamped at a ratio of 0.36, so running up 4 units carries it about 1.3
 * past the top before it settles. That overshoot is the reference's hop: the
 * icon goes up a little and comes back, and on a pole that is the flag being
 * run up a touch too hard.
 */
const HOIST = { k: 300, c: 12.5 };

/**
 * The gust. It leaves a beat after the press, so the hoist is already moving
 * when the swell starts, and its peak travels from just behind the pole to
 * well past the tails, since the tails only flare while the peak is on them
 * and only close again once it has gone.
 */
const GUST = { delay: 60, duration: 860, from: -0.3, to: 1.5 };

/** how far behind the swell's peak the fill runs, in `u` */
const LAG = 0.03;

/** the peak's position when the splashes leave, just past the tails */
const SPLASH_AT = 1.04;

/** a splash's life, drop to nothing */
const SPLASH = 560;

/** how long a swell takes to die when the press is undone mid-gust */
const KILL = 200;

/** how long lowering the flag takes to drain the fill back to the pole */
const DRAIN = 380;

/**
 * The flutter's speed in still air, in radians a second, and how much faster
 * a full wind runs it. The phase is integrated rather than read off the clock,
 * so a wind speeding the wave up never makes it jump.
 */
const WAVE_SPEED = Math.PI * 2 * 1.1;
const WIND_SPEED = 0.8;

/** how much extra flutter a full wind adds, on top of still air's 1 */
const WIND_FLUTTER = 1.8;

/**
 * How quickly the flutter follows its target, and how quickly the wind dies
 * once the pointer stops. The wind outlasts the pointer by most of a second,
 * which is what air does.
 */
const FLUTTER_TAU = 0.35;
const WIND_TAU = 0.7;
const LEAN_TAU = 0.45;

/**
 * The pointer's speed, in SVG units a second, that is a full wind at the
 * cloth, and how far from the cloth's middle it still reaches, as a gaussian's
 * width in units.
 */
const GALE = 90;
const REACH = 20;

interface Sim {
  lift: number;
  vel: number;
  target: number;
  /** when the current gust was started, or null */
  gust: number | null;
  /** when it was undone, or null */
  kill: number | null;
  front: number;
  amp: number;
  fill: number;
  /** what was already filled when the gust began, which it cannot take back */
  floor: number;
  drain: { from: number; start: number } | null;
  splashed: boolean;
  splash: { born: number; list: Drop[] } | null;
  phase: number;
  flutter: number;
  /** the wind the pointer has raised, 0 to 1, decaying */
  wind: number;
  lean: number;
  /** where the pointer's wind is pushing the cloth across, -1 to 1 */
  push: number;
  /** whether the flag is up, mirrored for the loop */
  up: boolean;
  /** whether the stage is on screen */
  seen: boolean;
  last: number;
}

/** the peak's travel, part linear and part eased, so it neither crawls out
 * of the pole nor slams into the tails */
function travel(p: number): number {
  return 0.4 * p + 0.6 * (0.5 - 0.5 * Math.cos(Math.PI * p));
}

function smooth(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export default function GustFlag() {
  const [up, setUp] = useState(false);
  const reduce = useReducedMotion();
  const still = useRef(false);
  const clip = `flag-${useId().replace(/[^\w-]/g, "")}`;

  const clipPath = useRef<SVGPathElement>(null);
  const edge = useRef<SVGPathElement>(null);
  const solid = useRef<SVGPathElement>(null);
  const dots = useRef<SVGPathElement>(null);
  const splash = useRef<SVGPathElement>(null);
  const shade = useRef<SVGPathElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const hand = useRef<{ x: number; y: number; t: number } | null>(null);

  const frame = useRef(0);
  const sim = useRef<Sim>({
    lift: DROP,
    vel: 0,
    target: DROP,
    gust: null,
    kill: null,
    front: GUST.from,
    amp: 0,
    fill: EMPTY,
    floor: EMPTY,
    drain: null,
    splashed: false,
    splash: null,
    phase: 0,
    flutter: 0,
    wind: 0,
    lean: 0,
    push: 0,
    up: false,
    seen: true,
    last: 0,
  });

  useEffect(() => {
    still.current = reduce ?? false;
  }, [reduce]);

  /* one frame: advance the hoist, the gust, the fill and the splashes, then
     draw. Returns whether anything is still moving. */
  const step = useCallback((now: number): boolean => {
    const s = sim.current;
    const dt = Math.min(0.05, s.last ? (now - s.last) / 1000 : 0);
    s.last = now;

    if (still.current) {
      s.lift = s.target;
      s.vel = 0;
    } else {
      /* four substeps, since 50ms is past what an explicit spring this stiff
         survives in one */
      const h = dt / 4;
      for (let i = 0; i < 4; i++) {
        const a = -HOIST.k * (s.lift - s.target) - HOIST.c * s.vel;
        s.vel += a * h;
        s.lift += s.vel * h;
      }
    }

    if (s.gust !== null) {
      const p = (now - s.gust - GUST.delay) / GUST.duration;
      const killed = s.kill === null ? 1 : 1 - (now - s.kill) / KILL;
      if (p >= 1 || killed <= 0) {
        if (s.kill === null) s.fill = Math.max(s.fill, FULL);
        s.gust = null;
        s.kill = null;
        s.amp = 0;
      } else if (p >= 0) {
        s.front = GUST.from + (GUST.to - GUST.from) * travel(p);
        s.amp = smooth(0, 0.14, p) * killed;
        if (s.kill === null) {
          s.fill = Math.max(s.floor, s.front - LAG);
          if (!s.splashed && s.front >= SPLASH_AT) {
            s.splashed = true;
            s.splash = { born: now, list: drops(s) };
            playSnap();
          }
        }
      }
    }

    if (s.drain) {
      const t = Math.min(1, (now - s.drain.start) / DRAIN);
      s.fill = s.drain.from + (EMPTY - s.drain.from) * smooth(0, 1, t);
      if (t >= 1) s.drain = null;
    }

    /*
     * The flutter eases toward 1 while the flag is up and 0 while it is down,
     * plus whatever wind the pointer has raised. A lowered flag in still air
     * hangs, so the loop can stop there. Reduced motion takes the flutter and
     * the wind away entirely, since both are nothing but travel.
     */
    if (still.current) {
      s.flutter = 0;
      s.wind = 0;
      s.lean = 0;
      s.push = 0;
    } else {
      s.wind *= Math.exp(-dt / WIND_TAU);
      s.push *= Math.exp(-dt / WIND_TAU);
      if (s.wind < 0.01) s.wind = 0;
      if (Math.abs(s.push) < 0.01) s.push = 0;
      const want = (s.up ? 1 : 0) + s.wind * WIND_FLUTTER;
      s.flutter += (want - s.flutter) * approach(FLUTTER_TAU, dt);
      s.lean += (s.push - s.lean) * approach(LEAN_TAU, dt);
      if (s.flutter < 0.002 && want === 0) s.flutter = 0;
      if (Math.abs(s.lean) < 0.002 && s.push === 0) s.lean = 0;
      s.phase += dt * WAVE_SPEED * (1 + s.wind * WIND_SPEED);
    }

    const pose: Pose = {
      lift: s.lift,
      front: s.front,
      amp: s.amp,
      phase: s.phase,
      flutter: s.flutter,
      lean: s.lean,
    };
    const d = outline(pose);
    clipPath.current?.setAttribute("d", d);
    edge.current?.setAttribute("d", d);
    const fill = fillPaths(pose, s.fill);
    solid.current?.setAttribute("d", fill.solid);
    dots.current?.setAttribute("d", fill.dots);
    shade.current?.setAttribute("d", shadePath(pose, s.fill));

    let splashing = false;
    if (s.splash) {
      const t = (now - s.splash.born) / SPLASH;
      if (t >= 1) {
        s.splash = null;
        splash.current?.setAttribute("d", "");
      } else {
        splashing = true;
        splash.current?.setAttribute("d", splashPath(s.splash.list, t));
        splash.current?.setAttribute("opacity", String(1 - smooth(0.7, 1, t)));
      }
    }

    const settled =
      Math.abs(s.lift - s.target) < 0.002 && Math.abs(s.vel) < 0.002;
    if (settled) {
      s.lift = s.target;
      s.vel = 0;
    }
    const moving =
      !settled ||
      s.gust !== null ||
      s.drain !== null ||
      splashing ||
      s.flutter > 0 ||
      s.wind > 0 ||
      s.push !== 0 ||
      s.lean !== 0;
    /* a raised flag never lands, so the loop also stops off screen, and the
       observer starts it again when the stage comes back */
    return moving && s.seen;
  }, []);

  /*
   * Cancel and reschedule rather than skipping the request while a handle is
   * set, which is `book-opening`'s call: a scheduled frame that never arrives
   * would otherwise leave every later press writing to a loop nothing runs. The
   * clock only restarts when the loop was idle, so a frame's `dt` is always a
   * real one.
   */
  const run = useCallback(() => {
    if (!frame.current) sim.current.last = 0;
    cancelAnimationFrame(frame.current);
    const tick = (now: number) => {
      frame.current = step(now) ? requestAnimationFrame(tick) : 0;
    };
    frame.current = requestAnimationFrame(tick);
  }, [step]);

  /* draw the resting flag on the first frame, then stop */
  useEffect(() => {
    run();
    return () => {
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, [run]);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      sim.current.seen = entry.isIntersecting;
      if (entry.isIntersecting) run();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [run]);

  /*
   * The pointer is wind. Its speed near the cloth raises the flutter and its
   * vertical travel pushes the tails across, both falling off with distance
   * from the cloth's middle and both dying away once it stops. Mouse and pen
   * only, `folder-stack`'s gate: a finger dragging past is a scroll.
   *
   * Measured in the SVG's own units, so the wind is the same strength at every
   * size the drawing is rendered at.
   */
  const blow = (event: React.PointerEvent) => {
    if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
    if (still.current) return;
    const box = svg.current?.getBoundingClientRect();
    if (!box) return;
    const unit = box.width / 52;
    const x = (event.clientX - box.left) / unit;
    const y = (event.clientY - box.top) / unit - 3;
    const t = event.timeStamp;
    const last = hand.current;
    hand.current = { x, y, t };
    if (!last || t - last.t > 100 || t <= last.t) return;

    const dt = (t - last.t) / 1000;
    const vx = (x - last.x) / dt;
    const vy = (y - last.y) / dt;
    const s = sim.current;
    const cx = 25;
    const cy = 14 + s.lift;
    const near = Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / REACH ** 2);
    const gust = Math.min(1, (Math.hypot(vx, vy) / GALE) * near);
    s.wind = Math.max(s.wind, gust);
    s.push = Math.max(-1, Math.min(1, s.push + (vy / GALE) * near * 0.25));
    if (!frame.current && gust > 0.01) run();
  };

  const toggle = () => {
    const next = !up;
    setUp(next);
    const s = sim.current;
    s.up = next;
    const now = performance.now();

    if (next) {
      s.target = 0;
      s.drain = null;
      if (still.current) {
        /* reduced motion: the flag is up and full, with no gust and no
           splash, since both are nothing but travel */
        s.fill = FULL;
        s.gust = null;
      } else {
        s.gust = now;
        s.kill = null;
        s.floor = s.fill;
        s.front = GUST.from;
        s.splashed = false;
      }
    } else {
      s.target = DROP;
      if (s.gust !== null) s.kill = now;
      if (still.current) {
        s.fill = EMPTY;
        s.gust = null;
      } else {
        s.drain = { from: s.fill, start: now };
      }
    }
    run();
  };

  const label = up ? "Lower the flag" : "Raise the flag";

  return (
    <div
      className="@container relative grid aspect-8/5 w-full select-none place-items-center overflow-hidden rounded-lg"
      style={{ backgroundColor: GROUND }}
      ref={stage}
      onPointerMove={blow}
      onPointerLeave={() => {
        hand.current = null;
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.18] mix-blend-overlay"
        style={{ backgroundImage: GRAIN }}
      />
      {/* No tooltip. A label that opens under a 200px drawing covers the stage
          the gust plays on, and the flag says what it does by moving. The
          `aria-label` carries the action for a reader with no pointer. */}
      <button
        type="button"
        aria-pressed={up}
        aria-label={label}
        onClick={toggle}
        /* the snap plays when the gust reaches the tails, so the audio clock
           is unlocked on the press, `poke-sound.ts`'s two-step */
        onPointerDown={armFlag}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") armFlag();
        }}
        className={cn(
          "relative cursor-pointer touch-manipulation rounded-lg",
          /*
           * The flag is the press feedback: it runs up the pole on the frame
           * of the click, so there is no fill step behind it. The hover lifts
           * the ink to full, and a raised flag holds full whatever the pointer
           * does.
           */
          "opacity-70 transition-opacity duration-200 hover:opacity-100 aria-pressed:opacity-100",
          /*
           * The project's ring pins `text-primary` at 15%, which is nothing on
           * a tomato ground, and paints a white offset band. An outline in the
           * lab's own ink is stronger at both, `window-shade`'s substitution.
           */
          "focus-visible:outline-2 focus-visible:outline-(--ink) focus-visible:outline-offset-4",
        )}
        style={{ color: INK, "--ink": INK } as React.CSSProperties}
      >
        <svg
          ref={svg}
          viewBox="0 -3 52 51"
          aria-hidden="true"
          className="block h-auto overflow-visible"
          style={{ width: "clamp(7rem, 36cqw, 12rem)" }}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <defs>
            <clipPath id={clip}>
              <path ref={clipPath} />
            </clipPath>
          </defs>

          <line x1={POLE.x} y1={POLE.top} x2={POLE.x} y2={POLE.bottom} />
          <circle
            cx={POLE.x}
            cy={POLE.top - 0.4}
            r={1.5}
            fill="currentColor"
            stroke="none"
          />

          <g clipPath={`url(#${clip})`} fill="currentColor" stroke="none">
            <path ref={solid} />
            <path ref={dots} />
            <path ref={shade} fill={GROUND} />
          </g>
          <path ref={edge} />
          <path ref={splash} />
        </svg>
      </button>
    </div>
  );
}
