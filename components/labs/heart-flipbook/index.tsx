"use client";

import {
  ArrowsLeftRightIcon,
  SlidersHorizontalIcon,
} from "@phosphor-icons/react";
import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { TextMorph } from "torph/react";
import { type Knob, Lane, Pill } from "@/components/lab/controls";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  bake,
  HEART_PATH,
  HEART_W,
  paint,
  paintStill,
  TILE,
  tileAt,
} from "./burst";

/**
 * The like button, and the strip it is played from.
 *
 * Twitter's own heart is not an animation. It is a sprite sheet: one PNG of 29
 * frames, played with `background-position` and `steps(28)`. The most copied
 * micro-interaction on the web is a flipbook, and it gets away with that
 * because 29 frames over 800ms is one image every 28.6ms, which is under two
 * display frames.
 *
 * So this builds the burst properly, bakes it into a strip from the same
 * painter, and lets a reader swap between them. In the button they are one
 * thing, which is the finding. **The strip is what makes that visible**, since
 * the button cannot: it is the frames themselves, with the one being shown
 * boxed as it plays.
 *
 * ─────────────────────────────────────────────────────────
 * STAGE
 *
 *   ┌───────────────────────────────────────────┐
 *   │                            [⇄ flipbook]   │  what is playing it
 *   │                 ♥  1284                   │  the subject, in a pinned
 *   │            (burst envelope)               │  box so it never moves
 *   │                                           │
 *   ├───────────────────────────────────────────┤
 *   │ ▣▣▣▣▣▣▣▣▣▣▣▣▣▣▣▣▣▣▣▣▣▣▣▣▣▣▣▣▣ │  the sheet, as a band
 *   └───────────────────────────────────────────┘
 *
 * The sheet runs edge to edge at the foot, one white cell per frame on a rail,
 * and the mode sits in the opposite corner from nothing. Three builds got
 * here: the strip alone against the stage's bottom edge with the mode pill
 * below the stage beside two knobs it has nothing to do with, then a bordered
 * white box on the white stage, which is the visual language of an empty
 * input, with the pill orphaned on a line under it.
 *
 * A readout sat beside the pill for a while, `29 frames · 28.6ms each ·
 * steps(28)`. It is gone: the strip already shows how many frames there are,
 * the knobs already say the numbers, and `steps(28)` is CSS syntax that means
 * nothing to anyone who has not already been told what a sprite sheet is. That
 * belongs in the post, where there is room to explain it.
 * ─────────────────────────────────────────────────────────
 */

/**
 * The heart's ink, which is X's own like colour.
 *
 * This is the brand-hex exception the site already grants its social marks,
 * arriving at an interaction rather than a logo: the lab recreates one
 * company's button, and a different pink would be a recreation of nothing.
 * 3.84:1 on `bg`, so it clears a graphic's floor. It is deliberately not
 * `halftone-ripple`'s `INK`, which is that experiment's and is documented as
 * being nothing else's.
 */
const INK = "#f91880";

/** the hover disc, which is the same ink a tenth of the way onto the page */
const WASH = "rgb(249 24 128 / 0.1)";

/** the count before anyone has pressed */
const BASE = 1284;

/**
 * The button and the sheet, as shares of the stage.
 *
 * Everything on the stage is sized off these two, so a phone gets the same
 * picture rather than a full-size burst in a small frame, which is
 * `ember-burst`'s call. They are declared on the stage and read by its
 * descendants, the only arrangement that works: an element is a query container
 * for what is inside it and never for itself, the trap `document-pocket`
 * documents at length.
 *
 * `--heart` was 7.44cqw and is 8.6, which is 46px on the lab column against 40.
 * The two knob lanes under the stage are 24px black numerals on 500px tracks,
 * so at 40 the loudest thing in the frame was a setting and the quietest was
 * the subject.
 *
 * `--strip` is the tallest a tile may paint, not the row's height. A tile is
 * square and never wider than its share of the room, so at 29 frames it lands
 * around 17px and at 6 it hits this ceiling.
 */
