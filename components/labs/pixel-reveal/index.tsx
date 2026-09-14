"use client";

import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { TextMorph } from "torph/react";
import { Pill } from "@/components/lab/controls";
import { cn } from "@/lib/utils";
import { ART, ARTWORK_URI } from "./artwork";
import { DEFAULTS, Panel, type Settings } from "./controls";
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
const BOARD = "[--board:68cqw] sm:[--board:58cqw]";

export default function PixelReveal() {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const art = useRef<HTMLCanvasElement | null>(null);
  const levels = useRef<Pyramid | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const tree = useRef<Tree>(grow(DEFAULTS.depth, DEFAULTS.drift));
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
  /**
   * How far through the run the board is, from 0 to 1.
   *
   * Progress rather than the absolute detail, because a change of depth or
   * drift regrows the tree and moves its span. Holding the absolute number
   * would jump the board somewhere else the moment a slider moved.
   */
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
      shown.current = detail / tree.current.span;
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

  /*
   * A knob regrows the tree and repaints where the board already was, so the
   * reader sees the change on the picture in front of them rather than being
   * sent back to one tile. `run` alone changes nothing that is on screen, so it
   * does not regrow anything.
   */
  useEffect(() => {
    if (!ready || running) return;
    tree.current = grow(settings.depth, settings.drift);
    draw(shown.current * tree.current.span);
  }, [ready, running, settings.depth, settings.drift, draw]);

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
      const progress = Math.min(1, (now - started) / (settings.run * 1000));
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
  }, [draw, ready, reduce, running, settings.run]);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  /* the board is repainted at its new size rather than left stretched */
  useEffect(() => {
    if (running) return;
    const onResize = () => draw(shown.current * tree.current.span);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [running, draw]);

  const label = running ? "generating" : done ? "generate again" : "generate";

  return (
    <div
      className={cn(
        /*
         * Board on one side, controls on the other. The stage is 8:5 on a
         * column, so the width beside a square board was the only part of the
         * frame doing nothing, and three lanes plus a button is exactly what
         * fits in it. Stacked on a phone, where there is no width to spare and
         * the stage goes taller instead.
         */
        "@container relative flex aspect-3/4 w-full select-none flex-col items-center justify-center gap-6 overflow-hidden rounded-lg bg-bg p-8 ring-1 ring-stroke ring-inset sm:aspect-8/5 sm:flex-row sm:p-6",
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
         * The count sits on the thing it describes rather than beside it. In a
         * control row it reserved width whether or not it had anything to say,
         * which pushed the button off the board's own centre line for the whole
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

      <div className="flex w-full flex-col items-start gap-5 sm:w-auto sm:flex-1">
        <Panel
          settings={settings}
          onChange={(key, value) =>
            setSettings((current) => ({ ...current, [key]: value }))
          }
        />

        <Pill
          lead
          disabled={!ready || running}
          label={label}
          onClick={generate}
        >
          {/* `torph` renders its text as aria-hidden character spans, so the
              pill carries the name explicitly. `island-menu` documents it. */}
          <TextMorph duration={200} ease="cubic-bezier(0.32, 0.72, 0, 1)">
            {label}
          </TextMorph>
        </Pill>
      </div>
    </div>
  );
}
