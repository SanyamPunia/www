"use client";

import {
  DownloadSimpleIcon,
  SlidersHorizontalIcon,
} from "@phosphor-icons/react";
import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { TextMorph } from "torph/react";
import { Pill } from "@/components/lab/controls";
import { cn } from "@/lib/utils";
import { ART, PATTERNS } from "./artwork";
import { DEFAULTS, Panel, PatternStrip, type Settings } from "./controls";
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
 * The canvas edge: most of a narrow stage's content width, capped.
 *
 * A narrow stage has no width to spare and a wide one has plenty, so the board
 * spends 68% of the first and stops growing on the second. At one flat share it
 * came to 147px at 390, a picture smaller than the button under it.
 *
 * **One expression rather than a share per breakpoint.** Two shares meant the
 * board stepped 331 to 258 across `sm` for no reason a reader could see, since
 * the layout either side of it is the same centred column. The cap binds at a
 * 456px stage, which is a 494px window, and everything above that is one size.
 *
 * The `cqw` resolves against the stage rather than the stage's own container,
 * because a custom property is not resolved until it is used and every use is a
 * child. That is the trap `document-pocket` documents, taken the right way
 * round.
 */
const BOARD = "[--board:min(68cqw,16rem)]";

/** a decoded picture and the pyramid built from it */
interface Decoded {
  art: HTMLCanvasElement;
  levels: Pyramid;
}

