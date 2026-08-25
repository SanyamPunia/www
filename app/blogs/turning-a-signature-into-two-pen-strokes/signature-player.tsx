"use client";

import {
  ArrowsClockwiseIcon,
  PaletteIcon,
  PauseIcon,
  PlayIcon,
  StopIcon,
} from "@phosphor-icons/react";
import {
  AnimatePresence,
  type AnimationPlaybackControls,
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Demo } from "@/components/blogs/demo";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  DASH,
  drawnAt,
  nibAt,
  offsetsAt,
  REST,
  remaining,
  SEGMENTS,
  TICKS,
} from "./timeline";

/*
 * The post's demo: the footer's signature, with a transport.
 *
 * Colocated because nothing else uses it. The mark in the footer is two CSS
 * animations that play once and are gone. The asset is the interesting part and
 * nobody ever sees it: two centreline strokes in writing order with one pen lift
 * between them. So here it is on a timeline, over a ghost of the finished mark,
 * with a nib riding the stroke and a block per stroke on the track.
 *
 * Everything is driven from one motion value. The paths, the two block fills, the
 * nib and the slider's position are all written to imperatively, so a play is one
 * subscription touching the DOM and not a render per frame.
 */

/** the asset, fetched rather than imported, the same call the footer's mark makes */
const ASSET = "/assets/signature.svg";

/**
 * The nib, in the asset's own units.
 *
 * A ring round the tip rather than a dot on it. A filled dot in the same colour
 * as the ink merges with the stroke's own round cap and reads as a thicker bit of
 * ink, which says nothing. At 5.4 the ring clears the 4.4 stroke's 2.2 radius, so
 * it sits just outside the line and reads as a position.
 *
 * `halo` is a second, wider ring in the page's own background painted under it.
 * The nib is already the last child of the top layer, so this is not a stacking
 * problem: it is that a ring in the ink's colour disappears exactly where it
 * crosses the ink, which is most of the time. The halo cuts a gap around it, the
 * same trick `tether-button` uses to make a line read over anything.
 */
const NIB = { radius: 5.4, weight: 1.4, halo: 3.4 } as const;

/**
 * One hue per stroke, for the tint toggle.
 *
 * The same exception the labs take, and the narrowest use of it on the site: the
 * two strokes are the same ink doing the same thing, so which is which cannot be
 * read off the mark at all. Both clear 3:1 on white as graphics, indigo at 5.12
 * and rose at 4.70.
 *
 * Off by default. The mark is monochrome everywhere else on this site, and the
 * ticks, the nib going out and the readout already say there are two strokes
 * without touching its colour.
 */
const TINTS = {
  /* on the mark, where a stroke has to read as a graphic on white paper */
  ink: ["#1d4ed8", "#be123c"],
  /*
   * on the track, where the same hue is a 22px block carrying a label. The
   * saturated pair is 1.9:1 under `text-primary`, so the block takes the wash and
   * the label stays readable through the sweep, which is the `mark` and `tint`
   * split `event-stacking` already makes.
   */
  wash: ["#c7d2fe", "#fecdd3"],
} as const;

const RATES = [0.5, 1, 2] as const;

/**
 * Half the scrubber's thumb, in pixels.
 *
 * A range's thumb travels between its own centres and not edge to edge, so
 * everything drawn against the track is inset by this much at each end: the
 * sections, the ticks and the labels all line up with the value they name only
 * because of it. The thumb is a playhead bar `w-1.5` wide, which is 4.8px on this
 * scale, so this is 2.4.
 */
const TRACK_INSET = 2.4;

/** where a progress lands on the track, and how wide a span of it is */
const trackAt = (progress: number) =>
  `calc(${TRACK_INSET}px + ${progress} * (100% - ${TRACK_INSET * 2}px))`;
const trackSpan = (span: number) =>
  `calc(${span} * (100% - ${TRACK_INSET * 2}px))`;

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2";

/*
 * The transport's glyphs are the one place this project passes an icon weight.
 *
 * `fill` rather than the `regular` default, because these are player symbols
 * rather than UI icons: a filled triangle and a filled square are what a
 * transport looks like everywhere, and at `size-3.5` on a pill the outline
 * versions read as sketches of the controls.
 */
const CONTROL_BASE =
  "relative flex h-8 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50";

const CONTROL = `${CONTROL_BASE} w-8`;

