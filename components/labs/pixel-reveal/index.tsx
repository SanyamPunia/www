"use client";

import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { TextMorph } from "torph/react";
import { cn } from "@/lib/utils";
import { ART, ARTWORK_URI } from "./artwork";
import { grow, type Pyramid, paint, pyramid, type Tree } from "./mosaic";

/*
 * A picture resolving out of its own mosaic.
 *
 * The canvas starts empty. Press generate and one flat square appears, splits
 * into four, then sixteen, and keeps halving until the tiles are small enough
 * to stop being tiles, at which point the picture itself arrives over the top.
 *
 * **Nothing fades in, and that is the whole idea.** Every level is a box filter
 * over the one below it, so the picture is complete from the first frame and
 * the filter is what is throwing it away. At one cell it is its own mean
 * colour, at four it has its largest areas, at sixty-four it has its crystals.
 * A reveal built as an opacity ramp over a finished image says nothing about
 * why detail arrives in the order it does. This says it by construction.
 *
 * **Every child travels out of its parent.** Four children sitting on one parent
 * rect, in the parent's colour, is the level before it pixel for pixel. Over the
 * transition each one shrinks to a quarter of that box and slides to its corner,
 * so what the eye follows is a big square becoming four smaller ones rather than
 * a finer grid appearing over the top of a coarser one. Splitting in place was
 * the first build and it reads as a screen being swapped, not as a picture
 * resolving.
 *
 * **Each tile leaves on its own beat**, which is what gives a transition its
 * ragged middle: some cells have already split while their neighbours are still
 * one block, so the tiling is irregular all the way through and only squares up
 * at the end. All of them arrive on time, since the delay is divided back out of
 * the remaining time.
 *
 * **The subject is an agate for a reason that is not decorative.** What survives
 * a box filter is whatever the picture's largest areas are, so a subject built
 * of nested areas at every scale has something to give at every level. A
 * photograph of a face is a grey square until halfway through.
 */

/*
 * The canvas edge, as a share of the stage's own width.
 *
 * Two values, because the stage is 8:5 on a column and square on a phone. At
 * one share the board came to 147px at 390, which is a picture smaller than the
 * button under it. The wide stage has width to spare and the narrow one does
 * not, so the narrow one spends far more of it.
 */
const BOARD = "[--board:78cqw] sm:[--board:47cqw]";

/**
 * How long the whole run takes.
 *
 * Linear in the level rather than in the cell count, since each step doubles
 * the grid: even time per level is even time per doubling, which is what reads
 * as steady. Timed in the resolution rather than in pixels, the first half of
 * the run would be over before anything had happened.
 */
const RUN = 4200;

