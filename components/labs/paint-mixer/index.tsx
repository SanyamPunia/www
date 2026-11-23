"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { TextMorph } from "torph/react";
import { ArrowsClockwiseIcon, EraserIcon } from "@/components/icons";
import { CopyMark } from "@/components/ui/copy-mark";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { approach } from "@/lib/lerp";
import { cn } from "@/lib/utils";
import {
  clearWell,
  createFluid,
  DISH,
  type Fluid,
  render,
  SAMPLE,
  type Splat,
  sample,
  scaleDye,
  splat,
  step,
  WELL,
} from "./fluid";
import { armPaint, plop } from "./paint-sound";
import { ksOf, mixRecipe, nameOf, PIGMENTS, type Rgb, toHex } from "./pigments";

/*
 * A colour picker that works like a paint well. Drop pigments in, stir with
 * the pointer, and the mixture under the ring at the centre is the colour
 * picked, with a name and its hex.
 *
 * `fluid.ts` is the simulation and the drawing, `pigments.ts` the paint model.
 * This file is the gestures and the frame loop. Nothing renders per frame:
 * the loop reads refs, writes the swatch and the hex to their nodes, and
 * React only hears about a new name or a new drop.
 */

/** a quiet text button on the stage's `fill` ground, one step up the fills */
const TOOL =
  "flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-action text-text-secondary transition-all duration-150 hover:bg-fill-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2 focus-visible:ring-offset-fill active:bg-fill-active disabled:cursor-not-allowed disabled:opacity-50";

/** the readout's one curve, for the morphs, the rows and the entrance */
const CURVE = [0.32, 0.72, 0, 1] as const;
const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

/** a bar segment grows from nothing, and shrinks back last first on a rinse */
const SEGMENT = {
  out: (i: number) => ({
    flexGrow: 0,
    opacity: 0,
    transition: { duration: 0.5, ease: CURVE, delay: i * 0.05 },
  }),
};

/** a legend row rises in, and leaves last first on a rinse */
const ROW = {
  in: { opacity: 1, y: 0, transition: { duration: 0.3, ease: CURVE } },
  out: (i: number) => ({
    opacity: 0,
    y: -3,
    transition: { duration: 0.28, ease: CURVE, delay: i * 0.06 },
  }),
};

/**
 * The panel's entrance the first time it is seen: the pigments, then the two
 * tools, then the chip, each rising 6px as it fades in, on the site's stagger.
 */
const PANEL = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } },
};
const ENTER = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: CURVE } },
};

/** the dish's porcelain, scoped here: the dish is the object */
const PORCELAIN = "#f7f5f0";
/** one drop's paint, before its pigment's tinting strength */
const AMOUNT = 2.4;
/** a drop's radius as a share of the canvas */
const DROP = 0.085;
/** how long the loop runs on after the last touch, in ms */
const SETTLE = 4500;
/** a centre covered less than this reads as an empty well */
const EMPTY = 0.12;
/** how long a rinse drains for, in seconds */
const DRAIN = 0.6;
/** how long a landed drop takes to spread into the well, in ms */
const SPREAD = 460;
/** a thrown drop's flight, in ms, and how high it arcs, in px */
const FLIGHT = 620;
const ARC = 96;
/** a swirl's force rises and falls over this long, in ms */
const SWIRL = 1500;
/** the time constant the stirring hand's speed is smoothed over, in s */
const HAND = 0.07;

/** a drop spreading into the well, deposited a little each frame */
interface Pour {
  ks: Rgb;
  w: number;
  x: number;
  y: number;
  size: number;
  t0: number;
  dur: number;
  done: number;
}