const HEART_CSS = "clamp(1.5rem, 8.6cqw, 2.875rem)";
const STRIP_CSS = "clamp(1.25rem, 7.5cqw, 2.5rem)";

/** how long the confetti stands before it is gone, under reduced motion */
const STILL_LIFE = 320;

/** `book-opening`'s numbers, so the lab has one curve for text */
const MORPH = {
  duration: 200,
  ease: "cubic-bezier(0.32, 0.72, 0, 1)",
} as const;

interface Tuning {
  frames: number;
  run: number;
}

const DEFAULTS: Tuning = { frames: 29, run: 800 };

/**
 * Two lanes, and neither can break the burst.
 *
 * Not every constant in `burst.ts` is a control. The ring's life, the heart's
 * entrance and the confetti's reach are bound to each other, and a reader who
 * moved one would see a shape rather than a finding, which is `pixel-reveal`'s
 * call for `FLIGHT` and `WAIT`. These two change how the animation is
 * delivered and never what it is, which is the whole subject.
 */
const KNOBS: readonly Knob<keyof Tuning>[] = [
  {
    key: "frames",
    label: "frames",
    min: 6,
    max: 36,
    step: 1,
    format: (v) => String(Math.round(v)),
  },
  {
    key: "run",
    label: "run",
    min: 300,
    max: 2400,
    step: 50,
    format: (v) => `${Math.round(v)}ms`,
  },
];

type Mode = "flipbook" | "live";

