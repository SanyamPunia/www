"use client";

import { HeartIcon } from "@phosphor-icons/react";
import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { TextMorph } from "torph/react";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { paint, type Ripple } from "./ripple";

/**
 * A pill toggle with a count. Pressing it sends a ripple of dots out across
 * the button from under the pointer, on a fixed grid, so the wave is a
 * halftone screen being run rather than a glow spreading.
 *
 * The ripple is a canvas under the label, clipped by the pill. Nothing in it
 * renders: a press pushes one record into a list and a frame loop paints the
 * list until it is empty, then stops asking for frames.
 */

/**
 * The ink of a ripple that turned the button on.
 *
 * The hue is the state and not a decoration: a press that turns the button
 * off sends the same ripple in `text-muted`, so what colour the dots are says
 * which way the press went, and the heart takes the same hue while it is on.
 * A hot pink rather than a muted crimson, since the ripple is the whole show
 * and a quiet ink made it read as a stain. 3.79:1 on the `fill` pill and 3.16
 * on `fill-active`, so the icon still clears a graphic's floor on every ground
 * the button paints. Scoped to this experiment, not a token, and nothing else
 * may reach for it.
 */
export const INK = "#f01d5d";

/** the count before anyone has pressed */
const BASE = 127;

/**
 * How the count changes, through `torph`. `book-opening`'s numbers: 200ms on
 * the same ease as the pill's colour step, so the digit and the ground under it
 * settle together. What a press does to a count is correct it, and morphing the
 * digit that changed is what that looks like.
 */
const MORPH = {
  duration: 200,
  ease: "cubic-bezier(0.32, 0.72, 0, 1)",
} as const;

export default function HalftoneRipple() {
  const [on, setOn] = useState(false);
  const reduce = useReducedMotion();

  const button = useRef<HTMLButtonElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const heart = useRef<HTMLSpanElement>(null);

  const ctx = useRef<CanvasRenderingContext2D | null>(null);
  const size = useRef({ w: 0, h: 0 });
  const ripples = useRef<Ripple[]>([]);
  const frame = useRef(0);
  const still = useRef(false);
  /** the off ripple's ink, read off the `text-muted` token once */
  const muted = useRef("");

  useEffect(() => {
    still.current = reduce ?? false;
  }, [reduce]);

  /* size the canvas to the button, one device pixel per device pixel */
  useEffect(() => {
    const el = button.current;
    const c = canvas.current;
    if (!el || !c) return;
    const context = c.getContext("2d");
    if (!context) return;
    ctx.current = context;

    muted.current = getComputedStyle(document.documentElement)
      .getPropertyValue("--color-text-muted")
      .trim();

    const observer = new ResizeObserver(() => {
      /*
       * The button's own rect rather than the entry's `contentRect`, which is
       * the content box and leaves the padding out. The canvas covers the whole
       * pill, and the pill has no border, so its box is the padding box.
       */
      const { width, height } = el.getBoundingClientRect();
      if (width < 1 || height < 1) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = Math.round(width * dpr);
      c.height = Math.round(height * dpr);
      /* setting the size resets the transform, so it goes back on after */
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      size.current = { w: width, h: height };
    });
    observer.observe(el);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, []);

  /*
   * Add a ripple and make sure the loop is running. The loop cancels itself
   * the frame after the last ripple dies, having cleared the canvas, so at rest
   * the button asks for nothing.
   */
  const emit = useCallback((x: number, y: number, ink: string) => {
    ripples.current.push({ x, y, born: performance.now(), ink });
    if (frame.current) return;

    const run = (now: number) => {
      const context = ctx.current;
      if (!context) {
        frame.current = 0;
        return;
      }
      const { w, h } = size.current;
      const alive = paint(context, w, h, ripples.current, now, still.current);
      frame.current = alive ? requestAnimationFrame(run) : 0;
    };
    frame.current = requestAnimationFrame(run);
  }, []);

  const press = (event: React.MouseEvent<HTMLButtonElement>) => {
    const el = button.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();

    let x: number;
    let y: number;
    if (event.detail === 0) {
      /*
       * A keyboard activation has no point to start from, so the ripple leaves
       * the heart, which is where the press is about.
       */
      const box = heart.current?.getBoundingClientRect();
      x = box ? box.left + box.width / 2 - rect.left : rect.width / 2;
      y = box ? box.top + box.height / 2 - rect.top : rect.height / 2;
    } else {
      x = event.clientX - rect.left;
      y = event.clientY - rect.top;
    }

    const next = !on;
    setOn(next);
    emit(x, y, next ? INK : muted.current);
  };

  return (
    <div className="flex min-h-64 w-full items-center justify-center">
      <TooltipProvider delayDuration={200}>
        {/* the label is the value, not the action, so the tooltip names what a
            press will do. Radix closes it on click, so the changed copy is seen
            on the next hover, which `heading-anchor` documents. */}
        <Tooltip label={on ? "Remove like" : "Like this"}>
          <button
            type="button"
            ref={button}
            aria-pressed={on}
            onClick={press}
            className={cn(
              /*
               * The site's own pill, the shape `InlineLink` and `tether-button`
               * use. `overflow-hidden` is what clips the dot grid to it, and
               * `isolate` keeps the canvas's stacking inside the button.
               */
              "group relative isolate flex h-14 cursor-pointer select-none items-center gap-3 overflow-hidden rounded-full px-8",
              /*
               * Rest, hover and press are the codebase's three fill steps, and
               * nothing scales. The step in is instant and only the step back
               * is timed, `tether-button`'s call: at 200ms both ways a quick
               * click never reaches its own colour.
               */
              "bg-fill hover:bg-fill-hover active:bg-fill-active",
              "transition-colors duration-200 active:duration-0",
              /*
               * `bg-fill` to `bg-fill-hover` is 1.04:1, a step that exists in
               * the token table more than on the screen, so the hover also
               * lifts the label a tone, `rain-splatter`'s call for its quiet
               * pills. On, the label holds the primary tone whatever the
               * pointer does.
               */
              "text-body font-medium text-text-secondary hover:text-text-primary aria-pressed:text-text-primary",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2",
            )}
          >
            {/* under the label, so the dots pass beneath the digits the way a
                print sits under type. Both are positioned, so tree order is
                what stacks them. */}
            <canvas
              ref={canvas}
              className="pointer-events-none absolute inset-0 size-full"
            />

            {/* The heart fills while the button is on. Two glyphs rather than a
                weight swap, so the fill fades in over the outline on the same
                200ms as the hue, and the outline stays under it as the edge.
                This is the second place the codebase passes an icon weight,
                after the signature player's transport. */}
            <span
              ref={heart}
              className="relative flex transition-colors duration-200"
              style={on ? { color: INK } : undefined}
            >
              <HeartIcon aria-hidden="true" className="size-5 shrink-0" />
              <HeartIcon
                aria-hidden="true"
                weight="fill"
                className={cn(
                  "absolute inset-0 size-5 transition-opacity duration-200",
                  on ? "opacity-100" : "opacity-0",
                )}
              />
            </span>

            <span className="relative tabular-nums">
              <TextMorph duration={MORPH.duration} ease={MORPH.ease}>
                {String(BASE + (on ? 1 : 0))}
              </TextMorph>
            </span>
            <span className="sr-only">likes</span>
          </button>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