function floats(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** an integer hash to 0..1, so tapped drops land in the same places each visit */
function hash(n: number): number {
  let x = Math.imul(n + 0x9e3779b9, 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

/** a glossy dab of paint, as a CSS background */
function dab(hex: string): React.CSSProperties {
  return {
    background: `radial-gradient(circle at 34% 30%, rgba(255,255,255,0.75) 0 9%, rgba(255,255,255,0) 22%), radial-gradient(circle at 60% 70%, rgba(0,0,0,0.18), rgba(0,0,0,0) 60%), ${hex}`,
    boxShadow:
      "inset 0 -2px 4px rgba(0,0,0,0.22), inset 0 1px 1px rgba(255,255,255,0.35), 0 1px 2px rgba(0,0,0,0.18), 0 3px 8px -2px rgba(0,0,0,0.18)",
  };
}

/**
 * Which ink reads on a colour: the site's near black or its near white,
 * whichever has the higher contrast, so the chip's name can sit on the paint.
 */
function inkOf(rgb: Rgb): "dark" | "light" {
  const lin = rgb.map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  const L = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  return (L + 0.05) / 0.0603 >= 1.0 / (L + 0.05) ? "dark" : "light";
}

/**
 * Each pigment's share of the drops as whole percents that sum to 100, by
 * largest remainder, so the legend never reads 99 or 101.
 */
function shares(counts: readonly number[]): number[] {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return counts.map(() => 0);
  const raw = counts.map((n) => (n / total) * 100);
  const out = raw.map(Math.floor);
  let left = 100 - out.reduce((a, b) => a + b, 0);
  const order = raw
    .map((v, i) => [v - Math.floor(v), i] as const)
    .sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (left <= 0) break;
    if (counts[i] === 0) continue;
    out[i]++;
    left--;
  }
  return out;
}

/**
 * One frame of a drop spreading: the share of its paint due by now, in a ring
 * that widens from a third of the drop to all of it, with a push outward at
 * its edge. The share eases out, so the paint lands quickly and settles. Each
 * slice is scaled by the drop's area over its own, so the total is one drop's
 * worth whatever the steps.
 */
function pour(f: Fluid, p: Pour, now: number) {
  const e = p.dur <= 0 ? 1 : Math.min(1, Math.max(0, (now - p.t0) / p.dur));
  const share = 1 - (1 - e) ** 3;
  const dm = share - p.done;
  p.done = e >= 1 ? 1 : share;
  if (dm <= 0) return;
  const size = p.size * (0.34 + 0.66 * Math.sqrt(share));
  const v = p.w * dm * (p.size / size) ** 2;
  splat(f, {
    kind: "dye",
    x: p.x,
    y: p.y,
    size,
    value: [p.ks[0] * v, p.ks[1] * v, p.ks[2] * v, v],
  });
  if (p.dur <= 0 || p.size < DROP * 0.5) return;
  splat(f, {
    kind: "velocity",
    x: p.x,
    y: p.y,
    size: size * 1.1,
    value: [0, 0, 0, 0],
    radial: dm * 2.2,
  });
}

/** one frame of a swirl's force, `k` its envelope times the frame's dt */
function push(f: Fluid, k: number) {
  for (const [radius, speed, count] of [
    [0.21, 2.6, 12],
    [0.1, 1.6, 6],
  ] as const) {
    for (let n = 0; n < count; n++) {
      const a = (n / count) * Math.PI * 2;
      splat(f, {
        kind: "velocity",
        x: 0.5 + Math.cos(a) * radius,
        y: 0.5 + Math.sin(a) * radius,
        size: 0.075,
        value: [-Math.sin(a) * speed * k, Math.cos(a) * speed * k, 0, 0],
      });
    }
  }
}

export default function PaintMixer() {
  const reduce = useReducedMotion();
  const stage = useRef<HTMLDivElement>(null);
  const well = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const ghost = useRef<HTMLDivElement>(null);
  const swatch = useRef<HTMLDivElement>(null);
  const hexText = useRef<HTMLSpanElement>(null);
  const dabs = useRef<(HTMLButtonElement | null)[]>([]);

  const [failed, setFailed] = useState(false);
  const [counts, setCounts] = useState<number[]>(() => PIGMENTS.map(() => 0));
  const [name, setName] = useState("");
  const [copied, setCopied] = useState(false);

  const live = useRef({
    fluid: null as Fluid | null,
    raf: 0,
    last: 0,
    frame: 0,
    seen: false,
    seeded: false,
    reduce: false,
    size: 0,
    dpr: 1,
    lastInput: 0,
    drainUntil: 0,
    flights: 0,
    drops: 0,
    queue: [] as Splat[],
    pours: [] as Pour[],
    swirls: [] as number[],
    stir: null as null | {
      id: number;
      x: number;
      y: number;
      t: number;
      vx: number;
      vy: number;
    },
    drag: null as null | {
      id: number;
      i: number;
      x: number;
      y: number;
      moved: boolean;
    },
    hex: "",
    name: "",
  });

  /** writes the readout, from the centre of the well or from the recipe */
  const show = useCallback((rgb: Rgb | null) => {
    const s = live.current;
    const hex = rgb ? toHex(rgb) : "";
    if (hex === s.hex) return;
    s.hex = hex;
    if (swatch.current) {
      swatch.current.style.backgroundColor = hex || PORCELAIN;
      swatch.current.dataset.ink =
        rgb && inkOf(rgb) === "light" ? "light" : "dark";
    }
    // an empty well fades the last hex out rather than blanking it, so the
    // chip drains with the paint
    if (hexText.current) {
      if (hex) hexText.current.textContent = hex;
      hexText.current.style.opacity = hex ? "" : "0";
    }
    const next = rgb ? nameOf(rgb) : "";
    if (next !== s.name) {
      s.name = next;
      setName(next);
    }
  }, []);

  const readout = useCallback(() => {
    const f = live.current.fluid;
    // a draining well has already been read as empty, and a read part way
    // down would put the colour back on the chip
    if (!f || live.current.drainUntil) return;
    const [r, g, b, cover] = sample(f);
    show(cover < EMPTY ? null : [r / 255, g / 255, b / 255]);
  }, [show]);

  const draw = useCallback(() => {
    const s = live.current;
    const c = canvas.current;
    if (!s.fluid || !c) return;
    render(s.fluid, c.width, c.height);
  }, []);

  const tick = useCallback(
    (now: number) => {
      const s = live.current;
      const f = s.fluid;
      if (!f) {
        s.raf = 0;
        return;
      }
      const dt = Math.min(1 / 30, Math.max(0, (now - s.last) / 1000));
      s.last = now;
      for (const sp of s.queue) splat(f, sp);
      s.queue.length = 0;
      for (const p of s.pours) pour(f, p, now);
      s.pours = s.pours.filter((p) => p.done < 1);
      s.swirls = s.swirls.filter((t0) => {
        const e = (now - t0) / SWIRL;
        if (e >= 1) return false;
        if (e > 0) push(f, Math.sin(Math.PI * e) ** 2 * dt);
        return true;
      });
      if (s.drainUntil) {
        if (now >= s.drainUntil) {
          clearWell(f);
          s.drainUntil = 0;
        } else {
          scaleDye(f, Math.exp(-dt * 7));
        }
      }
      if (dt > 0) step(f, dt);
      draw();
      s.frame++;
      if (s.frame % 4 === 0) readout();
      const busy =
        s.stir !== null ||
        s.drainUntil > 0 ||
        s.flights > 0 ||
        s.pours.length > 0 ||
        s.swirls.length > 0 ||
        now - s.lastInput < SETTLE;
      if (s.seen && busy) {
        s.raf = requestAnimationFrame(tick);
      } else {
        s.raf = 0;
        readout();
      }
    },
    [draw, readout],
  );

  const start = useCallback(() => {
    const s = live.current;
    s.lastInput = performance.now();
    if (s.raf || !s.seen || !s.fluid) return;
    s.last = performance.now();
    s.raf = requestAnimationFrame(tick);
  }, [tick]);

  /** the well's uv under a client point, with y up as the simulation has it */
  const uvAt = useCallback((x: number, y: number): [number, number] | null => {
    const c = canvas.current;
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return [(x - r.left) / r.width, 1 - (y - r.top) / r.height];
  }, []);

  /** a point on the stage, in px, from a uv in the well */
  const stageAt = useCallback((uv: [number, number]): [number, number] => {
    const c = canvas.current?.getBoundingClientRect();
    const st = stage.current?.getBoundingClientRect();
    if (!c || !st) return [0, 0];
    return [
      c.left - st.left + uv[0] * c.width,
      c.top - st.top + (1 - uv[1]) * c.height,
    ];
  }, []);

  /**
   * What a landing does above the paint: a ring of light leaves the point, and
   * a few droplets are thrown out and land as small dabs of their own.
   */
  const impact = useCallback(
    (i: number, uv: [number, number]) => {
      const s = live.current;
      const host = layer.current;
      const c = canvas.current;
      const p = PIGMENTS[i];
      if (!host || !c || !p) return;
      const [x, y] = stageAt(uv);
      const px = c.getBoundingClientRect().width;
      const size = DROP * px * 2;

      const ring = document.createElement("div");
      ring.className = "absolute top-0 left-0 rounded-full";
      Object.assign(ring.style, {
        width: `${size}px`,
        height: `${size}px`,
        border: "1.5px solid rgba(255,255,255,0.8)",
        boxShadow: "0 0 0 1px rgba(0,0,0,0.06)",
        transform: `translate(${x - size / 2}px, ${y - size / 2}px) scale(0.35)`,
      });
      host.append(ring);
      ring.animate(
        [
          {
            transform: `translate(${x - size / 2}px, ${y - size / 2}px) scale(0.35)`,
            opacity: 0.9,
          },
          {
            transform: `translate(${x - size / 2}px, ${y - size / 2}px) scale(1.5)`,
            opacity: 0,
          },
        ],
        {
          duration: 620,
          easing: "cubic-bezier(0.2, 0.8, 0.3, 1)",
          fill: "forwards",
        },
      ).onfinish = () => ring.remove();

      const turn = hash(s.drops * 7) * Math.PI * 2;
      for (let k = 0; k < 4; k++) {
        const a = turn + (k / 4) * Math.PI * 2 + (hash(s.drops * 13 + k) - 0.5);
        const reach = size * (0.42 + hash(s.drops * 17 + k) * 0.35);
        const tx = x + Math.cos(a) * reach;
        const ty = y + Math.sin(a) * reach;
        const r = 3 + hash(s.drops * 19 + k) * 2;
        const dot = document.createElement("div");
        dot.className = "absolute top-0 left-0 rounded-full";
        Object.assign(dot.style, dab(p.hex), {
          width: `${r * 2}px`,
          height: `${r * 2}px`,
          transform: `translate(${x - r}px, ${y - r}px)`,
        });
        host.append(dot);
        const hop = 14 + reach * 0.2;
        const frames: Keyframe[] = [];
        for (let n = 0; n <= 12; n++) {
          const t = n / 12;
          const z = 4 * hop * t * (1 - t);
          frames.push({
            transform: `translate(${x + (tx - x) * t - r}px, ${y + (ty - y) * t - z - r}px) scale(${1 + (z / hop) * 0.3})`,
          });
        }
        dot.animate(frames, {
          duration: 300 + k * 30,
          fill: "forwards",
          easing: "linear",
        }).onfinish = () => {
          dot.remove();
          const c2 = canvas.current?.getBoundingClientRect();
          const st = stage.current?.getBoundingClientRect();
          if (!c2 || !st) return;
          const u = (tx + st.left - c2.left) / c2.width;
          const v = 1 - (ty + st.top - c2.top) / c2.height;
          if (Math.hypot(u - 0.5, v - 0.5) > WELL * 0.95) return;
          s.pours.push({
            ks: ksOf(p),
            w: AMOUNT * p.strength * 0.3,
            x: u,
            y: v,
            size: DROP * 0.22,
            t0: performance.now(),
            dur: 140,
            done: 0,
          });
          start();
        };
      }
    },
    [stageAt, start],
  );

  /** a drop of pigment `i` lands at `uv` */
  const land = useCallback(
    (i: number, uv: [number, number]) => {
      const s = live.current;
      const p = PIGMENTS[i];
      if (!p) return;
      s.drops++;
      setCounts((prev) => prev.map((n, k) => (k === i ? n + 1 : n)));
      plop(i / (PIGMENTS.length - 1));
      if (!s.fluid) return;
      s.pours.push({
        ks: ksOf(p),
        w: AMOUNT * p.strength,
        x: uv[0],
        y: uv[1],
        size: DROP,
        t0: performance.now(),
        dur: s.reduce ? 0 : SPREAD,
        done: 0,
      });
      if (!s.reduce) impact(i, uv);
      start();
    },
    [start, impact],
  );

  /**
   * A drop thrown from a dab to `uv`, or placed there under reduced motion.
   *
   * The flight is ballistic: the ground point travels in a straight line and
   * the height is a parabola, so the drop is fastest as it comes down. It
   * grows as it rises toward the eye, stretches along its own velocity, and
   * its shadow crosses the stage on the ground under it, shrinking and
   * darkening as the drop comes down to meet it.
   */
  const throwDrop = useCallback(
    (i: number, uv: [number, number]) => {
      const s = live.current;
      const host = layer.current;
      const from = dabs.current[i]?.querySelector("[data-dab]");
      const st = stage.current?.getBoundingClientRect();
      if (s.reduce || !host || !from || !st) {
        land(i, uv);
        return;
      }
      const a = from.getBoundingClientRect();
      const x0 = a.left - st.left + a.width / 2;
      const y0 = a.top - st.top + a.height / 2;
      const [x1, y1] = stageAt(uv);
      const hex = PIGMENTS[i]?.hex ?? "#000";
      const R = 13;
      const H = Math.min(ARC, 40 + Math.hypot(x1 - x0, y1 - y0) * 0.25);

      const drop = document.createElement("div");
      drop.className = "absolute top-0 left-0 rounded-full";
      Object.assign(drop.style, dab(hex), {
        width: `${R * 2}px`,
        height: `${R * 2}px`,
        transform: `translate(${x0 - R}px, ${y0 - R}px)`,
      });
      const shade = document.createElement("div");
      shade.className = "absolute top-0 left-0 rounded-full";
      Object.assign(shade.style, {
        width: `${R * 2}px`,
        height: `${R * 2}px`,
        background:
          "radial-gradient(closest-side, rgba(0,0,0,0.45), rgba(0,0,0,0))",
        transform: `translate(${x0 - R}px, ${y0 - R + 6}px)`,
        opacity: "0",
      });
      host.append(shade, drop);
      s.flights++;

      const N = 32;
      const body: Keyframe[] = [];
      const ground: Keyframe[] = [];
      for (let k = 0; k <= N; k++) {
        const t = k / N;
        const x = x0 + (x1 - x0) * t;
        const y = y0 + (y1 - y0) * t;
        const z = 4 * H * t * (1 - t);
        const h = z / H;
        // screen velocity: the ground's run plus the height's fall
        const vx = x1 - x0;
        const vy = y1 - y0 - 4 * H * (1 - 2 * t);
        const turn = (Math.atan2(vy, vx) * 180) / Math.PI;
        const pull = Math.min(0.38, Math.hypot(vx, vy) / 1400);
        const near = 1 + h * 0.42;
        body.push({
          transform: `translate(${x - R}px, ${y - z - R}px) rotate(${turn}deg) scale(${near * (1 + pull)}, ${near / (1 + pull * 0.6)}) rotate(${-turn}deg)`,
        });
        ground.push({
          transform: `translate(${x - R}px, ${y - R + 6}px) scale(${0.9 + h * 1.1}, ${(0.9 + h * 1.1) * 0.55})`,
          opacity: 0.55 - h * 0.4,
        });
      }
      const flight = drop.animate(body, {
        duration: FLIGHT,
        easing: "linear",
        fill: "forwards",
      });
      shade.animate(ground, {
        duration: FLIGHT,
        easing: "linear",
        fill: "forwards",
      });
      flight.onfinish = () => {
        // the drop flattens into the paint as it lands, and its shadow goes
        // with it
        drop.animate(
          [
            {
              transform: `translate(${x1 - R}px, ${y1 - R}px) scale(1, 1)`,
              opacity: 1,
            },
            {
              transform: `translate(${x1 - R}px, ${y1 - R}px) scale(1.55, 0.5)`,
              opacity: 0.85,
              offset: 0.45,
            },
            {
              transform: `translate(${x1 - R}px, ${y1 - R}px) scale(1.9, 0.3)`,
              opacity: 0,
            },
          ],
          {
            duration: 170,
            easing: "cubic-bezier(0.2, 0.7, 0.3, 1)",
            fill: "forwards",
          },
        ).onfinish = () => drop.remove();
        shade.animate([{ opacity: 0.55 }, { opacity: 0 }], {
          duration: 140,
          fill: "forwards",
        }).onfinish = () => shade.remove();
        s.flights--;
        land(i, uv);
      };
    },
    [land, stageAt],
  );

  /** where a tapped drop goes: near the centre, seeded by how many have fallen */
  const tapSpot = useCallback((): [number, number] => {
    const n = live.current.drops;
    const a = hash(n * 2 + 1) * Math.PI * 2;
    const r = Math.sqrt(hash(n * 2 + 2)) * 0.15;
    return [0.5 + Math.cos(a) * r, 0.5 + Math.sin(a) * r];
  }, []);

  const swirl = useCallback(() => {
    const s = live.current;
    if (!s.fluid) return;
    armPaint();
    s.swirls.push(performance.now());
    start();
  }, [start]);

  const rinse = useCallback(() => {
    const s = live.current;
    setCounts(PIGMENTS.map(() => 0));
    s.drops = 0;
    s.pours = [];
    s.swirls = [];
    if (!s.fluid) return;
    if (s.reduce) {
      clearWell(s.fluid);
      draw();
      readout();
      return;
    }
    s.drainUntil = performance.now() + DRAIN * 1000;
    // the chip drains with the well, on the drain's own length
    const chip = swatch.current;
    if (chip) {
      chip.style.transitionDuration = `${DRAIN * 1000}ms`;
      window.setTimeout(
        () => {
          chip.style.transitionDuration = "";
        },
        DRAIN * 1000 + 100,
      );
    }
    show(null);
    start();
  }, [draw, readout, show, start]);

  // the stir: a hand in the well pushes the paint the way it moves
  const onWellDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const uv = uvAt(e.clientX, e.clientY);
    if (!uv || Math.hypot(uv[0] - 0.5, uv[1] - 0.5) > DISH) return;
    armPaint();
    e.currentTarget.setPointerCapture(e.pointerId);
    live.current.stir = {
      id: e.pointerId,
      x: uv[0],
      y: uv[1],
      t: e.timeStamp,
      vx: 0,
      vy: 0,
    };
    stage.current?.setAttribute("data-carry", "true");
    start();
  };

  const onWellMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = live.current;
    const st = s.stir;
    if (!st || st.id !== e.pointerId) return;
    const uv = uvAt(e.clientX, e.clientY);
    if (!uv) return;
    const dt = Math.max(0.008, (e.timeStamp - st.t) / 1000);
    let vx = (uv[0] - st.x) / dt;
    let vy = (uv[1] - st.y) / dt;
    const speed = Math.hypot(vx, vy);
    if (speed > 3) {
      vx = (vx / speed) * 3;
      vy = (vy / speed) * 3;
    }
    // the hand's speed is smoothed, so the paint takes up a stir rather than
    // jumping to it
    const k = approach(HAND, dt);
    st.vx += (vx - st.vx) * k;
    st.vy += (vy - st.vy) * k;
    s.queue.push({
      kind: "velocity",
      x: uv[0],
      y: uv[1],
      size: 0.05,
      value: [st.vx * 0.22, st.vy * 0.22, 0, 0],
    });
    st.x = uv[0];
    st.y = uv[1];
    st.t = e.timeStamp;
    start();
  };

  const endStir = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = live.current;
    if (s.stir?.id !== e.pointerId) return;
    s.stir = null;
    stage.current?.removeAttribute("data-carry");
    start();
  };

  // a dab is tapped to throw a drop, or dragged into the well and let go
  const onDabDown = (i: number, e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    armPaint();
    e.currentTarget.setPointerCapture(e.pointerId);
    live.current.drag = {
      id: e.pointerId,
      i,
      x: e.clientX,
      y: e.clientY,
      moved: false,
    };
  };

  const onDabMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = live.current.drag;
    if (!d || d.id !== e.pointerId) return;
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6) return;
    const g = ghost.current;
    const st = stage.current?.getBoundingClientRect();
    if (!g || !st) return;
    if (!d.moved) {
      d.moved = true;
      Object.assign(g.style, dab(PIGMENTS[d.i]?.hex ?? "#000"));
      stage.current?.setAttribute("data-carry", "true");
    }
    g.style.opacity = "1";
    g.style.transform = `translate(${e.clientX - st.left - 16}px, ${e.clientY - st.top - 16}px)`;
  };

  const onDabUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const s = live.current;
    const d = s.drag;
    if (!d || d.id !== e.pointerId) return;
    s.drag = null;
    stage.current?.removeAttribute("data-carry");
    if (ghost.current) ghost.current.style.opacity = "0";
    if (!d.moved) {
      throwDrop(d.i, tapSpot());
      return;
    }
    const uv = uvAt(e.clientX, e.clientY);
    if (uv && Math.hypot(uv[0] - 0.5, uv[1] - 0.5) < WELL * 0.94) {
      land(d.i, uv);
    }
  };

  const onDabCancel = () => {
    live.current.drag = null;
    stage.current?.removeAttribute("data-carry");
    if (ghost.current) ghost.current.style.opacity = "0";
  };

  const copy = async () => {
    const hex = live.current.hex;
    if (!hex) return;
    try {
      await navigator.clipboard.writeText(hex);
    } catch {
      // the hex is on screen either way
    }
    setCopied(true);
  };

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1400);
    return () => window.clearTimeout(t);
  }, [copied]);

  useEffect(() => {
    live.current.reduce = reduce === true;
  }, [reduce]);

  // without the simulation the well is mixed at once, from the recipe
  useEffect(() => {
    if (failed) show(mixRecipe(counts));
  }, [failed, counts, show]);

  // the context, the canvas's size, and whether anyone is looking
  useEffect(() => {
    const box = well.current;
    const c = canvas.current;
    if (!box || !c) return;
    const s = live.current;

    const init = () => {
      const gl = c.getContext("webgl2", {
        alpha: true,
        antialias: false,
        premultipliedAlpha: true,
        powerPreference: "low-power",
      });
      s.fluid = gl ? createFluid(gl, floats(PORCELAIN)) : null;
      setFailed(!s.fluid);
    };
    init();

    const size = () => {
      const w = box.clientWidth;
      if (w === 0) return;
      s.size = w;
      s.dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = Math.round(w * s.dpr);
      c.height = Math.round(w * s.dpr);
      draw();
    };
    size();
    const resize = new ResizeObserver(size);
    resize.observe(box);

    const seen = new IntersectionObserver(([entry]) => {
      s.seen = entry?.isIntersecting ?? false;
      if (!s.seen) return;
      // the first time the well is seen, two drops fall into it, so the demo
      // opens on paint rather than on an empty dish
      if (!s.seeded) {
        s.seeded = true;
        window.setTimeout(() => throwDrop(1, [0.43, 0.56]), 450);
        window.setTimeout(() => throwDrop(4, [0.57, 0.45]), 800);
      }
      start();
    });
    seen.observe(box);

    const lost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(s.raf);
      s.raf = 0;
      s.fluid = null;
    };
    const restored = () => {
      init();
      setCounts(PIGMENTS.map(() => 0));
      s.drops = 0;
      draw();
      readout();
    };
    c.addEventListener("webglcontextlost", lost);
    c.addEventListener("webglcontextrestored", restored);

    return () => {
      resize.disconnect();
      seen.disconnect();
      c.removeEventListener("webglcontextlost", lost);
      c.removeEventListener("webglcontextrestored", restored);
      cancelAnimationFrame(s.raf);
      s.raf = 0;
    };
  }, [draw, readout, start, throwDrop]);

  const total = counts.reduce((a, b) => a + b, 0);
  const pct = shares(counts);
  const recipe = PIGMENTS.map((p, i) => ({
    p,
    n: counts[i] ?? 0,
    pct: pct[i] ?? 0,
  }))
    .filter((r) => r.n > 0)
    .sort((a, b) => b.n - a.n);
  const fallback = failed ? mixRecipe(counts) : null;
  const empty = name === "";

  return (
    <div
      ref={stage}
      className="relative isolate flex w-full min-w-0 select-none flex-col items-center gap-6 overflow-hidden rounded-lg bg-fill p-6 ring-1 ring-stroke ring-inset data-carry:cursor-grabbing sm:aspect-8/5 sm:flex-row sm:items-stretch sm:gap-8 sm:p-8 data-carry:[&_*]:cursor-grabbing"
    >
      <div
        ref={well}
        className="relative aspect-square w-full max-w-88 shrink-0 sm:h-full sm:w-auto sm:max-w-none"
      >
        <canvas
          ref={canvas}
          role="img"
          aria-label="A porcelain paint well"
          onPointerDown={onWellDown}
          onPointerMove={onWellMove}
          onPointerUp={endStir}
          onPointerCancel={endStir}
          onLostPointerCapture={endStir}
          className={cn(
            "absolute inset-0 block size-full cursor-grab touch-none",
            failed && "invisible",
          )}
        />
        {failed && (
          <div
            className="absolute rounded-full shadow-[0_6px_18px_-6px_rgba(0,0,0,0.25)]"
            style={{
              inset: `${(0.5 - DISH) * 100}%`,
              backgroundColor: PORCELAIN,
            }}
          >
            <div
              className="absolute rounded-full transition-colors duration-200"
              style={{
                inset: `${((DISH - WELL) / (2 * DISH)) * 100}%`,
                backgroundColor: fallback ? toHex(fallback) : PORCELAIN,
                boxShadow: "inset 0 2px 6px rgba(0,0,0,0.12)",
              }}
            />
          </div>
        )}
        {/* the ring the readout averages under */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-bg shadow-[0_0_0_1px_rgba(0,0,0,0.22),inset_0_0_0_1px_rgba(0,0,0,0.22)]"
          style={{
            left: "50%",
            top: "50%",
            width: `${SAMPLE * 200}%`,
            height: `${SAMPLE * 200}%`,
          }}
        />
      </div>

      <motion.div
        variants={PANEL}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.3 }}
        className="flex w-full min-w-0 max-w-88 flex-col justify-center gap-5 sm:max-w-none sm:flex-1"
      >
        <div className="flex flex-col gap-2">
          <motion.div variants={PANEL} className="grid grid-cols-3 gap-1">
            {PIGMENTS.map((p, i) => (
              <motion.button
                variants={ENTER}
                key={p.id}
                ref={(el) => {
                  dabs.current[i] = el;
                }}
                type="button"
                aria-label={`Drop ${p.full} into the well`}
                onPointerDown={(e) => onDabDown(i, e)}
                onPointerMove={onDabMove}
                onPointerUp={onDabUp}
                onPointerCancel={onDabCancel}
                onClick={(e) => {
                  // a pointer's tap is heard on its release, so only a key or
                  // an assistive technology arrives here
                  if (e.detail === 0) throwDrop(i, tapSpot());
                }}
                className="flex cursor-grab touch-none flex-col items-center gap-1.5 rounded-md py-2 transition-all duration-150 hover:bg-fill-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2 focus-visible:ring-offset-fill active:bg-fill-active"
              >
                <span
                  data-dab
                  aria-hidden="true"
                  className="size-8 rounded-full"
                  style={dab(p.hex)}
                />
                <span className="text-meta text-text-secondary">{p.name}</span>
              </motion.button>
            ))}
          </motion.div>
          {/* what acts on the well sits with what goes into it */}
          <motion.div variants={ENTER} className="flex justify-center gap-1">
            <button
              type="button"
              onClick={swirl}
              disabled={total === 0 || failed}
              className={TOOL}
            >
              <ArrowsClockwiseIcon className="size-3.5" />
              Swirl
            </button>
            <button
              type="button"
              onClick={rinse}
              disabled={total === 0}
              className={TOOL}
            >
              <EraserIcon className="size-3.5" />
              Rinse
            </button>
          </motion.div>
        </div>

        <motion.div
          variants={ENTER}
          className="overflow-hidden rounded-lg bg-bg ring-1 ring-stroke shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_20px_-10px_rgba(0,0,0,0.16)]"
        >
          {/* the chip: the name and hex are printed on the paint */}
          <div
            ref={swatch}
            data-ink="dark"
            className="group relative flex h-28 flex-col justify-end gap-0.5 px-4 py-3.5 transition-colors duration-200 sm:h-32"
            style={{ backgroundColor: PORCELAIN }}
          >
            <TooltipProvider delayDuration={200}>
              <Tooltip label="Copy hex">
                <button
                  type="button"
                  onClick={copy}
                  disabled={empty}
                  aria-label={empty ? "Nothing to copy" : "Copy the hex value"}
                  className="absolute top-2.5 right-2.5 grid size-8 cursor-pointer place-items-center rounded-full text-text-primary/70 transition-all duration-150 hover:bg-black/8 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/25 active:bg-black/14 disabled:cursor-not-allowed disabled:opacity-0 group-data-[ink=light]:text-inverse-text/80 group-data-[ink=light]:hover:bg-white/15 group-data-[ink=light]:hover:text-inverse-text group-data-[ink=light]:focus-visible:ring-inverse-text/40 group-data-[ink=light]:active:bg-white/25"
                >
                  <CopyMark mark="copy" copied={copied} />
                </button>
              </Tooltip>
            </TooltipProvider>
            <span
              className={cn(
                "min-w-0 truncate text-lead transition-colors duration-200",
                empty
                  ? "text-text-secondary"
                  : "text-text-primary group-data-[ink=light]:text-inverse-text",
              )}
            >
              <TextMorph duration={260} ease={EASE}>
                {empty ? "Drop paint in" : name}
              </TextMorph>
            </span>
            <span
              ref={hexText}
              className="h-[1lh] font-mono text-meta text-text-primary/60 normal-case tabular-nums opacity-0 transition-[color,opacity] duration-300 group-data-[ink=light]:text-inverse-text/70"
            />
          </div>

          <div className="flex flex-col gap-2.5 px-4 py-3.5">
            <div className="flex items-baseline justify-between text-meta text-text-secondary">
              <span>In the well</span>
              <TextMorph className="tabular-nums" duration={260} ease={EASE}>
                {total === 0
                  ? "Empty"
                  : `${total} ${total === 1 ? "drop" : "drops"}`}
              </TextMorph>
            </div>
            <div
              aria-hidden="true"
              className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-fill"
            >
              <AnimatePresence initial={false}>
                {recipe.map(({ p, n }, i) => (
                  <motion.span
                    key={p.id}
                    custom={recipe.length - 1 - i}
                    variants={SEGMENT}
                    initial="out"
                    animate={{
                      flexGrow: n,
                      opacity: 1,
                      transition: { duration: 0.45, ease: CURVE },
                    }}
                    exit="out"
                    className="h-full rounded-[2px] outline-1 outline-black/8 -outline-offset-1 first:rounded-l-full last:rounded-r-full"
                    style={{ backgroundColor: p.hex }}
                  />
                ))}
              </AnimatePresence>
            </div>
            {/*
             * Two lines are held open, so the card does not jump when the
             * legend empties or fills. Rows rise in as their pigment first
             * lands, and on a rinse leave one after another, last first, in
             * step with the well draining.
             */}
            <ul className="relative flex min-h-[2.6rem] flex-wrap content-start gap-x-3.5 gap-y-1 text-meta">
              <AnimatePresence initial={false}>
                {recipe.map(({ p, pct: share }, i) => (
                  <motion.li
                    key={p.id}
                    custom={recipe.length - 1 - i}
                    variants={ROW}
                    initial="out"
                    animate="in"
                    exit="out"
                    className="flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <span
                      aria-hidden="true"
                      className="size-2 rounded-full outline-1 outline-black/10 -outline-offset-1"
                      style={{ backgroundColor: p.hex }}
                    />
                    <span className="text-text-secondary">{p.name}</span>
                    <span className="text-text-primary tabular-nums">
                      {share}%
                    </span>
                  </motion.li>
                ))}
              </AnimatePresence>
              <AnimatePresence initial={false}>
                {total === 0 && (
                  <motion.li
                    key="clean"
                    initial={{ opacity: 0 }}
                    animate={{
                      opacity: 1,
                      transition: { delay: 0.35, duration: 0.25 },
                    }}
                    exit={{ opacity: 0, transition: { duration: 0.12 } }}
                    className="absolute top-0 left-0 text-text-secondary"
                  >
                    Drop a pigment in, then stir.
                  </motion.li>
                )}
              </AnimatePresence>
            </ul>
          </div>
        </motion.div>
      </motion.div>

      <div
        ref={layer}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10"
      >
        <div
          ref={ghost}
          className="absolute top-0 left-0 size-8 rounded-full opacity-0 transition-opacity duration-150"
        />
      </div>
      <p aria-live="polite" className="sr-only">
        {empty ? "" : `Mixed colour: ${name}`}
      </p>
      {failed && (
        <p className="absolute bottom-2 left-1/2 -translate-x-1/2 text-meta text-text-secondary">
          The fluid needs WebGL 2, so the paint mixes at once.
        </p>
      )}
    </div>
  );
}
