"use client";

import {
  ArrowCounterClockwiseIcon,
  EraserIcon,
  PauseIcon,
  PlayIcon,
  SlidersHorizontalIcon,
} from "@phosphor-icons/react";
import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { TextMorph } from "torph/react";
import { cn } from "@/lib/utils";
import { Panel, Pill } from "./controls";
import {
  clearWorld,
  createWorld,
  DEFAULTS,
  dropAt,
  hideAim,
  nudgeAim,
  population,
  resizeWorld,
  type Settings,
  STAGE_ASPECT,
  seed,
  setAim,
  step,
} from "./rain";

/**
 * How far an arrow key moves the reticle, in stage pixels, and the fine step
 * under Shift.
 *
 * 16px crosses a 540px stage in 34 presses, which is coarse enough to get
 * anywhere and too coarse to place a splash between two others. Shift is what
 * makes it a real aim rather than a grid.
 */
const AIM_STEP = 16;
const AIM_FINE = 4;

const AIM_KEYS: Record<string, [number, number] | undefined> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/**
 * Coloured rain, falling on a floor in perspective and staying where it lands.
 *
 * The simulation is `rain.ts`, the panel is `controls.tsx`, and this file is
 * the three things neither of them can own: the two canvases and their sizes,
 * the frame loop, and the pointer.
 *
 * ── what the loop does and does not do ───────────────────────────────────────
 *
 * **Nothing here re-renders on a frame.** The settings live in state, because
 * the sliders read them, and the loop reads a ref mirroring that state. The
 * counts under the panel are written straight to their nodes. So a stage
 * carrying a few hundred moving specks does it without React knowing there is a
 * frame at all, and a drag on a slider changes the physics from the next frame
 * on rather than after a respawn.
 *
 * **The loop is not running most of the time.** It stops when the demo is
 * paused, and it stops when the stage is off screen, which is the case that
 * matters: this is one block inside a page a reader scrolls past, and rain
 * falling into a canvas nobody is looking at is a fan spinning for nothing.
 * `requestAnimationFrame` already stops for a hidden tab, so that case is
 * covered without asking.
 *
 * **`dt` is clamped.** A tab that comes back from a long stall hands the first
 * frame a gap of seconds, which at these accelerations puts every drop through
 * the floor and every speck off the stage in one step. A 50ms ceiling turns
 * that into one slow frame.
 */
