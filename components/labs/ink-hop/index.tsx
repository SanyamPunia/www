"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { cn } from "@/lib/utils";
import {
  aim,
  LEAN,
  plan,
  RECOIL,
  resting,
  type Spring,
  SQUASH,
  spring,
  step,
} from "./body";
import { Gloss, SHINE, shadow } from "./gloss";
import { ICONS } from "./glyphs";
import { align, blank, lerp, type Points, sample, toPath } from "./morph";

/*
 * A row of outline icons where one holds the fill. Pick another and the filled
 * shape is thrown out of its icon, morphs into the new icon's shape in the
 * air, and lands in the new outline as its fill.
 *
 * Nothing here runs on a timeline. The shape is thrown under gravity, its lean
 * and its squash are springs, and the landing turns the speed it arrives with
 * into the squash and the tip, so a long hop lands harder than a short one and
 * the settle is whatever that impact leaves. `body.ts` is the physics.
 *
 * The flying shape is drawn at the icon's own size and grid, so at take-off it
 * is the old fill and at landing the new fill, and both hand-offs swap two
 * identical shapes.
 */

/** the icon box in px, `size-8` on this scale */
const ICON = 25.6;
/** the morph runs inside the flight, so the old shape reads as it leaves */
const MORPH_FROM = 0.15;
const MORPH_TO = 0.8;
/** how much of its path's angle the shape leans by, and the most it leans */
const LEAN_SHARE = 0.3;
const MAX_LEAN = 16;
/** squash per px/s of the speed it lands with, and tip in degrees per px/s */
const IMPACT = 0.011;
const SKID = 0.28;
/** stretch per px/s of the speed it leaves with */
const KICK = 0.009;
/** stretch per px/s of the speed it rises or falls at in the air, and the most */
const DRAG = 0.00018;
const MAX_DRAG = 0.08;
/**
 * Squash, stretch and lean all pivot near the shape's base, where it touches
 * down, on the flyer and on the icons alike, so the hand-off at either end
 * puts the same transform on the same point.
 */
const BASE = "50% 85%";
/** how fast the shape is steered onto a new path after a retarget, in s */
const STEER = 0.06;
/** the sim's fixed step, so the springs behave the same at any frame rate */
const DT = 1 / 240;

interface Flight {
  to: number;
  /** the colours it leaves with, so a retarget blends on from them */
  light: string;
  deep: string;
  dest: { x: number; y: number };
  gravity: number;
  /** seconds left until it lands */
  left: number;
  /** the morph's length and how far into it the shape is */
  span: number;
  age: number;
  a: Points;
  b: Points;
}

interface Sim {
  x: number;
  y: number;
  vx: number;
  vy: number;
  lean: Spring;
  squash: Spring;
  flight: Flight | null;
  /** the icon that holds the fill and is still settling, if any */
  settling: number | null;
  /** icons still giving from a take-off */
  recoil: Map<number, Spring>;
}