export default function HeartFlipbook() {
  const [on, setOn] = useState(false);
  const [mode, setMode] = useState<Mode>("flipbook");
  const [tuning, setTuning] = useState<Tuning>(DEFAULTS);
  /* what hides the DOM heart, since during a burst the canvas owns it */
  const [bursting, setBursting] = useState(false);
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const reduce = useReducedMotion();

  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const heartBox = useRef<HTMLSpanElement>(null);
  const stripWrap = useRef<HTMLDivElement>(null);
  const stripCanvas = useRef<HTMLCanvasElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const lit = useRef<HTMLDivElement>(null);

  const ctx = useRef<CanvasRenderingContext2D | null>(null);
  const size = useRef({ w: 0, h: 0 });
  /* where the burst lands, in stage px: the heart's own centre */
  const centre = useRef({ x: 0, y: 0 });
  /*
   * What the sheet was baked at against what CSS decided the heart is. Both the
   * live painter and the blit go through it, so the two deliveries stay the same
   * size as each other and as the DOM heart they hand over to.
   */
  const k = useRef(1);
  const dpr = useRef(1);
  /** the rule between two frames, read off the token once: a canvas takes no var() */
  const rule = useRef("");

  const strip = useRef<HTMLCanvasElement | null>(null);
  const tileW = useRef(0);
  const stripW = useRef(0);

  const frame = useRef(0);
  const started = useRef(0);

  /* the loop reads all of these outside a render */
  const live = useRef(mode === "live");
  const still = useRef(false);
  const span = useRef(DEFAULTS.run);
  const count = useRef(DEFAULTS.frames);

  useEffect(() => {
    live.current = mode === "live";
  }, [mode]);
  useEffect(() => {
    still.current = reduce ?? false;
  }, [reduce]);
  useEffect(() => {
    count.current = tuning.frames;
  }, [tuning.frames]);

  /** lay the sheet out for the room it has, and blit it into the display */
  const layout = useCallback(() => {
    const wrap = stripWrap.current;
    const display = stripCanvas.current;
    const sheet = strip.current;
    if (!wrap || !display || !sheet) return;

    const room = wrap.clientWidth;
    /*
     * The ceiling is read off the row's `max-height` rather than off `--tile`
     * directly. An unregistered custom property computes to its own text, so
     * `getPropertyValue("--tile")` hands back the literal `clamp(...)` and
     * `parseFloat` gives `NaN`. `max-height` resolves to pixels, and it is
     * honest here besides: the row really is capped at a tile.
     */
    const tall = Number.parseFloat(getComputedStyle(wrap).maxHeight);
    if (room < 1 || !Number.isFinite(tall) || tall < 1) return;

    /*
     * A tile is square and never taller than the ceiling, so a short strip is a
     * row of readable frames and a long one is a dense filmstrip.
     */
    const n = count.current;
    const tile = Math.min(tall, room / n);
    const width = tile * n;
    const ratio = dpr.current;

    display.style.width = `${width}px`;
    display.style.height = `${tile}px`;
    display.width = Math.round(width * ratio);
    display.height = Math.round(tile * ratio);

    const c = display.getContext("2d");
    if (c) {
      c.clearRect(0, 0, display.width, display.height);
      c.drawImage(
        sheet,
        0,
        0,
        sheet.width,
        sheet.height,
        0,
        0,
        display.width,
        display.height,
      );

      /*
       * One hairline between each pair, which is how this site separates
       * anything: `folder-stack` puts a full outline on every card so the
       * drawing does the work and the tones underneath can be a step apart
       * rather than a world apart. `stroke-strong` on the band is 1.21:1, the
       * same quiet step that lab's papers hold, where `stroke` on it is 1.03
       * and is not there at all.
       *
       * On the half pixel so a 1px line lands on a pixel rather than across
       * two, and never at either end, where the band's own edges are.
       */
      c.strokeStyle = rule.current;
      c.lineWidth = 1;
      c.beginPath();
      for (let i = 1; i < n; i++) {
        const x = Math.round(i * tile * ratio) + 0.5;
        c.moveTo(x, 0);
        c.lineTo(x, display.height);
      }
      c.stroke();
    }

    tileW.current = tile;
    stripW.current = width;
    if (box.current) box.current.style.width = `${tile}px`;
    if (lit.current) lit.current.style.width = `${tile}px`;
  }, []);

  /* size the live canvas to the stage, and read the scale off the rendered heart */
  useEffect(() => {
    const el = stage.current;
    const c = canvas.current;
    if (!el || !c) return;

    const context = c.getContext("2d");
    if (!context) return;
    ctx.current = context;

    rule.current = getComputedStyle(document.documentElement)
      .getPropertyValue("--color-stroke-strong")
      .trim();

    const observer = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;

      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      dpr.current = ratio;
      c.width = Math.round(rect.width * ratio);
      c.height = Math.round(rect.height * ratio);
      /* setting either dimension resets the transform, so it goes back on after */
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      size.current = { w: rect.width, h: rect.height };

      const heart = heartBox.current?.getBoundingClientRect();
      if (heart && heart.width > 0) {
        centre.current = {
          x: heart.left + heart.width / 2 - rect.left,
          y: heart.top + heart.height / 2 - rect.top,
        };
        k.current = heart.width / HEART_W;
      } else {
        centre.current = { x: rect.width / 2, y: rect.height / 2 };
        k.current = 1;
      }

      layout();
    });
    observer.observe(el);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, [layout]);

  /* bake the sheet whenever the frame count moves, and never per frame */
  useEffect(() => {
    strip.current = bake(
      tuning.frames,
      Math.min(window.devicePixelRatio || 1, 2),
      INK,
    );
    layout();
  }, [tuning.frames, layout]);

  /*
   * Hand the heart back to the DOM one frame after the commit that shows it.
   * Both are the same path at the same size and colour, so the overlap is
   * invisible where a gap would flash, and clearing on the commit itself would
   * be that gap.
   */
  useEffect(() => {
    if (bursting) return;
    const id = requestAnimationFrame(() => {
      const c = ctx.current;
      if (c) c.clearRect(0, 0, size.current.w, size.current.h);
    });
    return () => cancelAnimationFrame(id);
  }, [bursting]);

  const run = useCallback((now: number) => {
    const c = ctx.current;
    if (!c) {
      frame.current = 0;
      return;
    }

    const { w, h } = size.current;
    const { x, y } = centre.current;
    const scale = k.current;
    c.clearRect(0, 0, w, h);

    if (still.current) {
      const fade = (now - started.current) / STILL_LIFE;
      c.save();
      c.translate(x, y);
      c.scale(scale, scale);
      paintStill(c, fade);
      c.restore();
      frame.current = fade < 1 ? requestAnimationFrame(run) : 0;
      if (!frame.current) setBursting(false);
      return;
    }

    const progress = (now - started.current) / span.current;

    if (progress >= 1) {
      frame.current = 0;
      /* the last tile is the settled heart, so it is what the DOM takes over */
      c.save();
      c.translate(x, y);
      c.scale(scale, scale);
      paint(c, 1, INK);
      c.restore();
      if (head.current) head.current.style.opacity = "0";
      if (box.current) box.current.style.opacity = "0";
      if (lit.current) lit.current.style.opacity = "0";
      setBursting(false);
      return;
    }

    if (live.current) {
      c.save();
      c.translate(x, y);
      c.scale(scale, scale);
      paint(c, progress, INK);
      c.restore();
    } else {
      const sheet = strip.current;
      if (sheet) {
        const i = tileAt(progress, count.current);
        const side = TILE * dpr.current;
        /* one sheet, blitted smaller on a narrow stage rather than re-baked,
           which is what `background-size` does for the real thing */
        const dest = TILE * scale;
        c.drawImage(
          sheet,
          i * side,
          0,
          side,
          side,
          x - dest / 2,
          y - dest / 2,
          dest,
          dest,
        );
      }
    }

    /* the strip is the timeline in both modes: a continuous head where nothing
       is quantised, and the tile that is literally on screen where it is */
    if (head.current) {
      head.current.style.opacity = live.current ? "1" : "0";
      head.current.style.transform = `translateX(${progress * stripW.current}px)`;
    }
    if (box.current || lit.current) {
      const at = `translateX(${
        tileAt(progress, count.current) * tileW.current
      }px)`;
      const show = live.current ? "0" : "1";
      if (box.current) {
        box.current.style.opacity = show;
        box.current.style.transform = at;
      }
      if (lit.current) {
        lit.current.style.opacity = show;
        lit.current.style.transform = at;
      }
    }

    frame.current = requestAnimationFrame(run);
  }, []);

  const press = () => {
    const next = !on;
    setOn(next);
    /* an unlike is the fill leaving and nothing else, which is what the real
       button does: the burst belongs to the press that turns it on */
    if (!next) return;

    span.current = tuning.run;
    started.current = performance.now();
    setBursting(!still.current);
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(run);
  };

  const flip = mode === "flipbook";
  const sheetLabel = open ? "Hide the sheet" : "Show the sheet";

  return (
    /* `@container` here as well as on the stage, since a container governs its
       descendants and never its siblings: the lanes sit outside the stage, so
       without this their `@sm:` columns never match. */
    <div
      className="@container flex w-full flex-col"
      style={
        {
          "--heart": HEART_CSS,
          "--tile": STRIP_CSS,
        } as React.CSSProperties
      }
    >
      <div
        ref={stage}
        /* `select-none` because the gesture is a flurry of presses on one small
           control, and a rapid multi-click anchors a selection on the nearest
           text it can find, which is `crack-button`'s case. The stage is white
           on a white frame, so it carries its own hairline: `flush` puts it edge
           to edge and its fill covers the frame's own inset ring. */
        className="@container relative isolate aspect-8/5 w-full select-none overflow-hidden rounded-t-lg bg-bg ring-1 ring-stroke ring-inset"
      >
        <div className="absolute inset-0">
          {/*
           * The subject hangs off the top and the sheet block off the foot, so
           * the tile size the `frames` knob sets grows into the gap between
           * them and moves neither. Centred in the remaining space it slid the
           * heart under the reader's pointer, and bottom-anchored alone it left
           * the stage's foot moving instead.
           */}
          {/* the subject, centred in all of the stage now that the sheet has
              left it */}
          <div className="absolute inset-0 grid place-items-center">
            <TooltipProvider delayDuration={200}>
              {/* a toggle's tooltip names what a press will do, since the fill
                  and `aria-pressed` already say what is true. The reference's
                  own copy, which is also the signature player's call. */}
              <Tooltip label={on ? "Unlike" : "Like"} side="bottom">
                <button
                  type="button"
                  onClick={press}
                  aria-pressed={on}
                  style={{ "--ink": INK } as React.CSSProperties}
                  className={cn(
                    "group flex cursor-pointer items-center rounded-full",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2",
                  )}
                >
                  {/*
                   * One colour drives the heart's stroke, its fill and the
                   * count, through `currentColor`, which is what turns all
                   * three pink on hover in one declaration. Nothing scales on
                   * press, per the site's own override.
                   */}
                  <span
                    style={{ gap: "calc(var(--heart) * 0.34)" }}
                    className={cn(
                      "flex items-center text-text-secondary transition-colors duration-200",
                      "group-hover:text-[var(--ink)] group-aria-pressed:text-[var(--ink)]",
                    )}
                  >
                    <span
                      ref={heartBox}
                      className="relative grid shrink-0 place-items-center"
                      style={{ width: "var(--heart)", height: "var(--heart)" }}
                    >
                      {/* the hover disc, which is the reference's own and is CSS
                          on their side too: it belongs to the button's states
                          and never to the burst, so it is not in the sheet. At
                          this inset it is exactly the ring's widest, which is
                          what the reference draws. */}
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute rounded-full opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                        style={{
                          inset: "calc(var(--heart) * -0.55)",
                          backgroundColor: WASH,
                        }}
                      />
                      {/* hidden while the canvas holds the heart, and the two
                          are one path so the handover cannot be seen */}
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        className={cn(
                          "relative size-full",
                          bursting && "invisible",
                        )}
                      >
                        <path
                          d={HEART_PATH}
                          strokeWidth={2}
                          strokeLinejoin="round"
                          className={cn(
                            "fill-transparent stroke-current transition-[fill] duration-200",
                            "group-aria-pressed:fill-current",
                          )}
                        />
                      </svg>
                    </span>

                    {/* off the type scale on purpose, the standing
                        `flip-clock`'s numerals and `tide-card`'s height have:
                        the button is a drawn object sized in shares of the
                        stage, and a token size would not scale with it. */}
                    <span
                      className="tabular-nums"
                      style={{
                        fontSize: "calc(var(--heart) * 0.6)",
                        lineHeight: 1,
                      }}
                    >
                      <TextMorph duration={MORPH.duration} ease={MORPH.ease}>
                        {String(BASE + (on ? 1 : 0))}
                      </TextMorph>
                    </span>
                    <span className="sr-only">likes</span>
                  </span>
                </button>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/*
           * The sheet, what is playing it and what that costs a frame: one
           * block, because the mode is a fact about the strip and the numbers
           * describe it. The strip is the only thing on the stage that can say
           * a flipbook is running, since the button cannot.
           */}
          {/*
           * The mode, anchored in a corner rather than loose under the sheet.
           * `book-opening` puts its own mode control in one for the same
           * reason: a corner reads as placed where a lone item on a line reads
           * as dropped, and under a full-width sheet this had 400px of nothing
           * beside it. Top right, so it comes after the subject in the reading
           * order rather than before it.
           */}
          <div className="absolute top-5 right-5">
            <TooltipProvider delayDuration={200}>
              <Pill
                onClick={() => setMode(flip ? "live" : "flipbook")}
                label={flip ? "Draw it live instead" : "Play it as a flipbook"}
              >
                <ArrowsLeftRightIcon aria-hidden="true" className="size-3" />
                <TextMorph duration={MORPH.duration} ease={MORPH.ease}>
                  {mode}
                </TextMorph>
              </Pill>
            </TooltipProvider>
          </div>
        </div>

        {/* over the button, since the confetti passes in front of the count the
            way it does in the reference */}
        <canvas
          ref={canvas}
          className="pointer-events-none absolute inset-0 size-full"
        />
      </div>

      {/*
       * The way in, above what it opens, so neither the stage nor the pill
       * moves when the panel arrives and the whole thing grows from the edge
       * nobody is looking at. `rain-splatter`'s call, and its disclosure below.
       *
       * The pill says `sheet` rather than `tune`, since the sheet is what a
       * reader came for and the two knobs are what they can do to it once it is
       * open. Its hover is held while it is open through `aria-expanded:`,
       * which is the site's rule for any trigger.
       */}
      <div className="flex justify-center px-6 pt-4">
        <TooltipProvider delayDuration={200}>
          <Tooltip label={sheetLabel}>
            <Pill
              onClick={() => setOpen((o) => !o)}
              label={sheetLabel}
              expanded={open}
              controls={panelId}
            >
              <SlidersHorizontalIcon aria-hidden="true" className="size-3" />
              sheet
            </Pill>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/*
       * A grid whose single row goes from `0fr` to `1fr`, with the panel in an
       * `overflow-hidden` child, which is the one way to animate to a height the
       * browser works out for itself. The padding lives inside the collapsing
       * box, so a shut panel is genuinely zero pixels rather than zero plus a
       * gap. `inert` while shut is not optional: a `0fr` row is invisible and
       * its two ranges are still in the tab order.
       */}
      <div
        id={panelId}
        inert={!open}
        className={cn(
          "grid w-full motion-safe:transition-all motion-safe:duration-200",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="px-6 pt-4">
            {/*
             * The sheet, as a `fill` lane rather than the band it was when it
             * lived at the stage's foot. Out here it is one item in a panel
             * beside two others, so it takes the same shape they do, and a
             * rounded lane has no edge to collide with the frame's own inset
             * ring the way a full-bleed band does.
             */}
            <div className="rounded-lg bg-fill px-2 py-2">
              <div
                ref={stripWrap}
                className="flex w-full justify-center"
                style={{ maxHeight: "var(--tile)" }}
              >
                <div className="relative">
                  {/*
                   * The playing frame sits on the white it was drawn for, which
                   * is what makes it read as lifted off the lane rather than
                   * boxed on it. Under the canvas, so the frame's own art and
                   * the rules either side of it still paint over the top: a
                   * positioned element paints above a static sibling whatever
                   * the DOM order, so the canvas has to be positioned too.
                   */}
                  <div
                    ref={lit}
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 left-0 bg-bg opacity-0"
                  />
                  <canvas ref={stripCanvas} className="relative block" />
                  <div
                    ref={box}
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 left-0 opacity-0 ring-1 ring-stroke-strong ring-inset"
                  />
                  <div
                    ref={head}
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 left-0 w-px bg-text-muted opacity-0"
                  />
                </div>
              </div>
            </div>

            {/* two lanes rather than `Panel`'s three, since the mode control is
                in the stage: two in two columns balance, where `Panel` refuses
                two because its odd third lane would sit beside an empty cell */}
            <div className="grid gap-5 pt-5 @sm:grid-cols-2 @sm:gap-x-8">
              {KNOBS.map((knob) => (
                <Lane
                  key={knob.key}
                  knob={knob}
                  value={tuning[knob.key]}
                  onChange={(value) =>
                    setTuning((t) => ({ ...t, [knob.key]: value }))
                  }
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="h-6" />
    </div>
  );
}
