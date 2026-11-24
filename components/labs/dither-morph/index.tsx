"use client";

import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { type Layout, layout, SHAPES, STOPS } from "./shapes";
import {
  aim,
  createSwarm,
  type Pointer,
  paint,
  type Swarm,
  scatter,
  settle,
  step,
} from "./swarm";

/*
 * A fixed set of dithered pixels that rests as a rounded square and becomes
 * any shape picked below it. Every shape is drawn with the same pixels, so a
 * pick only moves them: they leave one after another, stream round, and
 * settle into the new shape's dither. The pointer pushes them aside.
 *
 * `shapes.ts` lights and dithers each shape onto the grid, `swarm.ts` moves
 * the pixels, and this file is the stage, the picker and the frame loop.
 * Nothing renders per frame: the swarm lives in a ref and the loop stops once
 * every pixel is on its cell.
 */

/** a cell's size in css px on a wide stage and a narrow one */
const CELL = 4;
const CELL_NARROW = 3;
/** the shape's box as a share of the stage's width and height */
const BOX_W = 0.5;
const BOX_H = 0.62;
/** the share of an average shape's cells that are inked */
const FILL = 0.8;
/** how many hue bands the ramp is mixed into, left to right */
const BANDS = 8;

const lin = (v: number) =>
  v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
const gam = (v: number) =>
  v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;

function oklab(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = lin(((n >> 16) & 255) / 255);
  const g = lin(((n >> 8) & 255) / 255);
  const b = lin((n & 255) / 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const q = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * q,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * q,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * q,
  ];
}

function css([L, A, B]: number[]): string {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const q = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const c = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * q,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * q,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * q,
  ].map((v) => Math.round(Math.min(1, Math.max(0, gam(v))) * 255));
  return `rgb(${c[0]} ${c[1]} ${c[2]})`;
}

/**
 * Every shape's colours, one block of `BANDS` rows of `STOPS` per shape, each
 * band a step from the ramp's left end to its right, mixed in OKLab. Mixed in
 * sRGB, two pale stops of different hue met in a grey.
 */
const COLOURS = SHAPES.flatMap((shape) =>
  Array.from({ length: BANDS * STOPS }, (_, k) => {
    const t = Math.floor(k / STOPS) / (BANDS - 1);
    const a = oklab(shape.ramp.from[k % STOPS]);
    const b = oklab(shape.ramp.to[k % STOPS]);
    return css(a.map((v, j) => v + (b[j] - v) * t));
  }),
);
/** how long the start times take to run round, in seconds */
const SPREAD = 0.55;
const ENTER_SPREAD = 0.9;
/** the pointer's reach in css px, and how hard it pushes */
const REACH = 44;
const PUSH = 9000;

/** a shape's block in `COLOURS` */
const palette = (slug: string) =>
  Math.max(
    0,
    SHAPES.findIndex((shape) => shape.slug === slug),
  );

