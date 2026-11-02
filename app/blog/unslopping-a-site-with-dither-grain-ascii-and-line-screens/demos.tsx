"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { TextMorph } from "torph/react";
import { ArrowsLeftRightIcon } from "@/components/icons";
import { approach } from "@/lib/lerp";
import {
  drawAscii,
  drawDither,
  drawGrain,
  drawLines,
  drawPlain,
  type Frame,
  GRAIN_TILE,
  grainTile,
  mapping,
  plainLayer,
  type Rgb,
} from "./paint";
import { lightAt } from "./scene";

/**
 * The post's four figures. Each is the same mock hero with one treatment on
 * its art, so only the marks change from figure to figure. The pointer moves
 * the light, and the pill under each figure swaps in the smooth render the
 * treatment started from.
 *
 * Nothing renders per frame. One loop writes to the canvas while the light or
 * the lens is easing, and grain keeps it running while the figure is on
 * screen, since grain is the one treatment that moves on its own.
 */

type Kind = "dither" | "grain" | "ascii" | "lines";

const NAMES: Record<Kind, string> = {
  dither: "dither",
  grain: "grain",
  ascii: "ascii",
  lines: "line screen",
};

const HINTS: Record<Kind, string> = {
  dither: "Point at the planet to move the light.",
  grain: "Point at the planet to move the light.",
  ascii: "Point at the planet to move the light.",
  lines: "Point at the planet to look through the lines.",
};

/** Where the light rests with no pointer: above and to the left. */
const REST = { x: -0.8, y: -0.75 };
const LIGHT_TAU = 0.12;
const LENS = 46;
const LENS_TAU = 0.09;
/** film runs at 24 frames a second, and so does its grain */
const GRAIN_MS = 42;

/** Out of the prose column, the width the nested-corners post measured. */
const BREAKOUT =
  "relative left-1/2 my-8 flex w-[min(100vw-2rem,54rem)] -translate-x-1/2 select-none flex-col gap-3";

const PILL =
  "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-fill px-3 py-1.5 text-action text-text-secondary transition-colors duration-200 hover:bg-fill-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2 active:bg-fill-active";

const MORPH = {
  duration: 160,
  ease: "cubic-bezier(0.32, 0.72, 0, 1)",
} as const;

/** The ink token, read once, since a canvas fill cannot take a `var()`. */
function readInk(): Rgb {
  const hex = getComputedStyle(document.documentElement)
    .getPropertyValue("--color-text-primary")
    .trim();
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return [26, 26, 26];
  return [
    Number.parseInt(m[1], 16),
    Number.parseInt(m[2], 16),
    Number.parseInt(m[3], 16),
  ];
}

const clampLight = (v: number) => Math.max(-2, Math.min(2, v));

/** The mock product's copy. The same on all four, so only the art changes. */
function Copy() {
  return (
    <div className="order-last flex flex-col justify-center gap-4 p-6 sm:order-first sm:p-9">
      <span className="flex items-center gap-2 text-meta text-text-muted">
        <span className="size-3 rounded-full ring-2 ring-text-primary ring-inset" />
        Orbitkit
      </span>
      <p className="text-[clamp(1.3rem,3.6cqw,1.85rem)] text-text-primary leading-[1.15] tracking-tight text-balance">
        Observability for things in orbit
      </p>
      <p className="text-body text-text-secondary text-pretty">
        Track every pass, packet and battery cycle from one console.
      </p>
      <div className="flex items-center gap-3 pt-1">
        <span className="rounded-full bg-text-primary px-4 py-2 text-action text-bg">
          Start tracking
        </span>
        <span className="text-meta text-text-muted">No card needed</span>
      </div>
    </div>
  );
}

