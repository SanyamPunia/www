"use client";

import { ArrowRightIcon } from "@phosphor-icons/react";
import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { TextMorph } from "torph/react";
import { Pill } from "@/components/lab/controls";
import { approach, clamp01 } from "@/lib/lerp";
import {
  build,
  type Cloud,
  floor,
  hash,
  ORDER,
  paint,
  type ShapeKey,
  type View,
} from "./shapes";

/*
 * A figure drawn in dots. A few thousand points on a canvas take the shape of a
 * sphere, turn slowly, lean toward the pointer and scatter away from it, and
 * the one button folds them into the next shape.
 *
 * The figure is centred on a soft stage with a floor under it, and the button
 * sits under the figure. The canvas is decoration: a live region says which
 * shape it is, so nothing depends on reading the dots.
 *
 * `shapes.ts` is the clouds and the painter, pure and DOM-free apart from the
 * canvas it is handed. Nothing here renders per frame: every dot lives in a
 * typed array, one loop paints them, and the only state is which shape it is.
 */

/**
 * The one hue, scoped here and not a token. The dots are the subject, so they
 * take the accent and everything else is ink and grey. 6.9:1 on white, so the
 * farthest dots at a fifth of it still read as a graphic against the stage.
 */
const INK = "#3b4fd8";

/** turns a second, inside the kit's 0.03 to 0.06 */
const SPIN = 0.045;
/** the most the shape leans toward the pointer, in radians, and how fast */
const LEAN = 0.35;
const LEAN_TAU = 0.28;
/** the word's sway in place of a spin, in radians */
const SWAY = 0.22;
/** a slow bob, as a share of the radius */
const FLOAT = 0.03;

/**
 * The morph. Each dot starts on its own beat inside the first `STAGGER` of the
 * run, top of the shape first, so a change sweeps down it rather than every dot
 * leaving at once. `SWIRL` is the extra turn a dot takes about the vertical
 * axis at the middle of its flight, in turns, which is what makes it read as
 * the cloud rearranging itself rather than as two pictures crossfading.
 */
const MORPH = 1.7;
const STAGGER = 0.35;
const SWIRL = 0.32;

/**
 * The scatter. A dot within reach of the pointer is pushed out along the line
 * from it, hardest at the centre, and a spring brings it back once the pointer
 * has gone. Critically damped would settle without a wobble, and a little under
 * is what reads as springy: this is back inside a pixel in about half a second.
 */
const PUSH = 0.55;
const K = 90;
const C = 14;

/** a stage narrower than this gets the phone's dot count */
const NARROW = 448;
/** dots on a wide stage and on a phone */
const COUNT = { wide: 3500, narrow: 1800 } as const;

const PHRASE: Record<ShapeKey, { now: string; next: string }> = {
  sphere: { now: "A sphere of dots", next: "Make it a ring" },
  ring: { now: "A ring of dots", next: "Make it a helix" },
  helix: { now: "A helix of dots", next: "Make it say hi" },
  word: { now: "Dots saying hi", next: "Make it a sphere" },
};

const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