export default function PixelReveal() {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const art = useRef<HTMLCanvasElement | null>(null);
  const levels = useRef<Pyramid | null>(null);
  const tree = useRef<Tree>(grow());
  const frame = useRef<number | null>(null);

  const [ready, setReady] = useState(false);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  /**
   * How many tiles are on screen.
   *
   * The honest number now that the canvas is a quadtree rather than a grid:
   * there is no single cell count to name, since four or five sizes are on
   * screen at once, and the tile count is the one figure that says how far the
   * picture has got.
   *
   * Written straight to the node rather than held in state, and not morphed.
   * It changes on almost every frame, so state would re-render the component
   * sixty times a second and `torph` would start a new morph before the last
   * had finished, which is a smear. `event-stacking` and the measured demos in
   * `_details-you-can-measure` both make the same call for a per-frame counter.
   */
  const count = useRef<HTMLSpanElement | null>(null);
  /** what was last painted, so a resize repaints the same moment */
  const shown = useRef(0);
  const reduce = useReducedMotion();

  /*
   * The picture is decoded once, into an offscreen canvas at its own size, and
   * the pyramid is built from that. Both outlive every run: a second press
   * re-reads the same arrays rather than decoding an image again.
   */
  useEffect(() => {
    let live = true;
    const image = new Image();
    image.onload = () => {
      if (!live) return;
      const off = document.createElement("canvas");
      off.width = ART;
      off.height = ART;
      const ctx = off.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(image, 0, 0, ART, ART);
      art.current = off;
      levels.current = pyramid(ctx.getImageData(0, 0, ART, ART));
      setReady(true);
    };
    image.src = ARTWORK_URI;
    return () => {
      live = false;
    };
  }, []);

  /** the board is square and sized off the stage, so it needs the live box */
  const measure = useCallback(() => {
    const board = canvas.current;
    if (!board) return null;
    const size = board.clientWidth;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (board.width !== size * dpr) {
      board.width = size * dpr;
      board.height = size * dpr;
    }
    const ctx = board.getContext("2d");
    if (!ctx) return null;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, size };
  }, []);

  const draw = useCallback(
    (detail: number) => {
      const view = measure();
      if (!view || !levels.current || !art.current) return;
      const tiles = paint({
        ctx: view.ctx,
        levels: levels.current,
        tree: tree.current,
        art: art.current,
        detail,
        size: view.size,
      });
      shown.current = detail;
      if (count.current) {
        count.current.textContent = `${tiles.toLocaleString("en")} ${
          tiles === 1 ? "tile" : "tiles"
        }`;
      }
    },
    [measure],
  );

  /*
   * The canvas rests on one flat tile rather than on nothing.
   *
   * An empty white box on a white stage is what a failed image looks like, and
   * it threw away the premise besides: one cell is the picture's own mean
   * colour, so level zero is a real frame of the run and not the absence of
   * one. Pressing generate now splits a pixel rather than filling a hole.
   */
  useEffect(() => {
    if (!ready) return;
    draw(0);
  }, [ready, draw]);

  const generate = useCallback(() => {
    if (!ready || running) return;
    setDone(false);
    setRunning(true);

    /* the setting is about motion nobody asked for, and a press is a request.
       so the run still happens, it simply does not travel. */
    if (reduce) {
      draw(tree.current.span);
      setRunning(false);
      setDone(true);
      return;
    }

    const started = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / RUN);
      draw(progress * tree.current.span);
      if (progress < 1) {
        frame.current = requestAnimationFrame(tick);
        return;
      }
      frame.current = null;
      setRunning(false);
      setDone(true);
    };
    frame.current = requestAnimationFrame(tick);
  }, [draw, ready, reduce, running]);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  /* the board is repainted at its new size rather than left stretched */
  useEffect(() => {
    if (running) return;
    const onResize = () => draw(shown.current);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [running, draw]);

  const label = running ? "generating" : done ? "generate again" : "generate";

  return (
    <div
      className={cn(
        "@container relative flex aspect-square w-full select-none flex-col items-center justify-center gap-4 overflow-hidden rounded-lg bg-bg p-8 ring-1 ring-stroke ring-inset sm:aspect-8/5 sm:gap-4 sm:p-6",
        BOARD,
      )}
    >
      <div
        className="relative shrink-0 overflow-hidden rounded-lg bg-fill ring-1 ring-stroke"
        style={{ width: "var(--board)", height: "var(--board)" }}
      >
        <canvas
          ref={canvas}
          className="size-full"
          role="img"
          aria-label={
            done
              ? "An agate slice, fully resolved"
              : running
                ? "An agate slice resolving out of its mosaic"
                : "One flat tile, the picture at a single pixel"
          }
        />

        {/*
         * The count sits on the thing it describes rather than beside it. In
         * the row it reserved 77px whether or not it had anything to say, which
         * pushed the button 44px off the board's own centre line for the whole
         * of the resting state.
         *
         * Black at alpha rather than a token, since it sits over a picture
         * whose colour runs from near black to white across the run and no
         * surface token survives both ends. That is the scrim exception the
         * shared rules already carry.
         */}
        <span
          ref={count}
          className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-black/40 px-2 py-0.5 text-meta text-white/90 tabular-nums"
        />
      </div>

      <button
        type="button"
        className="flex h-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-text-primary px-5 font-medium text-action text-bg transition-colors duration-150 hover:bg-text-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={generate}
        disabled={!ready || running}
        /* `torph` renders its text as aria-hidden character spans, so a button
           whose only child is one has no accessible name at all. `island-menu`
           documents the same trap. */
        aria-label={label}
      >
        <TextMorph duration={200} ease="cubic-bezier(0.32, 0.72, 0, 1)">
          {label}
        </TextMorph>
      </button>
    </div>
  );
}