function Figure({ kind }: { kind: Kind }) {
  const reduce = useReducedMotion();
  const [plain, setPlain] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const plainRef = useRef(false);
  const reduceRef = useRef(false);
  const kick = useRef<() => void>(() => {});

  useEffect(() => {
    const el = wrap.current;
    const cv = canvas.current;
    const ctx = cv?.getContext("2d");
    if (!el || !cv || !ctx) return;
    const ink = readInk();
    const layer = document.createElement("canvas");
    const smooth = document.createElement("canvas");
    const tile = kind === "grain" ? grainTile() : null;

    let w = 0;
    let h = 0;
    let dpr = 1;
    const light = { ...REST };
    const target = { ...REST };
    const pointer = { x: 0, y: 0 };
    let lens = 0;
    let lensTarget = 0;
    let grain = { x: 0, y: 0, at: 0 };
    let seen = false;
    let dirty = true;
    let raf = 0;
    let last = 0;

    const paint = () => {
      if (!w) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const f: Frame = {
        ctx,
        w,
        h,
        dpr,
        ink,
        light: lightAt(light.x, light.y),
      };
      if (plainRef.current) {
        plainLayer(smooth, f);
        drawPlain(f, smooth);
        return;
      }
      if (kind === "dither") drawDither(f, layer);
      if (kind === "ascii") drawAscii(f);
      if (kind === "grain" && tile) {
        // drawn darker than plain, since the grain takes ink back out
        plainLayer(layer, f, 1.45);
        drawGrain(f, layer, tile, grain.x, grain.y);
      }
      if (kind === "lines") {
        const open = lens > 0.5;
        if (open) plainLayer(smooth, f);
        drawLines(f, smooth, open ? { ...pointer, r: lens } : null);
      }
    };

    const frame = (now: number) => {
      raf = 0;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      const instant = reduceRef.current;
      const kl = instant ? 1 : approach(LIGHT_TAU, dt);
      const kr = instant ? 1 : approach(LENS_TAU, dt);
      light.x += (target.x - light.x) * kl;
      light.y += (target.y - light.y) * kl;
      lens += (lensTarget - lens) * kr;
      const moving =
        Math.abs(target.x - light.x) > 1e-3 ||
        Math.abs(target.y - light.y) > 1e-3 ||
        Math.abs(lensTarget - lens) > 0.2;
      if (!moving) {
        light.x = target.x;
        light.y = target.y;
        lens = lensTarget;
      }
      const grainy = tile !== null && seen && !plainRef.current && !instant;
      if (grainy && now - grain.at > GRAIN_MS) {
        grain = {
          x: Math.random() * GRAIN_TILE,
          y: Math.random() * GRAIN_TILE,
          at: now,
        };
        dirty = true;
      }
      if (moving || dirty) paint();
      dirty = false;
      if (moving || grainy) raf = requestAnimationFrame(frame);
      else last = 0;
    };

    const run = () => {
      dirty = true;
      if (!raf) raf = requestAnimationFrame(frame);
    };
    kick.current = run;

    const resize = () => {
      const rect = el.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      run();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    const io = new IntersectionObserver(([entry]) => {
      seen = entry.isIntersecting;
      if (seen) run();
    });
    io.observe(el);

    const aim = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
      const { cx, cy, unit } = mapping(w, h);
      target.x = clampLight(((pointer.x - cx) / unit) * 1.4);
      target.y = clampLight(((pointer.y - cy) / unit) * 1.4);
      lensTarget = LENS;
      run();
    };
    const onMove = (e: PointerEvent) => {
      // a finger only aims while it is down, and a drag past slop is a scroll
      if (e.pointerType === "touch" && e.buttons === 0) return;
      aim(e);
    };
    const onLeave = (e: PointerEvent) => {
      // a touch leave is the finger lifting, so a tapped light stays put
      if (e.pointerType === "touch") return;
      target.x = REST.x;
      target.y = REST.y;
      lensTarget = 0;
      run();
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerdown", aim);
    el.addEventListener("pointerleave", onLeave);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerdown", aim);
      el.removeEventListener("pointerleave", onLeave);
      kick.current = () => {};
    };
  }, [kind]);

  useEffect(() => {
    plainRef.current = plain;
    kick.current();
  }, [plain]);

  useEffect(() => {
    reduceRef.current = reduce === true;
    kick.current();
  }, [reduce]);

  return (
    <figure className={BREAKOUT}>
      <div
        role="img"
        aria-label={`A mock landing page for Orbitkit, its ringed planet drawn as ${plain ? "a smooth gradient" : NAMES[kind]}.`}
        className="@container grid w-full overflow-hidden rounded-lg bg-bg ring-1 ring-stroke sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]"
      >
        <Copy />
        <div
          ref={wrap}
          className="relative aspect-4/3 touch-pan-y sm:aspect-auto sm:h-100"
        >
          <canvas ref={canvas} className="absolute inset-0 size-full" />
        </div>
      </div>
      <figcaption className="flex items-center justify-between gap-3">
        <span className="text-meta text-text-muted">{HINTS[kind]}</span>
        <button
          type="button"
          onClick={() => setPlain((p) => !p)}
          aria-pressed={plain}
          aria-label="Show the plain version"
          className={PILL}
        >
          <span aria-hidden="true">
            <TextMorph duration={MORPH.duration} ease={MORPH.ease}>
              {plain ? "plain" : NAMES[kind]}
            </TextMorph>
          </span>
          <ArrowsLeftRightIcon aria-hidden="true" className="size-3.5" />
        </button>
      </figcaption>
    </figure>
  );
}

export function Dither() {
  return <Figure kind="dither" />;
}

export function Grain() {
  return <Figure kind="grain" />;
}

export function Ascii() {
  return <Figure kind="ascii" />;
}

export function Lines() {
  return <Figure kind="lines" />;
}