export default function DitherMorph() {
  const reduce = useReducedMotion();
  const group = useId();
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [picked, setPicked] = useState(SHAPES[0].slug);

  // everything the loop reads, kept out of React
  const live = useRef({
    ctx: null as CanvasRenderingContext2D | null,
    swarm: null as Swarm | null,
    layouts: new Map<string, Layout>(),
    current: SHAPES[0].slug,
    raf: 0,
    last: 0,
    seen: false,
    entered: false,
    reduce: false,
    w: 0,
    h: 0,
    dpr: 1,
    cell: 4,
    cols: 0,
    // the grid's top left corner on the stage, in device px
    ox: 0,
    oy: 0,
    pointer: null as Pointer | null,
  });

  const draw = useCallback(() => {
    const s = live.current;
    const c = canvas.current;
    if (!s.ctx || !s.swarm || !c) return;
    const span = s.cols * s.cell;
    paint(
      s.ctx,
      s.swarm,
      s.cell,
      c.width,
      c.height,
      COLOURS,
      BANDS,
      s.ox,
      s.oy,
      span,
    );
  }, []);

  /**
   * The first `n` cells of a shape, as device px on the stage. A shape with
   * fewer cells than that stacks the rest on its best cells from the top, so
   * a thin bolt does not set the count for a full square.
   */
  const cells = useCallback((slug: string) => {
    const s = live.current;
    const l = s.layouts.get(slug);
    const n = s.swarm?.n ?? 0;
    const gx = new Float32Array(n);
    const gy = new Float32Array(n);
    const tones = new Uint8Array(n);
    if (!l) return { gx, gy, tones };
    for (let i = 0; i < n; i++) {
      const k = i % l.inside;
      gx[i] = s.ox + l.x[k] * s.cell;
      gy[i] = s.oy + l.y[k] * s.cell;
      tones[i] = l.tone[k];
    }
    return { gx, gy, tones };
  }, []);

  const tick = useCallback(
    (now: number) => {
      const s = live.current;
      if (!s.swarm) return;
      const dt = Math.min(1 / 30, (now - s.last) / 1000);
      s.last = now;
      // two half steps once a frame runs long, so a stiff spring stays stable
      const steps = dt > 1 / 90 ? 2 : 1;
      let moving = false;
      for (let k = 0; k < steps; k++) {
        moving = step(s.swarm, dt / steps, s.pointer) || moving;
      }
      draw();
      s.raf = s.seen && moving ? requestAnimationFrame(tick) : 0;
    },
    [draw],
  );

  const start = useCallback(() => {
    const s = live.current;
    if (s.raf || !s.seen || s.reduce) return;
    s.last = performance.now();
    s.raf = requestAnimationFrame(tick);
  }, [tick]);

  const morph = useCallback(
    (slug: string, spread = SPREAD) => {
      const s = live.current;
      s.current = slug;
      if (!s.swarm) return;
      const { gx, gy, tones } = cells(slug);
      if (s.reduce) {
        s.swarm.tx.set(gx);
        s.swarm.ty.set(gy);
        s.swarm.next.set(tones);
        s.swarm.nextPalette.fill(palette(slug));
        settle(s.swarm);
        draw();
        return;
      }
      aim(s.swarm, gx, gy, tones, palette(slug), spread);
      start();
    },
    [cells, draw, start],
  );

  const pick = (slug: string) => {
    setPicked(slug);
    morph(slug);
  };

  /** the first time the stage is seen, the pixels pour in from all over it */
  const enter = useCallback(() => {
    const s = live.current;
    if (s.entered || !s.swarm || !s.seen) return;
    s.entered = true;
    if (s.reduce) {
      morph(s.current);
      return;
    }
    scatter(s.swarm, s.w * s.dpr, s.h * s.dpr);
    morph(s.current, ENTER_SPREAD);
  }, [morph]);

  useEffect(() => {
    const s = live.current;
    s.reduce = reduce === true;
    if (s.reduce && s.swarm) {
      cancelAnimationFrame(s.raf);
      s.raf = 0;
      s.pointer = null;
      morph(s.current);
    }
  }, [reduce, morph]);

  // the stage's size, the grid, every shape's cells, and whether anyone is looking
  useEffect(() => {
    const node = stage.current;
    const c = canvas.current;
    if (!node || !c) return;
    const s = live.current;
    s.ctx = c.getContext("2d");

    const read = () => {
      const w = node.clientWidth;
      const h = node.clientHeight;
      if (w === 0 || h === 0 || !s.ctx) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      s.w = w;
      s.h = h;
      s.dpr = dpr;
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);

      s.cell = Math.max(1, Math.round((w < 520 ? CELL_NARROW : CELL) * dpr));
      const box = Math.min(w * BOX_W, h * BOX_H) * dpr;
      s.cols = Math.max(16, Math.floor(box / s.cell));
      // centred a little above the middle, clear of the picker, on whole cells
      const gridW = s.cols * s.cell;
      const cx = Math.round((c.width - gridW) / 2 / s.cell);
      const cy = Math.round((c.height * 0.44 - gridW / 2) / s.cell);
      s.ox = cx * s.cell;
      s.oy = cy * s.cell;

      s.layouts.clear();
      let total = 0;
      for (const shape of SHAPES) {
        const l = layout(shape, s.cols, cx, cy);
        s.layouts.set(shape.slug, l);
        total += l.inside;
      }
      const n = Math.floor((total / SHAPES.length) * FILL);

      // a resize puts the pixels straight onto the new grid
      s.swarm = createSwarm(n);
      const { gx, gy, tones } = cells(s.current);
      s.swarm.tx.set(gx);
      s.swarm.ty.set(gy);
      s.swarm.next.set(tones);
      s.swarm.nextPalette.fill(palette(s.current));
      settle(s.swarm);
      if (s.entered) draw();
      else enter();
    };
    read();
    const resize = new ResizeObserver(read);
    resize.observe(node);

    // no frames for a stage nobody is looking at
    const seen = new IntersectionObserver(([entry]) => {
      s.seen = entry?.isIntersecting ?? false;
      if (!s.seen) return;
      enter();
      start();
    });
    seen.observe(node);

    return () => {
      resize.disconnect();
      seen.disconnect();
      cancelAnimationFrame(s.raf);
      s.raf = 0;
    };
  }, [cells, draw, enter, start]);

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = live.current;
    if (s.reduce || !stage.current) return;
    const box = stage.current.getBoundingClientRect();
    s.pointer = {
      x: (e.clientX - box.left) * s.dpr,
      y: (e.clientY - box.top) * s.dpr,
      radius: REACH * s.dpr,
      push: PUSH * s.dpr,
    };
    start();
  };

  const onPointerLeave = () => {
    live.current.pointer = null;
    start();
  };

  // a press on the stage itself moves on to the next shape
  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("fieldset")) return;
    const i = SHAPES.findIndex((shape) => shape.slug === picked);
    pick(SHAPES[(i + 1) % SHAPES.length].slug);
  };

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: a shortcut for the radios below, which carry the keyboard
    // biome-ignore lint/a11y/noStaticElementInteractions: same, the stage only repeats what the picker does
    <div
      ref={stage}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onClick={onClick}
      className="relative isolate aspect-8/5 min-h-78 w-full cursor-pointer overflow-hidden rounded-lg bg-fill ring-1 ring-stroke ring-inset"
    >
      <canvas
        ref={canvas}
        className="pointer-events-none absolute inset-0 block size-full [image-rendering:pixelated]"
      />
      <fieldset className="absolute inset-x-0 bottom-4 mx-auto flex w-fit cursor-default gap-0.5 rounded-full bg-bg p-1 ring-1 ring-stroke">
        <legend className="sr-only">Shape</legend>
        {SHAPES.map((shape) => (
          <label
            key={shape.slug}
            className={cn(
              "flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-action text-text-secondary transition-all duration-200 sm:px-3",
              "hover:bg-fill hover:text-text-primary active:bg-fill-hover",
              "has-[:checked]:bg-fill-active has-[:checked]:text-text-primary",
              "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-text-primary/15",
            )}
          >
            <input
              type="radio"
              name={group}
              value={shape.slug}
              checked={picked === shape.slug}
              onChange={() => pick(shape.slug)}
              className="sr-only"
            />
            <svg
              viewBox="0 0 100 100"
              aria-hidden="true"
              className="size-3.5 shrink-0"
            >
              <path
                d={shape.path}
                fill="currentColor"
                fillRule={shape.rule ?? "nonzero"}
              />
            </svg>
            <span className="max-sm:sr-only">{shape.name}</span>
          </label>
        ))}
      </fieldset>
    </div>
  );
}