export default function RainSplatter() {
  const reduce = useReducedMotion();

  const stage = useRef<HTMLButtonElement>(null);
  const liveCanvas = useRef<HTMLCanvasElement>(null);
  const paintCanvas = useRef<HTMLCanvasElement>(null);
  const live = useRef<CanvasRenderingContext2D | null>(null);
  const paint = useRef<CanvasRenderingContext2D | null>(null);

  const world = useRef(createWorld());
  const dropCount = useRef<HTMLSpanElement>(null);
  const fleckCount = useRef<HTMLSpanElement>(null);
  const painted = useRef(0);
  const reduced = useRef(false);
  const seeded = useRef(false);

  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const config = useRef<Settings>(DEFAULTS);
  const [running, setRunning] = useState(true);
  const [onScreen, setOnScreen] = useState(true);

  /*
   * Closed. The piece is the stage, and six lanes under it were a form with a
   * painting on top rather than a painting with a panel under it.
   */
  const [open, setOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    config.current = settings;
  }, [settings]);

  /**
   * The still frame, for a reader who has asked for less motion.
   *
   * **The stage otherwise starts on clean paper.** The piece is the filling, so
   * a canvas that arrives already half painted gives away the one thing anyone
   * came to watch, and it fills on its own inside a second. Under the setting
   * nothing is going to fall at all, so the still is the only version of the
   * experiment there is.
   *
   * Two callers, because two things have to be true and either can be last: the
   * preference has to have resolved and the stage has to have a size. Whichever
   * arrives second does the work, and the ref is what stops both doing it.
   */
  const still = useCallback(() => {
    const ctx = paint.current;
    if (seeded.current || !reduced.current || !ctx) return;
    if (world.current.h <= 0) return;
    seeded.current = true;
    seed(world.current, config.current, ctx, 18);
  }, []);

  /*
   * The play control still works under the setting, and that is deliberate. The
   * preference is about what starts on its own.
   */
  useEffect(() => {
    reduced.current = reduce === true;
    if (!reduce) return;
    setRunning(false);
    still();
  }, [reduce, still]);

  /* size the two canvases to the stage */
  useEffect(() => {
    const el = stage.current;
    const liveEl = liveCanvas.current;
    const paintEl = paintCanvas.current;
    if (!el || !liveEl || !paintEl) return;

    const liveCtx = liveEl.getContext("2d");
    const paintCtx = paintEl.getContext("2d");
    if (!liveCtx || !paintCtx) return;
    live.current = liveCtx;
    paint.current = paintCtx;

    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (!box || box.width < 1) return;

      /*
       * Capped at 2. A third device pixel per side is four times the fill for a
       * difference nobody can see on a stage made of soft-edged blobs, and this
       * one repaints a few hundred of them a second.
       */
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      fit(liveEl, box.width, box.height, dpr, false);
      fit(paintEl, box.width, box.height, dpr, true);
      resizeWorld(world.current, box.width, box.height);

      still();
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [still]);

  /* a stage below the fold is not worth a frame */
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => setOnScreen(entries[0]?.isIntersecting ?? true),
      { rootMargin: "160px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!running || !onScreen) return;
    const liveCtx = live.current;
    const paintCtx = paint.current;
    if (!liveCtx || !paintCtx) return;

    let frame = 0;
    let ticks = 0;
    let last = performance.now();

    const run = (now: number) => {
      frame = requestAnimationFrame(run);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      step(world.current, dt, config.current, liveCtx, paintCtx);

      /* the readout is a readout, not a gauge. Ten a second is plenty */
      if (ticks++ % 6 === 0) {
        const count = population(world.current);
        if (dropCount.current) {
          dropCount.current.textContent = String(count.drops);
        }
        if (fleckCount.current) {
          fleckCount.current.textContent = String(count.flecks);
        }
      }
    };

    frame = requestAnimationFrame(run);
    return () => cancelAnimationFrame(frame);
  }, [running, onScreen]);

  /*
   * A pointer aims a drop at the floor, at the point it is over.
   *
   * The point is where the drop lands rather than where it starts, so pressing
   * near the horizon gets a small far splash and pressing at the foot of the
   * stage gets a fat near one, and either way the drop still falls the whole
   * height of the stage to get there. Aiming is the only thing the pointer
   * does. There is no brush here.
   *
   * `point` moves the reticle and `drop` fires one, which are two calls rather
   * than one because a mouse moving over the stage does the first without the
   * second, and that hover is the whole affordance.
   */
  const local = useCallback((x: number, y: number) => {
    const box = stage.current?.getBoundingClientRect();
    return box ? { x: x - box.left, y: y - box.top } : null;
  }, []);

  const point = useCallback(
    (x: number, y: number) => {
      const at = local(x, y);
      if (at) setAim(world.current, at.x, at.y);
    },
    [local],
  );

  const drop = useCallback(
    (x: number, y: number) => {
      const at = local(x, y);
      if (at) dropAt(world.current, config.current, at.x, at.y);
    },
    [local],
  );

  const clear = useCallback(() => {
    const ctx = paint.current;
    clearWorld(world.current);
    if (ctx) ctx.clearRect(0, 0, world.current.w, world.current.h);
    live.current?.clearRect(0, 0, world.current.w, world.current.h);
  }, []);

  return (
    <div className="@container relative w-full select-none overflow-hidden rounded-lg">
      {/*
       * Two canvases, one box. `paint` is under and holds everything that has
       * landed, `live` is over it and holds everything still moving. See
       * `rain.ts` for why that split is the whole design.
       *
       * `bg-fill` is the paper. It is the site's own resting grey rather than a
       * value picked to match the reference, and it lands within a percent of
       * it anyway: ink on this page wants the one ground the page already has.
       *
       * ── how it says it can be pressed ────────────────────────────────────
       *
       * **A cursor was the whole affordance and it was not enough.** It says
       * the surface answers a pointer, it says nothing about what the answer
       * is, and a touch reader never sees it at all. The reticle in `rain.ts`
       * replaces it: a ring the size of the splash that press would make, at
       * the depth it would land. Moving up the stage shrinks and flattens it,
       * which is the piece explaining its own perspective before you commit.
       *
       * **The stage is a real button, so the aim is not a pointer-only
       * gesture.** Six sliders and three buttons were reachable and the best
       * interaction in the piece was not. The arrows move the reticle and
       * Enter or Space drops on it.
       *
       * **A `<button>` rather than a div carrying `tabIndex` and
       * `role="application"`.** That pairing is what a first build reaches for
       * and it hands you three problems: it is not in the tab order for free,
       * it needs its own focus styling, and Space has to be intercepted, which
       * is how an embedded demo ends up eating the page's scroll key. A button
       * is focusable, focus-visible and activated by both keys natively, and it
       * swallows Space because it is a button rather than because this file
       * asked it to. Keyboard activation arrives as a click with `detail` 0,
       * which is what separates it from the pointer path that has already
       * handled its own press.
       *
       * `block` is load-bearing: a button is inline-block, and an inline-block
       * sits on the text baseline, which would leave a descender's worth of
       * `bg-fill` between the stage and the hairline under it.
       *
       * The crosshair and the reticle are both gated on the rain running, since
       * a press does nothing to a stopped stage and an affordance that promises
       * otherwise is worse than none.
       */}
      <button
        ref={stage}
        type="button"
        aria-label="Rain stage. Arrow keys aim, enter drops one."
        onPointerDown={(event) => {
          if (!running) return;
          if (event.pointerType !== "touch")
            point(event.clientX, event.clientY);
          drop(event.clientX, event.clientY);
        }}
        onPointerMove={(event) => {
          /*
           * A held mouse keeps dropping, a finger does not. A phone has one
           * gesture for both dragging and scrolling, and taking it here would
           * trap the page's scroll inside a demo that is most of a screen tall.
           * A tap still drops.
           */
          if (!running || event.pointerType === "touch") return;
          point(event.clientX, event.clientY);
          if (event.buttons === 0) return;
          if (event.timeStamp - painted.current < 55) return;
          painted.current = event.timeStamp;
          drop(event.clientX, event.clientY);
        }}
        onPointerLeave={() => hideAim(world.current)}
        onFocus={() => {
          if (running) nudgeAim(world.current, 0, 0);
        }}
        onBlur={() => hideAim(world.current)}
        onKeyDown={(event) => {
          /*
           * Arrows only. Enter and Space are the button's own, and they arrive
           * at `onClick` below rather than here, which is what keeps this from
           * being a second implementation of what a button already does.
           *
           * Shift is the fine step. Without it the aim is a 16px grid, and two
           * splashes cannot be put close enough together to overlap.
           */
          const nudge = AIM_KEYS[event.key];
          if (!running || !nudge) return;
          event.preventDefault();
          const step = event.shiftKey ? AIM_FINE : AIM_STEP;
          nudgeAim(world.current, nudge[0] * step, nudge[1] * step);
        }}
        onClick={(event) => {
          /*
           * `detail` is 0 for a keyboard press and for a screen reader
           * activating the control, and non-zero for a real click, which
           * `onPointerDown` has already served. So this is the keyboard path
           * alone: drop on the reticle, or place the reticle if the first press
           * arrived before any arrow key did.
           */
          if (!running || event.detail !== 0) return;
          const { x, y, live: aiming } = world.current.aim;
          if (aiming) dropAt(world.current, config.current, x, y);
          else nudgeAim(world.current, 0, 0);
        }}
        style={{ aspectRatio: STAGE_ASPECT }}
        className={cn(
          "relative block w-full overflow-hidden bg-fill",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/20 focus-visible:ring-inset",
          running ? "cursor-crosshair" : "cursor-default",
        )}
      >
        <canvas ref={paintCanvas} className="absolute inset-0 size-full" />
        <canvas ref={liveCanvas} className="absolute inset-0 size-full" />
      </button>

      {/*
       * The bar sits on the frame's own white, under a hairline, with the
       * stage's inset rather than a tighter one of its own.
       *
       * **The bar is above the lanes and not below them**, which is the whole
       * reason a disclosure works here. The pill you press does not move when
       * the panel it opens arrives, and the stage above it does not move
       * either: the component grows downward, from the edge nobody is looking
       * at.
       */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-stroke border-t px-6 py-5">
        {/* what the piece is doing, written straight to the nodes */}
        <p className="flex items-center gap-4 font-mono text-meta text-text-muted tabular-nums">
          <span className="flex items-center gap-1">
            <span>drops</span>
            <span ref={dropCount}>0</span>
          </span>
          <span className="flex items-center gap-1">
            <span>specks</span>
            <span ref={fleckCount}>0</span>
          </span>
        </p>

        <div className="flex items-center gap-2">
          <Pill
            label={
              running
                ? "Rain running, press to pause"
                : "Rain paused, press to run"
            }
            lead
            onClick={() => setRunning((on) => !on)}
          >
            {/*
             * `fill` rather than the `regular` default, and `size-3.5` rather
             * than `size-3`. These are transport symbols rather than UI icons:
             * an outlined pause at 9.6px is two hairlines beside 12px type and
             * reads as a smudge. The signature player's transport takes the
             * same exception for the same reason, and it is the only place
             * this project passes an icon weight.
             */}
            {running ? (
              <PauseIcon
                aria-hidden="true"
                weight="fill"
                className="size-3.5 shrink-0"
              />
            ) : (
              <PlayIcon
                aria-hidden="true"
                weight="fill"
                className="size-3.5 shrink-0"
              />
            )}
            {/* mono, because the label is the state rather than a verb */}
            <TextMorph
              className="font-mono"
              duration={200}
              ease="cubic-bezier(0.32, 0.72, 0, 1)"
            >
              {running ? "running" : "paused"}
            </TextMorph>
          </Pill>

          {/*
           * `tune` is the way into the other six controls and it is still a
           * quiet pill. Two filled pills in one bar is two answers to which
           * control is the primary one, and the transport is the one that runs
           * the piece.
           */}
          <Pill
            expanded={open}
            controls={panelId}
            onClick={() => setOpen((on) => !on)}
          >
            <SlidersHorizontalIcon
              aria-hidden="true"
              className="size-3 shrink-0"
            />
            tune
          </Pill>

          {/* the icons inherit the pill's tone, so they step with it on hover
              rather than staying muted while the word lights up */}
          <Pill onClick={clear}>
            <EraserIcon aria-hidden="true" className="size-3 shrink-0" />
            clear
          </Pill>

          <Pill onClick={() => setSettings(DEFAULTS)}>
            <ArrowCounterClockwiseIcon
              aria-hidden="true"
              className="size-3 shrink-0"
            />
            reset
          </Pill>
        </div>
      </div>

      {/*
       * The six lanes, closed.
       *
       * **A grid whose single row goes from `0fr` to `1fr`**, with the panel
       * inside an `overflow-hidden` child. It is the one way to animate to a
       * height the browser works out for itself, and it costs no measuring, no
       * ref and no resize handling: `max-height` needs a number nobody can
       * write correctly at three column counts, and a height in JS is a
       * measurement that goes stale on every reflow.
       *
       * **The padding lives inside the collapsing box**, so a closed panel is
       * genuinely zero pixels tall rather than zero pixels plus a gap. The
       * bar's own bottom padding is what separates the two when it is open.
       *
       * **`inert` while closed, and this is not optional.** A `0fr` row is
       * invisible and its six range inputs are still in the tab order, so
       * without it the first Tab past `reset` puts focus on a slider nobody can
       * see. `inert` takes the whole subtree out of the tab order and out of
       * the accessibility tree at once, which `aria-hidden` alone would not do.
       */}
      <div
        id={panelId}
        inert={!open}
        className={cn(
          /*
           * `motion-safe:`, so under the setting the panel arrives rather than
           * unrolls. Same call `window-shade` makes on its own raw CSS.
           */
          "grid motion-safe:transition-all motion-safe:duration-200",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          {/* the bar's own bottom padding is most of the gap. `pt-2` is the rest
              of it, so the first row of labels is not sitting on the pills */}
          <div className="px-6 pt-2 pb-5">
            <Panel
              settings={settings}
              onChange={(key, value) =>
                setSettings((current) => ({ ...current, [key]: value }))
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Match a canvas's backing store to its box, at the device's pixel ratio.
 *
 * Writing either dimension wipes the bitmap and resets the context, which is
 * exactly what the live layer wants and exactly what the paint layer cannot
 * have: a window drag would throw away everything that has landed. So the paint
 * layer is copied out to a scratch canvas, resized, and drawn back at the new
 * size, which stretches the accumulation with the stage instead of losing it.
 *
 * The transform goes on last, after the resize has cleared it, so everything in
 * `rain.ts` can work in CSS pixels and never see the ratio.
 */
function fit(
  canvas: HTMLCanvasElement,
  w: number,
  h: number,
  dpr: number,
  keep: boolean,
): void {
  const bw = Math.max(1, Math.round(w * dpr));
  const bh = Math.max(1, Math.round(h * dpr));
  if (canvas.width === bw && canvas.height === bh) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  if (keep && canvas.width > 0 && canvas.height > 0) {
    const held = document.createElement("canvas");
    held.width = canvas.width;
    held.height = canvas.height;
    held.getContext("2d")?.drawImage(canvas, 0, 0);
    canvas.width = bw;
    canvas.height = bh;
    ctx.drawImage(held, 0, 0, bw, bh);
  } else {
    canvas.width = bw;
    canvas.height = bh;
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