export default function PixelReveal() {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  /*
   * Decoded once each and kept.
   *
   * A pyramid is one pass over 262,144 pixels and a picture is one SVG
   * rasterised at 512, so going back to a pattern a reader has already seen
   * costs nothing, and the five are only paid for if the five are asked for.
   */
  const decoded = useRef(new Map<string, Decoded>());
  const picture = useRef<Decoded | null>(null);
  const [pattern, setPattern] = useState(PATTERNS[0].slug);
  /**
   * Which pattern the board is actually painting, which is not the same
   * question as which one is selected.
   *
   * It is the slug rather than a flag, so it is what the repaint waits on: a
   * picture that has not decoded yet has not landed, and a switch back to one
   * already decoded lands in the same tick. Null until the first one is in,
   * which is also what says the demo cannot be run yet.
   */
  const [landed, setLanded] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const tree = useRef<Tree>(grow(DEFAULTS.depth, DEFAULTS.drift));
  const frame = useRef<number | null>(null);

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
   * The chosen picture is decoded into an offscreen canvas at its own size and
   * the pyramid is built from that, both kept for the rest of the session.
   *
   * Switching pattern never disables the button or blanks the board for the
   * frame or two a decode takes. The board keeps painting whatever it last
   * had, which is the picture the reader has just looked away from, and
   * `landed` is what tells the repaint the new one is in.
   */
  useEffect(() => {
    const hit = decoded.current.get(pattern);
    if (hit) {
      picture.current = hit;
      setLanded(pattern);
      return;
    }

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
      const entry = {
        art: off,
        levels: pyramid(ctx.getImageData(0, 0, ART, ART)),
      };
      decoded.current.set(pattern, entry);
      picture.current = entry;
      setLanded(pattern);
    };
    image.src = PATTERNS.find((entry) => entry.slug === pattern)?.uri ?? "";
    return () => {
      live = false;
    };
  }, [pattern]);

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
      const shot = picture.current;
      if (!view || !shot) return;
      paint({
        ctx: view.ctx,
        levels: shot.levels,
        tree: tree.current,
        art: shot.art,
        detail,
        size: view.size,
      });
      shown.current = detail / tree.current.span;
    },
    [measure],
  );

  /*
   * A knob regrows the tree and a pattern brings its own picture, and either
   * repaints where the board already was, so the reader sees the change on the
   * picture in front of them rather than being sent back to one tile. `run`
   * alone changes nothing that is on screen, so it does not regrow anything.
   *
   * At rest that is one flat tile, which is where the board starts.
   *
   * An empty white box on a white stage is what a failed image looks like, and
   * it threw away the premise besides: one cell is the picture's own mean
   * colour, so level zero is a real frame of the run and not the absence of
   * one. Pressing generate splits a pixel rather than filling a hole, and
   * picking a pattern at rest changes which colour that pixel is, since no two
   * of the five average to the same thing.
   */
  useEffect(() => {
    if (!landed || running) return;
    tree.current = grow(settings.depth, settings.drift);
    draw(shown.current * tree.current.span);
  }, [landed, running, settings.depth, settings.drift, draw]);

  const generate = useCallback(() => {
    if (!landed || running) return;
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
  }, [draw, landed, reduce, running, settings.run]);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  /*
   * Save the picture, which is what the board is painting by the time this can
   * be pressed.
   *
   * **The source rather than the board, so the file is the same on every
   * screen.** The board is sized in `cqw` and backed at the device's pixel
   * ratio, so saving it hands a 512px file to one reader and a 256px file to
   * another for the same press. The picture is 512 wherever it is opened, and
   * the two agree pixel for pixel at the one moment this is live: a finished
   * run composites the sharp image over the mosaic, whatever the depth was.
   *
   * `toBlob` rather than `toDataURL`, which builds a base64 string of the whole
   * image to throw away, and the object URL is revoked on the same tick since
   * the click has already taken it.
   */
  const save = useCallback(() => {
    const shot = picture.current;
    if (!shot) return;
    shot.art.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `pixel-reveal-${pattern}.png`;
      link.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }, [pattern]);

  /* the board is repainted at its new size rather than left stretched */
  useEffect(() => {
    if (running) return;
    const onResize = () => draw(shown.current * tree.current.span);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [running, draw]);

  const label = running ? "generating" : done ? "generate again" : "generate";
  const subject =
    PATTERNS.find((entry) => entry.slug === pattern)?.name ?? "The picture";

  return (
    <div
      className={cn(
        /*
         * One centred column: the picture, the five it could be, and the press
         * that resolves it. The run's own numbers are behind `tune`.
         *
         * **The stage has no ratio at any width, and the disclosure is why.**
         * A panel that unrolls changes the demo's height by definition, so
         * there is no ratio to hold, and a content-driven height is also what
         * keeps the board still while the panel arrives: with nothing to
         * centre against, the column starts at the top padding and everything
         * new appears below it. The board and the strip do not move when the
         * panel opens.
         */
        "@container relative flex w-full select-none flex-col items-center overflow-hidden rounded-lg bg-bg px-8 py-12 ring-1 ring-stroke ring-inset sm:p-12",
        BOARD,
      )}
    >
      <div className="flex flex-col items-center gap-8">
        {/*
         * The strip belongs to the board rather than to the knobs, because what
         * it changes is the picture and not the run. It takes the board's own
         * width, so the swatch size is derived like everything else here and
         * the two read as one object: a picture and the five it could be.
         */}
        <div className="flex flex-col gap-4" style={{ width: "var(--board)" }}>
          <div
            className="overflow-hidden rounded-lg bg-fill ring-1 ring-stroke"
            style={{ height: "var(--board)" }}
          >
            <canvas
              ref={canvas}
              className="size-full"
              role="img"
              aria-label={
                done
                  ? `${subject}, fully resolved`
                  : running
                    ? `${subject}, resolving out of its mosaic`
                    : `${subject}, at one flat tile`
              }
            />
          </div>

          <PatternStrip
            value={pattern}
            onChange={setPattern}
            disabled={running}
          />
        </div>

        <div className="flex items-center gap-2">
          <Pill
            lead
            disabled={!landed || running}
            label={label}
            onClick={generate}
          >
            {/* `torph` renders its text as aria-hidden character spans, so the
                pill carries the name explicitly. `island-menu` documents it. */}
            <TextMorph duration={200} ease="cubic-bezier(0.32, 0.72, 0, 1)">
              {label}
            </TextMorph>
          </Pill>

          {/*
           * **`save` is present from the first paint and disabled until there
           * is something to save**, rather than arriving when a run ends. The
           * row is centred, so a pill that turns up mid-demo slides the two
           * beside it, and a control that says what the demo can do before it
           * can do it is the shared rule about keeping an action disabled
           * until it is actionable.
           *
           * No tooltip, since the label is a word rather than a glyph.
           */}
          <Pill disabled={!done} onClick={save}>
            <DownloadSimpleIcon
              aria-hidden="true"
              className="size-3 shrink-0"
            />
            save
          </Pill>

          {/*
           * `tune` is the way into the three knobs and it stays a quiet pill,
           * with the same icon and the same word `rain-splatter` uses for the
           * same job. Two filled pills in one row is two answers to which
           * control the demo is about, and it is the one that runs it.
           */}
          <Pill
            expanded={open}
            controls={panelId}
            disabled={running}
            onClick={() => setOpen((on) => !on)}
          >
            <SlidersHorizontalIcon
              aria-hidden="true"
              className="size-3 shrink-0"
            />
            tune
          </Pill>
        </div>
      </div>

      {/*
       * The three knobs, closed.
       *
       * **A grid whose single row goes from `0fr` to `1fr`**, with the panel
       * inside an `overflow-hidden` child, which is `rain-splatter`'s build and
       * the one way to animate to a height the browser works out for itself:
       * `max-height` needs a number nobody can write correctly at two column
       * counts, and a height in JS is a measurement that goes stale on the next
       * reflow.
       *
       * **The gap lives inside the collapsing box**, so a closed panel is
       * genuinely zero pixels rather than zero plus a gap. That is also why the
       * row above is a group of its own rather than a third item in a gapped
       * column.
       *
       * **`inert` while closed, and it is not optional.** A `0fr` row is
       * invisible and its three ranges are still in the tab order, so without
       * it the first Tab past `tune` lands on a slider nobody can see. `inert`
       * takes the subtree out of the tab order and out of the accessibility
       * tree at once, which `aria-hidden` alone would not do.
       */}
      <div
        id={panelId}
        inert={!open}
        className={cn(
          /* `motion-safe:`, so under the setting the panel arrives rather than
             unrolls. Same call `rain-splatter` makes on its own. */
          "grid w-full motion-safe:transition-all motion-safe:duration-200",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="flex justify-center pt-10">
            <Panel
              settings={settings}
              disabled={running}
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