function rgbOf(hex: string): string {
  const v = hex.trim().replace("#", "");
  const n = Number.parseInt(v.length === 3 ? v.replace(/./g, "$&$&") : v, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

function copyCloud(c: Cloud): Cloud {
  return {
    x: c.x.slice(),
    y: c.y.slice(),
    z: c.z.slice(),
    spin: c.spin.slice(),
  };
}

interface Layout {
  w: number;
  h: number;
  narrow: boolean;
  cx: number;
  cy: number;
  r: number;
  horizon: number;
  reach: number;
}

function layout(w: number, h: number): Layout {
  // the figure stands a little above centre, and a quarter of the short side
  // leaves air round it and a clear gap to the button under it
  const r = Math.min(w, h) * 0.25;
  return {
    w,
    h,
    narrow: w < NARROW,
    cx: w * 0.5,
    cy: h * 0.42,
    r,
    horizon: h * 0.68,
    reach: Math.min(110, Math.max(70, r * 0.95)),
  };
}

export default function PointCloud() {
  const reduce = useReducedMotion();
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [shape, setShape] = useState(0);

  // everything the loop reads, kept out of React
  const live = useRef({
    raf: 0,
    last: 0,
    seen: false,
    reduce: false,
    layout: null as Layout | null,
    dpr: 1,
    grid: "220 220 220",
    // the stage's three tones, read off the tokens at mount, since a canvas
    // gradient cannot take a `var()`
    tones: ["", "", ""] as [string, string, string],
    // the dots
    from: null as Cloud | null,
    to: null as Cloud | null,
    cur: null as Cloud | null,
    size: new Float32Array(0),
    delay: new Float32Array(0),
    ox: new Float32Array(0),
    oy: new Float32Array(0),
    vx: new Float32Array(0),
    vy: new Float32Array(0),
    sx: new Float32Array(0),
    sy: new Float32Array(0),
    // every shape, built once, so a press costs a copy and not a sort
    clouds: new Map<ShapeKey, Cloud>(),
    // the morph, as a start time, or null once it has landed
    morphAt: null as number | null,
    // the view
    yaw: 0,
    time: 0,
    leanX: 0,
    leanY: 0,
    pointer: null as { x: number; y: number } | null,
  });

  const draw = useCallback(() => {
    const s = live.current;
    const node = canvas.current;
    const ctx = node?.getContext("2d");
    const l = s.layout;
    if (!ctx || !l || !s.cur) return;

    ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);

    // The stage: a bright centre on the shape falling off to the frame's own
    // grey, so the room is lit from where the subject stands
    const light = ctx.createRadialGradient(
      l.cx,
      l.cy,
      0,
      l.cx,
      l.cy,
      Math.max(l.w, l.h) * 0.75,
    );
    light.addColorStop(0, s.tones[0]);
    light.addColorStop(0.45, s.tones[1]);
    light.addColorStop(1, s.tones[2]);
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, l.w, l.h);

    floor(ctx, l.w, l.h, l.horizon, l.cx, s.grid, [
      [0, 0],
      [0.3, 0.45],
      [1, 1],
    ]);

    const bob = s.reduce ? 0 : Math.sin(s.time * 0.7) * l.r * FLOAT;

    // a soft pool on the floor under the shape, which shrinks as it rises
    const lift = 1 - bob / (l.r * FLOAT * 4);
    const pool = ctx.createRadialGradient(
      l.cx,
      l.horizon + l.r * 0.2,
      0,
      l.cx,
      l.horizon + l.r * 0.2,
      l.r * 0.9 * lift,
    );
    pool.addColorStop(0, "rgb(0 0 0 / 0.07)");
    pool.addColorStop(1, "rgb(0 0 0 / 0)");
    ctx.save();
    ctx.translate(0, l.horizon + l.r * 0.2);
    ctx.scale(1, 0.18);
    ctx.translate(0, -(l.horizon + l.r * 0.2));
    ctx.fillStyle = pool;
    ctx.fillRect(l.cx - l.r, l.horizon - l.r * 4, l.r * 2, l.r * 8);
    ctx.restore();

    const view: View = {
      cx: l.cx,
      cy: l.cy + bob,
      r: l.r,
      yaw: s.yaw,
      sway: s.reduce ? 0 : Math.sin(s.time * 0.5) * SWAY,
      leanX: s.leanX,
      leanY: s.leanY,
    };
    paint(ctx, view, s.cur, s.size, s.ox, s.oy, s.sx, s.sy, INK);
  }, []);

  /** advances the morph, the spin, the lean and the scatter by `dt` seconds */
  const step = useCallback((dt: number, now: number) => {
    const s = live.current;
    const { from, to, cur, layout: l } = s;
    if (!from || !to || !cur || !l) return;
    const n = cur.x.length;

    if (s.morphAt !== null) {
      const p = (now - s.morphAt) / 1000 / MORPH;
      for (let i = 0; i < n; i++) {
        const t = easeInOut(clamp01((p - s.delay[i]) / (1 - STAGGER)));
        const x = from.x[i] * (1 - t) + to.x[i] * t;
        const z = from.z[i] * (1 - t) + to.z[i] * t;
        const a = SWIRL * Math.PI * 2 * Math.sin(Math.PI * t);
        const [ca, sa] = [Math.cos(a), Math.sin(a)];
        cur.x[i] = x * ca + z * sa;
        cur.z[i] = -x * sa + z * ca;
        cur.y[i] = from.y[i] * (1 - t) + to.y[i] * t;
        cur.spin[i] = from.spin[i] * (1 - t) + to.spin[i] * t;
      }
      if (p >= 1) {
        s.from = copyCloud(to);
        s.cur = copyCloud(to);
        s.morphAt = null;
      }
    }

    s.time += dt;
    s.yaw += SPIN * Math.PI * 2 * dt;
    // the yaw wraps only between morphs, since a point blending between the
    // spin and the word's sway would jump by a turn if it wrapped mid-flight
    if (s.morphAt === null && s.yaw > Math.PI) s.yaw -= Math.PI * 2;

    const p = s.pointer;
    const toX = p ? clamp01((p.y - l.cy) / l.h + 0.5) * 2 - 1 : 0;
    const toY = p ? clamp01((p.x - l.cx) / l.w + 0.5) * 2 - 1 : 0;
    const k = approach(LEAN_TAU, dt);
    s.leanX += (toX * LEAN - s.leanX) * k;
    s.leanY += (toY * LEAN - s.leanY) * k;

    // The scatter tests each dot's resting place on screen, which is where it
    // landed last frame less its own push, so a pushed dot cannot push itself
    // further and the hole holds still under a still pointer
    const reach = l.reach;
    for (let i = 0; i < n; i++) {
      let tx = 0;
      let ty = 0;
      if (p) {
        const bx = s.sx[i] - s.ox[i];
        const by = s.sy[i] - s.oy[i];
        const dx = bx - p.x;
        const dy = by - p.y;
        const d = Math.hypot(dx, dy);
        if (d < reach && d > 0.001) {
          const f = (1 - d / reach) ** 2 * reach * PUSH;
          tx = (dx / d) * f;
          ty = (dy / d) * f;
        }
      }
      s.vx[i] += (K * (tx - s.ox[i]) - C * s.vx[i]) * dt;
      s.vy[i] += (K * (ty - s.oy[i]) - C * s.vy[i]) * dt;
      s.ox[i] += s.vx[i] * dt;
      s.oy[i] += s.vy[i] * dt;
    }
  }, []);

  const tick = useCallback(
    function frame(now: number) {
      const s = live.current;
      s.raf = 0;
      // a stalled tab comes back to a 50ms step at most, not a leap
      const dt = Math.min(0.05, (now - s.last) / 1000);
      s.last = now;
      step(dt, now);
      draw();
      if (s.seen && !s.reduce) s.raf = requestAnimationFrame(frame);
    },
    [draw, step],
  );

  const start = useCallback(() => {
    const s = live.current;
    if (s.raf || !s.seen || s.reduce || !s.cur) return;
    s.last = performance.now();
    s.raf = requestAnimationFrame(tick);
  }, [tick]);

  useEffect(() => {
    const s = live.current;
    s.reduce = reduce === true;
    if (s.reduce) {
      cancelAnimationFrame(s.raf);
      s.raf = 0;
      s.leanX = 0;
      s.leanY = 0;
      s.ox.fill(0);
      s.oy.fill(0);
      s.vx.fill(0);
      s.vy.fill(0);
      draw();
    } else {
      start();
    }
  }, [reduce, draw, start]);

  // the stage's size, the dot count and the clouds, all off one measurement
  useEffect(() => {
    const node = stage.current;
    const c = canvas.current;
    if (!node || !c) return;
    const s = live.current;
    const root = getComputedStyle(document.documentElement);
    const token = (name: string) =>
      root.getPropertyValue(`--color-${name}`).trim();
    s.grid = rgbOf(token("stroke-strong"));
    s.tones = [token("bg"), token("surface"), token("fill")];

    const read = () => {
      const w = node.clientWidth;
      const h = node.clientHeight;
      if (w === 0 || h === 0) return;
      s.dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = Math.round(w * s.dpr);
      c.height = Math.round(h * s.dpr);
      s.layout = layout(w, h);

      // the count is picked once, on the first measurement, so a window being
      // dragged across the breakpoint does not reshuffle every dot
      if (!s.cur) {
        const n = s.layout.narrow ? COUNT.narrow : COUNT.wide;
        const first = build(ORDER[0], n);
        s.from = first;
        s.to = copyCloud(first);
        s.cur = copyCloud(first);
        s.size = new Float32Array(n);
        s.delay = new Float32Array(n);
        for (let i = 0; i < n; i++) {
          s.size[i] = 1.4 + hash(i, 20) * 1.4;
          // top first, since the clouds are sorted from the bottom up
          s.delay[i] = STAGGER * (0.75 * (1 - i / n) + 0.25 * hash(i, 21));
        }
        for (const key of ["ox", "oy", "vx", "vy", "sx", "sy"] as const) {
          s[key] = new Float32Array(n);
        }
        s.clouds.set(ORDER[0], first);
        // The rest are built once the page has settled and the face has
        // loaded, since the word is sampled from Inter's own glyphs. Built on
        // the press instead, the sort of 3,500 points was the one long frame
        // in the whole demo: 50ms under a 4x CPU throttle.
        document.fonts.ready.then(() => {
          for (const key of ORDER) {
            if (!s.clouds.has(key)) s.clouds.set(key, build(key, n));
          }
        });
      }
      draw();
      start();
    };
    read();
    const resize = new ResizeObserver(read);
    resize.observe(node);

    // no frames for a stage nobody is looking at
    const seen = new IntersectionObserver(([entry]) => {
      s.seen = entry?.isIntersecting ?? false;
      if (s.seen) start();
    });
    seen.observe(node);

    return () => {
      resize.disconnect();
      seen.disconnect();
      cancelAnimationFrame(s.raf);
      s.raf = 0;
    };
  }, [draw, start]);

  // The pointer, in stage pixels. Every pointer type: a finger dragged across
  // the stage scatters the dots too, and the browser cancels it into a scroll
  // the moment the page is what the finger wanted, which is the release.
  useEffect(() => {
    const node = stage.current;
    if (!node) return;
    const s = live.current;
    const move = (e: PointerEvent) => {
      if (s.reduce) return;
      const rect = node.getBoundingClientRect();
      s.pointer = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      start();
    };
    const leave = () => {
      s.pointer = null;
    };
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerdown", move);
    node.addEventListener("pointerleave", leave);
    node.addEventListener("pointercancel", leave);
    return () => {
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerdown", move);
      node.removeEventListener("pointerleave", leave);
      node.removeEventListener("pointercancel", leave);
    };
  }, [start]);

  const next = useCallback(() => {
    const s = live.current;
    if (!s.cur) return;
    const n = s.cur.x.length;
    const key = ORDER[(shape + 1) % ORDER.length];
    // a press mid-flight starts from wherever the dots are, never from the
    // shape they left, so nothing jumps back
    s.from = copyCloud(s.cur);
    let target = s.clouds.get(key);
    if (!target) {
      target = build(key, n);
      s.clouds.set(key, target);
    }
    s.to = copyCloud(target);
    if (s.reduce) {
      s.from = copyCloud(s.to);
      s.cur = copyCloud(s.to);
      s.morphAt = null;
      draw();
    } else {
      s.morphAt = performance.now();
      start();
    }
    setShape((i) => (i + 1) % ORDER.length);
  }, [shape, draw, start]);

  const key = ORDER[shape];

  return (
    <div
      ref={stage}
      className="relative isolate aspect-8/5 min-h-78 w-full select-none overflow-hidden rounded-lg bg-fill"
    >
      <div aria-hidden="true" className="absolute inset-0">
        <canvas ref={canvas} className="block size-full" />
      </div>

      <span aria-live="polite" className="sr-only">
        {PHRASE[key].now}
      </span>

      <div className="absolute inset-x-0 bottom-8 flex justify-center">
        <Pill lead onClick={next} label={PHRASE[key].next}>
          <TextMorph duration={200} ease="cubic-bezier(0.4, 0, 0.2, 1)">
            {PHRASE[key].next}
          </TextMorph>
          <ArrowRightIcon aria-hidden="true" className="size-3" />
        </Pill>
      </div>

      {/* the stage's own hairline, over the canvas, which paints over the
          frame's inset ring the way the notch drop's white does */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-lg ring-1 ring-stroke ring-inset"
      />
    </div>
  );
}