/* the speed reads "0.5x", which does not fit a square */
const CONTROL_WIDE = `${CONTROL_BASE} w-11`;

/*
 * The three secondary controls, on the transport's own `bg-fill` pill rather than
 * on the frame's white, so every background step moves up one: a `hover:bg-fill`
 * here would be invisible.
 */
const QUIET =
  "text-text-secondary hover:bg-fill-hover hover:text-text-primary active:bg-fill-active aria-pressed:bg-fill-hover aria-pressed:text-text-primary";

export default function SignaturePlayer() {
  const rootRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const inkRef = useRef<HTMLDivElement>(null);
  const scrubRef = useRef<HTMLInputElement>(null);

  const paths = useRef<SVGPathElement[]>([]);
  /*
   * Each path's real length, measured once. `pathLength="1"` renormalises the
   * dash pattern only, so `getPointAtLength` still wants user units.
   */
  const lengths = useRef<number[]>([]);
  const nib = useRef<{ group: SVGGElement; ring: SVGCircleElement } | null>(
    null,
  );
  /** one per section of the track, filled by that stroke's own drawn fraction */
  const fills = useRef<(HTMLDivElement | null)[]>([]);
  const playback = useRef<AnimationPlaybackControls | null>(null);
  const autoplayed = useRef(false);

  const progress = useMotionValue(0);
  const [playing, setPlaying] = useState(false);
  /*
   * 0.5x by default, which is what the autoplay plays at.
   *
   * The point of this demo is the order the strokes are written in and the pause
   * between them, and at 1x the whole thing is over in 1.58s. The pill shows the
   * rate rather than the run carrying its own, so what is pressed agrees with
   * what you just watched.
   */
  const [rate, setRate] = useState<number>(0.5);
  const [loop, setLoop] = useState(false);
  const [tint, setTint] = useState(false);
  const [ready, setReady] = useState(false);

  const reduce = useReducedMotion();
  const inView = useInView(rootRef, { once: true, margin: "-80px" });

  /*
   * One fetch, two copies. The ghost is the finished mark at low opacity and the
   * ink is the copy that gets dashed, so the two cannot disagree about the
   * geometry: there is one asset and it is the source for both.
   *
   * Only the ink copy is dashed, and the dash is set here rather than by
   * borrowing `.signature` from `globals.css`, since that class carries the
   * animation this replaces.
   */
  useEffect(() => {
    const ghost = ghostRef.current;
    const ink = inkRef.current;
    if (!ghost || !ink) return;

    let cancelled = false;
    fetch(ASSET)
      .then((response) => response.text())
      .then((markup) => {
        if (cancelled) return;

        ghost.innerHTML = markup;
        ink.innerHTML = markup;

        paths.current = [...ink.querySelectorAll("path")];
        lengths.current = paths.current.map((path) => path.getTotalLength());
        for (const path of paths.current) {
          path.style.strokeDasharray = DASH;
          path.style.strokeDashoffset = String(REST);
        }

        /*
         * The nib is appended to the injected markup rather than shipped in the
         * asset, since the asset is the mark and this is a readout about it. It
         * carries its own thin stroke rather than inheriting the mark's 4.4, or
         * the ring would be as heavy as the line it is tracking.
         */
        const svg = ink.querySelector("svg");
        if (svg) {
          const ns = "http://www.w3.org/2000/svg";
          const group = document.createElementNS(ns, "g");
          group.style.opacity = "0";

          const circle = (width: number) => {
            const node = document.createElementNS(ns, "circle");
            node.setAttribute("r", String(NIB.radius));
            node.setAttribute("fill", "none");
            node.setAttribute("stroke-width", String(width));
            return node;
          };

          const halo = circle(NIB.halo);
          // through `style`, since an SVG attribute cannot take a `var()`
          halo.style.stroke = "var(--color-bg)";
          const ring = circle(NIB.weight);

          // the group carries the position, so a frame writes one transform
          // rather than two coordinates on each of two circles
          group.append(halo, ring);
          svg.append(group);
          nib.current = { group, ring };
        }

        setReady(true);
      });

    return () => {
      cancelled = true;
      ghost.innerHTML = "";
      ink.innerHTML = "";
      paths.current = [];
      lengths.current = [];
      nib.current = null;
    };
  }, []);

  /* The tint, cleared back to the empty string rather than to a colour, so the
     mark returns to whatever `currentColor` is rather than to a guess at it. */
  useEffect(() => {
    if (!ready) return;
    paths.current.forEach((path, index) => {
      path.style.stroke = tint ? (TINTS.ink[index] ?? "") : "";
    });
    // the track says which stroke is which as well, or the sections and the ink
    // disagree about what the colour means
    fills.current.forEach((fill, index) => {
      if (fill)
        fill.style.backgroundColor = tint ? (TINTS.wash[index] ?? "") : "";
    });
  }, [tint, ready]);

  /*
   * The one thing that reads the progress, and it renders nothing.
   *
   * The ink, the track's two fills, the nib and the slider are all written to
   * straight from here, so a play costs no React render at all. The slider is
   * uncontrolled for the same reason, and dragging it never fights a value React
   * is also setting.
   */
  useEffect(() => {
    if (!ready) return;

    const write = (value: number) => {
      const offsets = offsetsAt(value);
      paths.current.forEach((path, index) => {
        path.style.strokeDashoffset = String(offsets[index] ?? 0);
      });

      /*
       * The same fractions, on the track. A transform rather than a width, so
       * nothing relayouts per frame, and the section clips its own overflow, so
       * scaling a plain rectangle inside a pill leaves the pill's caps alone.
       */
      const drawn = drawnAt(value);
      fills.current.forEach((fill, index) => {
        if (fill) fill.style.transform = `scaleX(${drawn[index] ?? 0})`;
      });

      const pen = nib.current;
      if (pen) {
        const at = nibAt(value);
        const path = at ? paths.current[at.index] : undefined;

        if (at && path) {
          const point = path.getPointAtLength(
            at.at * (lengths.current[at.index] ?? 0),
          );
          pen.group.setAttribute(
            "transform",
            `translate(${point.x} ${point.y})`,
          );
          // takes the stroke it is riding, so the ring says which path is drawing
          pen.ring.setAttribute(
            "stroke",
            tint ? (TINTS.ink[at.index] ?? "currentColor") : "currentColor",
          );
          pen.group.style.opacity = "0.85";
        } else {
          // both ends and the lift, which is exactly when the real pen was up
          pen.group.style.opacity = "0";
        }
      }

      /*
       * The thumb is skipped while the scrubber has focus, so a drag is not
       * overwritten mid-gesture, and never while playing, or the thumb sits
       * still through a whole write.
       *
       * Space plays from the scrubber, so the focused case is the common one and
       * not the exception. A drag pauses playback on its first `change`, so the
       * two conditions cannot both be true once the pointer is actually moving.
       */
      if (
        scrubRef.current &&
        (playing || document.activeElement !== scrubRef.current)
      ) {
        scrubRef.current.value = String(value);
      }
    };

    write(progress.get());
    return progress.on("change", write);
  }, [progress, ready, tint, playing]);

  useEffect(() => () => playback.current?.stop(), []);

  /*
   * Wrapped, so the autoplay effect below can depend on it.
   *
   * A named function expression rather than a hoisted helper, because the loop
   * calls it again from its own `onComplete` and a `useCallback` has no name to
   * recurse through otherwise.
   */
  const run = useCallback(
    function run(speed = rate) {
      playback.current?.stop();
      if (progress.get() >= 1) progress.set(0);

      setPlaying(true);
      playback.current = animate(progress, 1, {
        /*
         * From wherever the scrubber left it, so a seek never replays what is
         * already on the page. Divided by the rate rather than scaling the
         * timeline, which would move the ticks off the strokes they name.
         */
        duration: remaining(progress.get()) / speed,
        ease: "linear",
        onComplete: () => {
          if (!loop) {
            setPlaying(false);
            return;
          }
          progress.set(0);
          run(speed);
        },
      });
    },
    [progress, rate, loop],
  );

  const pause = () => {
    playback.current?.stop();
    setPlaying(false);
  };

  const stop = () => {
    playback.current?.stop();
    setPlaying(false);
    progress.set(0);
  };

  const seek = (value: number) => {
    playback.current?.stop();
    setPlaying(false);
    progress.set(value);
  };

  /*
   * Plays itself once, the first time it scrolls into view.
   *
   * Without it the demo is a blank stage with a faint ghost on it and nothing
   * saying that play does anything. The mark in the footer already does exactly
   * this, so the two behave the same way on arrival.
   *
   * Not under reduced motion. That setting is about motion nobody asked for, and
   * this is the one piece of motion here nobody asked for. Pressing play still
   * works.
   */
  useEffect(() => {
    if (!inView || !ready || reduce || autoplayed.current) return;
    autoplayed.current = true;
    run();
  }, [inView, ready, reduce, run]);

  return (
    /*
     * `block` rather than `Demo`'s own `grid place-items-center`, since this one
     * wants the frame's whole width and a centred grid item is sized to its
     * content.
     *
     * `select-none` because scrubbing is a drag across a row of text, so without
     * it a slow drag selects the axis numbers and the rate pills on the way past.
     * Everything in here is a control or a readout about one, so there is nothing
     * a reader would want to copy.
     */
    <Demo className="block">
      {/*
       * `gap-8` between the three groups, not `gap-5`.
       *
       * The stage, the timeline and the transport are three separate things and
       * the axis labels sit at the bottom edge of the middle one, so at 16px the
       * numbers ran straight into the transport underneath them and the whole
       * block read as one congested slab.
       */}
      <div ref={rootRef} className="flex w-full select-none flex-col gap-8">
        {/*
         * A real stage rather than a strip, and the mark takes most of the column.
         *
         * The asset is 2.06:1, so a height alone decides how wide it paints: sized
         * off `h-32` it filled 42% of the column and the whole demo read as a
         * toolbar with a line of ink above it. Sizing it by width instead scales it
         * with the column and caps it, which is what stops it overflowing at
         * 375px, where the cap is wider than the column itself.
         */}
        <div className="grid h-80 place-items-center">
          <div className="relative w-full max-w-96 text-text-primary">
            <div
              ref={ghostRef}
              aria-hidden="true"
              className="w-full opacity-[0.12] [&_svg]:block [&_svg]:h-auto [&_svg]:w-full"
            />
            <div
              ref={inkRef}
              aria-hidden="true"
              className="absolute inset-0 [&_svg]:block [&_svg]:h-auto [&_svg]:w-full"
            />
          </div>
        </div>

        <TooltipProvider>
          {/*
           * A timeline, not a slider.
           *
           * A lane with a block per stroke in it, so the write's shape is
           * visible before anything is pressed: two strokes with the 0.08s pen
           * lift as the gap between them. Each block fills off `drawnAt`, the
           * same fraction that moves that stroke's dash, so the track and the ink
           * cannot disagree.
           *
           * It is thick because it is the thing you grab. A 3.2px bar with a
           * 9.6px dot on it is a control you aim at. A 32px lane with a playhead
           * in it is one you drop a finger on, and it leaves room for the blocks
           * to carry their own names.
           *
           * The range is still a native range and still the only interactive
           * element here: it lies over the lane at full size, paints nothing but
           * its thumb, and keeps the keyboard behaviour a hand-rolled scrubber
           * would have to rebuild. Everything under it is `pointer-events-none`.
           */}
          <div className="flex flex-col gap-1.5">
            <div className="relative h-10">
              <div
                aria-hidden="true"
                className={cn(
                  "pointer-events-none absolute inset-0 overflow-hidden rounded-md bg-fill",
                  !ready && "opacity-50",
                )}
              >
                {/* the lane's own centre line, which the gap is what shows off */}
                <div className="absolute inset-x-1.5 top-1/2 border-stroke-strong border-t border-dashed" />

                {SEGMENTS.map((segment, index) => (
                  <div
                    key={segment.from}
                    style={{
                      left: trackAt(segment.from),
                      width: trackSpan(segment.to - segment.from),
                    }}
                    className="absolute top-1/2 flex h-7 -translate-y-1/2 items-center overflow-hidden rounded-md bg-fill-active"
                  >
                    {/*
                     * A `scaleX` inside a clipping block, never a width. A width
                     * relayouts every frame, and scaling a rounded bar squashes
                     * its own caps, so the block carries the radius and the bar
                     * inside it is a plain rectangle.
                     */}
                    <div
                      ref={(node) => {
                        fills.current[index] = node;
                      }}
                      style={{ transform: "scaleX(0)" }}
                      className="absolute inset-0 origin-left bg-text-muted/45"
                    />
                    {/*
                     * The stroke's name, inside the block it names rather than
                     * under it. `text-primary` because the fill sweeps beneath
                     * it, so the label sits on two grounds in one pass and has to
                     * clear both.
                     */}
                    <span className="relative truncate px-1.5 text-meta text-text-primary">
                      Stroke {index + 1}
                    </span>
                  </div>
                ))}
              </div>

              <input
                ref={scrubRef}
                type="range"
                min={0}
                max={1}
                step={0.002}
                defaultValue={0}
                disabled={!ready}
                aria-label="Scrub the signature"
                onChange={(event) => seek(Number(event.target.value))}
                onKeyDown={(event) => {
                  /*
                   * Space toggles playback, and only while the scrubber has
                   * focus. A range ignores space natively so nothing is being
                   * overridden, and keeping it off the window is what stops an
                   * embedded demo from eating the page's scroll key.
                   */
                  if (event.key !== " ") return;
                  event.preventDefault();
                  if (playing) pause();
                  else run();
                }}
                className={cn(
                  "absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-md bg-transparent",
                  "disabled:cursor-not-allowed",
                  // a playhead rather than a dot, since the lane is tall enough
                  // to carry one and a dot on a 32px lane reads as a stray bead
                  "[&::-webkit-slider-thumb]:h-7 [&::-webkit-slider-thumb]:w-1.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-text-primary",
                  "[&::-moz-range-track]:bg-transparent",
                  "[&::-moz-range-thumb]:h-7 [&::-moz-range-thumb]:w-1.5 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-text-primary",
                  FOCUS,
                )}
              />
            </div>

            {/*
             * The axis, on the same inset as everything else in the lane.
             *
             * Every tick is 0.1s and every other one carries its number, which is
             * what makes the blocks readable as durations rather than as two
             * proportions. The labels are centred on their tick, so the first one
             * overhangs the lane by a few pixels into the frame's own padding.
             *
             * `h-8` is what the row actually occupies: a 4.8px tick, then a label
             * at `top-2` on a 19.2px line. At `h-4` the numbers painted outside
             * the box and the flex gap below could not see them, so the transport
             * sat on top of the axis however wide the gap was.
             */}
            <div aria-hidden="true" className="relative h-8">
              {TICKS.map((tick) => (
                <div
                  key={tick.at}
                  style={{ left: trackAt(tick.at) }}
                  className="absolute top-0 flex flex-col items-center"
                >
                  <span
                    className={cn(
                      "w-px bg-stroke-strong",
                      tick.label ? "h-1.5" : "h-1",
                    )}
                  />
                  {tick.label ? (
                    <span className="-translate-x-1/2 absolute top-2 left-1/2 text-meta text-text-muted">
                      {tick.label}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          {/*
           * One centred pill, and nothing else on the row.
           *
           * Everything the player does is in it now: play, stop, loop, tint and
           * speed. It was a three-column grid holding a clock, the buttons and
           * three speed pills, which needed two `1fr` tracks to keep the middle
           * centred and a stacked layout below 420px. Five controls in one pill
           * need none of that and fit a phone.
           *
           * Two readouts used to sit at the ends of that row, a beat label and a
           * clock, and both are gone. The lane's two blocks name the stroke you
           * are in, its gap is the lift and the axis under it is numbered in
           * seconds, so both were repeating what the timeline already said.
           * Losing them also takes every `setState` out of the per-frame write.
           */}
          <div className="flex justify-center">
            <div className="flex items-center gap-2 rounded-full bg-fill p-2">
              <Tooltip label={playing ? "Pause" : "Play the write"}>
                <button
                  type="button"
                  onClick={playing ? pause : () => run()}
                  disabled={!ready}
                  aria-label={playing ? "Pause" : "Play"}
                  className={cn(
                    CONTROL,
                    /*
                     * The one dark element on this surface, which is what says
                     * where to press first. It cannot be another `bg-fill` step:
                     * the pill it sits on is already that.
                     *
                     * Alpha steps rather than the fill tokens, since none of them
                     * is a shade of this. Same shape as the rule everywhere else,
                     * hover one step, press one further.
                     */
                    "relative bg-text-primary text-bg hover:bg-text-primary/85 active:bg-text-primary/70",
                    FOCUS,
                  )}
                >
                  {/*
                   * A crossfade with a turn and a dip under it, not a path morph.
                   * Nothing here can compile one, and a triangle and two bars share
                   * no points to morph between anyway, which is the same call
                   * `heading-anchor` documents for its tick.
                   *
                   * `sync` rather than `CodeBlock`'s `mode="wait"`, and both glyphs
                   * are absolute, so they overlap through the swap and the button is
                   * never briefly empty. This one can be pressed twice in a row,
                   * where a copy control's confirmed state stands for two seconds.
                   *
                   * The scale and the rotation are what make it read as one glyph
                   * becoming the other rather than as two glyphs trading places, and
                   * `MotionProvider` drops both under reduced motion, leaving the
                   * crossfade on its own.
                   */}
                  <AnimatePresence initial={false}>
                    <motion.span
                      key={playing ? "pause" : "play"}
                      initial={{ opacity: 0, scale: 0.7, rotate: -14 }}
                      animate={{ opacity: 1, scale: 1, rotate: 0 }}
                      exit={{ opacity: 0, scale: 0.7, rotate: 14 }}
                      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                      className="absolute inline-flex"
                    >
                      {playing ? (
                        <PauseIcon
                          aria-hidden="true"
                          weight="fill"
                          className="size-3.5"
                        />
                      ) : (
                        <PlayIcon
                          aria-hidden="true"
                          weight="fill"
                          className="size-3.5"
                        />
                      )}
                    </motion.span>
                  </AnimatePresence>
                </button>
              </Tooltip>

              <Tooltip label="Stop, back to the start">
                <button
                  type="button"
                  onClick={stop}
                  disabled={!ready}
                  aria-label="Stop"
                  className={cn(CONTROL, QUIET, FOCUS)}
                >
                  <StopIcon
                    aria-hidden="true"
                    weight="fill"
                    className="size-3.5"
                  />
                </button>
              </Tooltip>

              {/* toggles, so they say their own state through `aria-pressed` and
                the filled background rather than through a second icon. Their
                tooltips name what a press will do, not what is already true. */}
              <Tooltip label={loop ? "Stop looping" : "Loop the write"}>
                <button
                  type="button"
                  onClick={() => setLoop((on) => !on)}
                  aria-pressed={loop}
                  aria-label="Loop"
                  className={cn(CONTROL, QUIET, FOCUS)}
                >
                  <ArrowsClockwiseIcon
                    aria-hidden="true"
                    weight="fill"
                    className="size-3.5"
                  />
                </button>
              </Tooltip>

              <Tooltip label={tint ? "Back to one ink" : "Colour each stroke"}>
                <button
                  type="button"
                  onClick={() => setTint((on) => !on)}
                  aria-pressed={tint}
                  aria-label="Colour each stroke"
                  className={cn(CONTROL, QUIET, FOCUS)}
                >
                  <PaletteIcon
                    aria-hidden="true"
                    weight="fill"
                    className="size-3.5"
                  />
                </button>
              </Tooltip>

              {/*
               * One control that cycles the speed, in the pill with everything
               * else. It was three pressed pills off to the right, which said
               * their own state and cost a whole grid column to sit in.
               *
               * A cycling button does need a tooltip, which a control carrying a
               * text label usually does not: the label is the value, not the
               * action, so nothing on it says a press changes anything.
               *
               * Changing the rate mid-play restarts the run from where it is,
               * since a playback's duration is fixed once it has started. The new
               * rate is passed in rather than read from state, which has not
               * committed yet.
               */}
              <Tooltip label="Change the speed">
                <button
                  type="button"
                  onClick={() => {
                    const at = RATES.indexOf(rate as (typeof RATES)[number]);
                    const next = RATES[(at + 1) % RATES.length] ?? 1;
                    setRate(next);
                    if (playing) run(next);
                  }}
                  aria-label={`Speed ${rate} times, press to change`}
                  className={cn(CONTROL_WIDE, QUIET, "text-meta", FOCUS)}
                >
                  {/*
                   * No crossfade on this one, unlike the play glyph. Play and
                   * pause are two different shapes and a swap between them wants
                   * covering. A rate is a number being corrected, and a number
                   * that fades and turns while it changes reads as an effect
                   * rather than as a readout.
                   */}
                  <span className="tabular-nums">{rate}×</span>
                </button>
              </Tooltip>
            </div>
          </div>
        </TooltipProvider>
      </div>
    </Demo>
  );
}