export default function InkHop() {
  const reduce = useReducedMotion() ?? false;
  const [selected, setSelected] = useState(0);
  /** the icon whose outline holds the fill, null while it is in the air */
  const [filled, setFilled] = useState<number | null>(0);
  const filledRef = useRef(filled);
  filledRef.current = filled;
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const glyphs = useRef<(SVGSVGElement | null)[]>([]);
  const flyer = useRef<HTMLDivElement>(null);
  const body = useRef<SVGSVGElement>(null);
  const shape = useRef<SVGPathElement>(null);
  const clip = useRef<SVGPathElement>(null);
  const top = useRef<SVGStopElement>(null);
  const bottom = useRef<SVGStopElement>(null);
  const shineId = useId();

  const sim = useRef<Sim>({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    lean: spring(),
    squash: spring(),
    flight: null,
    settling: null,
    recoil: new Map(),
  });
  /** the flying shape's points as last drawn, so a retarget starts from them */
  const now = useRef<Points>(blank());
  /** and its colours as last drawn */
  const tint = useRef({ light: ICONS[0].light, deep: ICONS[0].deep });
  const raf = useRef(0);
  const last = useRef(0);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  /** an icon box's top-left in the bar's px */
  function corner(i: number) {
    const b = buttons.current[i];
    if (!b) return { x: 0, y: 0 };
    return {
      x: b.offsetLeft + (b.offsetWidth - ICON) / 2,
      y: b.offsetTop + (b.offsetHeight - ICON) / 2,
    };
  }

  function draw() {
    const s = sim.current;
    const f = s.flight;
    if (f && flyer.current && body.current) {
      flyer.current.style.transform = `translate(${s.x}px, ${s.y}px) rotate(${s.lean.x}deg)`;
      body.current.style.transform = deform(s.squash.x);
      const k = clamp01(
        (f.age / f.span - MORPH_FROM) / (MORPH_TO - MORPH_FROM),
      );
      const m = k * k * (3 - 2 * k);
      lerp(f.a, f.b, m, now.current);
      const d = toPath(now.current);
      shape.current?.setAttribute("d", d);
      clip.current?.setAttribute("d", d);
      // the colour travels with the shape, blended in oklch so a hue change
      // passes through colour rather than grey
      const to = ICONS[f.to];
      const light = mix(f.light, to.light, m);
      const deep = mix(f.deep, to.deep, m);
      top.current?.style.setProperty("stop-color", light);
      bottom.current?.style.setProperty("stop-color", deep);
      flyer.current.style.filter = shadow(deep);
      tint.current = { light, deep };
    }
    if (s.settling !== null) {
      const g = glyphs.current[s.settling];
      if (g) g.style.transform = `rotate(${s.lean.x}deg) ${deform(s.squash.x)}`;
    }
    for (const [i, r] of s.recoil) {
      const g = glyphs.current[i];
      if (g && i !== s.settling) g.style.transform = deform(r.x);
    }
  }

  function tick(time: number) {
    const s = sim.current;
    let dt = Math.min((time - last.current) / 1000, 1 / 30);
    last.current = time;

    while (dt > 0) {
      const h = Math.min(DT, dt);
      dt -= h;
      const f = s.flight;
      if (f) {
        // steer onto the parabola that lands on time, then fall along it
        const want = aim(s, f.dest, f.left, f.gravity);
        const blend = 1 - Math.exp(-h / STEER);
        s.vx += (want.vx - s.vx) * blend;
        s.vy += (want.vy - s.vy) * blend;
        s.vy += f.gravity * h;
        s.x += s.vx * h;
        s.y += s.vy * h;
        f.left -= h;
        f.age += h;
        // it leans along its path and stretches with how fast it rises or
        // falls, both through springs, so both trail what the path is doing
        const angle = (Math.atan2(s.vy, Math.abs(s.vx)) * 180) / Math.PI;
        const lean =
          Math.min(Math.max(angle * LEAN_SHARE, -MAX_LEAN), MAX_LEAN) *
          (s.vx >= 0 ? 1 : -1);
        step(s.lean, lean, LEAN.k, LEAN.c, h);
        const drag = -Math.min(Math.abs(s.vy) * DRAG, MAX_DRAG);
        step(s.squash, drag, SQUASH.k, SQUASH.c, h);
        if (f.left <= 0) land(f);
      } else {
        step(s.lean, 0, LEAN.k, LEAN.c, h);
        step(s.squash, 0, SQUASH.k, SQUASH.c, h);
      }
      for (const r of s.recoil.values()) step(r, 0, RECOIL.k, RECOIL.c, h);
    }

    draw();

    for (const [i, r] of s.recoil) {
      if (!resting(r)) continue;
      const g = glyphs.current[i];
      if (g && i !== s.settling) g.style.transform = "";
      s.recoil.delete(i);
    }
    if (
      !s.flight &&
      s.settling !== null &&
      resting(s.lean, 0.02) &&
      resting(s.squash)
    ) {
      const g = glyphs.current[s.settling];
      if (g) g.style.transform = "";
      s.settling = null;
    }
    raf.current =
      s.flight || s.settling !== null || s.recoil.size > 0
        ? requestAnimationFrame(tick)
        : 0;
  }

  function start() {
    if (raf.current) return;
    last.current = performance.now();
    raf.current = requestAnimationFrame(tick);
  }

  function land(f: Flight) {
    const s = sim.current;
    s.x = f.dest.x;
    s.y = f.dest.y;
    // the speed it arrives with is what the landing absorbs: falling becomes
    // squash, travelling sideways tips it on over its base
    s.squash.v += Math.max(s.vy, 0) * IMPACT;
    s.lean.v += s.vx * SKID;
    s.vx = 0;
    s.vy = 0;
    s.flight = null;
    s.settling = f.to;
    // committed in this frame, so the outline is never seen filled with the
    // shape still on top, or empty with nothing over it
    flushSync(() => setFilled(f.to));
    if (flyer.current) flyer.current.style.opacity = "0";
  }

  function hop(to: number) {
    const s = sim.current;

    if (reduce) {
      s.flight = null;
      if (flyer.current) flyer.current.style.opacity = "0";
      setFilled(to);
      return;
    }

    const target = sample(ICONS[to].d);
    const dest = corner(to);
    const home = filledRef.current;
    let a: Points;
    let colour = tint.current;
    if (s.flight) {
      // caught mid-air: it is steered to the new icon from where it is, at
      // the speed it has, as the shape it is now
      a = Float32Array.from(now.current);
    } else {
      if (home === null || home === to) return;
      a = sample(ICONS[home].d);
      colour = { light: ICONS[home].light, deep: ICONS[home].deep };
      const from = corner(home);
      s.x = from.x;
      s.y = from.y;
      // a settle still running carries over into the throw, otherwise the
      // shape leaves from rest
      if (s.settling !== home) {
        s.lean = spring();
        s.squash = spring();
      }
      const g = glyphs.current[home];
      if (g) g.style.transform = "";
      s.settling = null;
    }

    const dist = Math.hypot(dest.x - s.x, dest.y - s.y);
    const { time, gravity } = plan(dist);
    if (!s.flight) {
      const launch = aim(s, dest, time, gravity);
      s.vx = launch.vx;
      s.vy = launch.vy;
      // it stretches as it leaves, and the icon it leaves gives under it
      s.squash.v += launch.vy * KICK;
      if (home !== null) {
        const r = s.recoil.get(home) ?? spring();
        r.v += Math.abs(launch.vy) * KICK;
        s.recoil.set(home, r);
      }
    }
    s.flight = {
      to,
      light: colour.light,
      deep: colour.deep,
      dest,
      gravity,
      left: time,
      span: time,
      age: 0,
      a,
      b: align(a, target),
    };
    shape.current?.setAttribute("d", toPath(a));
    draw();
    if (flyer.current) flyer.current.style.opacity = "1";
    if (home !== null) flushSync(() => setFilled(null));
    start();
  }

  function pick(i: number) {
    if (i === selected) return;
    setSelected(i);
    hop(i);
  }

  return (
    <div className="grid w-full place-items-center py-16">
      <div className="relative flex gap-1 rounded-full border border-stroke bg-surface p-1">
        {ICONS.map((g, i) => (
          <button
            key={g.name}
            ref={(el) => {
              buttons.current[i] = el;
            }}
            type="button"
            aria-pressed={i === selected}
            aria-label={g.name}
            onClick={() => pick(i)}
            className={cn(
              "grid size-14 cursor-pointer place-items-center rounded-full transition-colors duration-200 hover:bg-fill-hover",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2",
              i === filled ? "text-text-primary" : "text-text-muted",
            )}
          >
            <svg
              ref={(el) => {
                glyphs.current[i] = el;
              }}
              viewBox="0 0 24 24"
              className="size-8"
              style={{
                transformOrigin: BASE,
                filter: i === filled ? shadow(g.deep) : undefined,
              }}
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {i === filled ? (
                <Gloss d={g.d} light={g.light} deep={g.deep} />
              ) : (
                <path d={g.d} strokeWidth={2.25} />
              )}
            </svg>
          </button>
        ))}
        {/* the path and lean on the outside, the squash and stretch inside,
            so the stretch stays along the shape's own axis */}
        <div
          ref={flyer}
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-0 size-8"
          style={{ opacity: 0, transformOrigin: BASE }}
        >
          <svg
            ref={body}
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-8"
            style={{ transformOrigin: BASE }}
          >
            <defs>
              <linearGradient id={`${shineId}-g`} x1="0" y1="0" x2="0" y2="1">
                <stop ref={top} offset="0" />
                <stop ref={bottom} offset="1" />
              </linearGradient>
              <radialGradient id={`${shineId}-s`}>
                <stop offset="0" stopColor="#fff" stopOpacity="0.7" />
                <stop offset="1" stopColor="#fff" stopOpacity="0" />
              </radialGradient>
              <clipPath id={`${shineId}-c`}>
                <path ref={clip} />
              </clipPath>
            </defs>
            <path
              ref={shape}
              fill={`url(#${shineId}-g)`}
              stroke={`url(#${shineId}-g)`}
              strokeWidth={2}
              strokeLinejoin="round"
            />
            <g clipPath={`url(#${shineId}-c)`}>
              <ellipse {...SHINE} fill={`url(#${shineId}-s)`} />
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}

/** squash flattens and widens, stretch the reverse, at about equal area */
function deform(s: number): string {
  return `scale(${1 + s * 0.6}, ${1 - s})`;
}

/** two colours `t` of the way from `a` to `b`, mixed in oklch */
function mix(a: string, b: string, t: number): string {
  return `color-mix(in oklch, ${a} ${((1 - t) * 100).toFixed(1)}%, ${b})`;
}

function clamp01(v: number): number {
  return Math.min(Math.max(v, 0), 1);
}
