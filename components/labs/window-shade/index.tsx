"use client";

import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef } from "react";
import { approach, clamp01, lerp } from "@/lib/lerp";
import { View } from "./view";
import {
  BEZEL,
  cq,
  EDGE,
  HANDLE_H,
  INK,
  MARK,
  PANE_INSET,
  PANE_OFFSET,
  pc,
  R_BEZEL,
  R_PANE,
  R_RECESS,
  RECESS,
  RECESS_INSET,
  SCALE_TOP,
  SCALE_X,
  SEAM_LIP,
  SEAM_SHADOW,
  SEAM_X,
  SEAM_Y,
  SHADE_FACE,
  SHADE_FOOT,
  SHADE_GAP,
  SHADE_H,
  SHADE_TOP,
  SHADE_W,
  STAGE_ASPECT,
  TICK,
  TICK_LONG,
  TRAVEL,
  WALL,
  WALL_ENDS,
  WIN_H,
  WIN_TOP,
  WIN_W,
  WINDOW_X,
} from "./window";

/**
 * A cabin window whose shade is drawn down by hand, and a cabin that goes dark
 * as it comes.
 *
 * The stage carries `--shade`, a plain number from 0 to 1. One `setProperty` per
 * frame writes it and the browser does the rest: the panel's `translate` is that
 * number times its own travel, and **every tone on the stage is a `color-mix`
 * between one of the site's light tokens and its `inverse-*` twin at that same
 * number.** So the theme is not a switch with two states, it is the position of a
 * physical control, and half way down is a real place to stop.
 *
 * That is also the only reason a deliberately light-only site has anything to say
 * here. `inverse-*` exists for the case a light ground cannot serve, and four
 * experiments already opt into it. This is the first to treat the two sets as the
 * two ends of one interpolation. See `window.ts` for the palette and the
 * geometry, and `view.tsx` for what is outside.
 *
 * ── how it is drawn ──────────────────────────────────────────────────────────
 *
 * **Structure is line art and only light is soft.** The first build was a render
 * of a plane window, which is what the reference is: a gradient bezel under three
 * stacked drop shadows, a recess made of two more, a photographic sky. Every one
 * of those is gone. What is left is flat fills, a hairline where two faces meet,
 * and a sky of flat bands.
 *
 * The four exceptions are the light itself, which is the same rule stated the
 * other way round: the pool on the wall, the falloff away from it, the bloom
 * under the panel's foot and the leak round a seated one. Light is soft, so it is
 * drawn soft, and nothing else on the stage is. Same call `folder-stack` makes
 * when it gives exactly one card in a pile a shadow.
 *
 * **The wall is a cabin rather than a field.** One panel joint below the window
 * and one frame break to its left, both drawn as grooves in light and shadow. See
 * `SEAM_SHADOW` for why a groove and not a tone.
 *
 * **The scale on the right is the site's own instrumentation**, the same move
 * `book-opening` makes when it prints its own lerp on the cover it is turning. It
 * spans the panel's exact travel, so the marker rides the edge it is measuring,
 * and its two ends name the tokens the ground is mixed from.
 *
 * Nothing in this component renders while the shade moves. The value, the readout
 * and `aria-valuenow` are all written straight to the DOM, the bar `book-opening`
 * and the signature player set.
 */

/**
 * How quickly a released shade travels to the end it was thrown at, as the time
 * constant of the approach in seconds.
 *
 * **One value for both directions, unlike `book-opening`'s pair.** There the two
 * are different events, a cover being opened against a pointer that has already
 * left. Here they are one hand doing one thing in two directions, and a shade
 * that shuts faster than it opens is a shade with a spring in it.
 *
 * Nothing overshoots. A lerp toward a target cannot pass it, which is the whole
 * reason this is not a spring: a window shade does not bounce off its own track.
 */
const TAU = 0.15;

/** how close counts as arrived, since an exponential approach never lands */
const EPSILON = 1e-4;

/** the dt a first frame assumes, and the most any frame is allowed to be worth */
const FIRST_STEP = 1 / 60;
const MAX_STEP = 1 / 15;

/**
 * How far a press may travel and still be a press, in px.
 *
 * A shade that only drags leaves a phone with nothing to do, so a press that goes
 * nowhere throws the panel at whichever end it is not already near. The slop is
 * what tells the two apart, and it is generous because a finger drifts.
 */
const SLOP = 4;

/** what one arrow key is worth, and one page key */
const STEP = 0.1;
const PAGE = 0.25;

/**
 * The panel's own offset, which is the interpolation itself and the only
 * transform on the stage.
 *
 * At 1 it sits where it is drawn, seated in the track. At 0 it is a full travel
 * higher, which leaves the stow strip showing and the rest of it above the pane's
 * own clip.
 */
const SLIDE = `0 calc((var(--shade, 0) - 1) * ${cq(TRAVEL)})`;

/** and the same value read forwards, for the marker that tracks the panel's foot */
const RIDE = `0 calc(var(--shade, 0) * ${cq(TRAVEL)})`;

/**
 * The light the window is letting in, and the dark it is holding back. Two layers
 * over one wall, each fading as the other arrives.
 *
 * **A pool of light cannot be painted on a light wall**, which is the trap here:
 * white on `fill-active` is a 1.1:1 step and simply is not there. What reads at
 * both ends is that the window is the only source, so the second layer deepens
 * everything away from it as the shade comes down. The pool then only has to do
 * its job in the middle of the crossing, which is exactly where a half-lit cabin
 * has one. Both are centred on the window rather than on the stage, since the
 * window is off centre and light comes from where the window is.
 *
 * The second layer is wide and faint on purpose. At 0.42 over 58% it was a halo
 * tight enough round the bezel to read as the drop shadow this redraw exists to
 * remove.
 */
const POOL = [
  `radial-gradient(42% 38% at ${pc(WINDOW_X - 0.08)} 82%, rgb(255 250 236 / 0.6) 0%, rgb(255 250 236 / 0) 72%)`,
  `radial-gradient(72% 70% at ${pc(WINDOW_X)} 50%, rgb(255 255 255 / 0.28) 0%, rgb(255 255 255 / 0) 78%)`,
].join(", ");

const FALLOFF = `radial-gradient(86% 80% at ${pc(WINDOW_X)} 50%, rgb(0 0 0 / 0) 22%, rgb(0 0 0 / 0.9) 100%)`;

/**
 * Fractal noise, inline as a data URI so the page makes no request for it.
 *
 * A cabin sidewall is moulded plastic, and grain is what a diffuse surface looks
 * like. It is also the one thing keeping a flat fill from being a dead swatch now
 * that every gradient has gone. `overlay` does most of its work on a mid tone, so
 * this is strongest through the crossing and quiet at both ends.
 */
const GRAIN = `url("data:image/svg+xml,%3Csvg viewBox='0 0 140 140' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E")`;

/**
 * The daylight getting past a seated panel.
 *
 * The gap is real geometry rather than a drawn effect, so this is only the
 * scatter off it, and it is one of the four things on the stage allowed to be
 * soft. It arrives with the shade, since a leak on a lit cabin wall is nothing
 * and a leak in a dark one is the brightest thing in the frame.
 *
 * **Tight, because a broad one reads as emission.** The first pass spread 3.4cqw
 * at 40%, which lit the whole panel from its own perimeter and turned the closed
 * window into a screen. Half the reach at half the alpha leaves an edge, which is
 * what light coming past a panel actually is.
 *
 * **Offset up a little, so the head of the pane gets less of it than the sides
 * and the foot.** An inset shadow with a negative vertical offset reaches further
 * at the bottom than at the top, which is the shape of the gap it stands for:
 * there is no sky above a shade, so what is at the top is scatter off the sides
 * rather than a leak of its own. See `SHADE_TOP`.
 */
const LEAK = [
  `inset 0 ${cq(-0.3)} ${cq(0.8)} rgb(255 255 255 / 0.5)`,
  `inset 0 ${cq(-0.8)} ${cq(2.2)} rgb(255 255 255 / 0.22)`,
].join(", ");

/** and the bloom just under the panel's foot, which travels with it */
const FLARE =
  "radial-gradient(76% 100% at 50% 0%, rgb(255 255 255 / 0.8) 0%, rgb(255 255 255 / 0) 74%)";

const FLARE_H = 4;

/**
 * How much taller than the drawn grip its own hit region is, each side.
 *
 * This region exists to carry `touch-action: none`, so its size is the whole
 * trade: too small and a finger cannot take the panel, too large and it is a band
 * of the demo where a phone cannot scroll. Measured on a 390px viewport, the grip
 * alone is 12px and this takes it to 30.
 */
const GRIP_PAD = 2.6;

/** every tenth of the travel gets a tick, every fifth a long one */
const TICKS = Array.from({ length: 11 }, (_, i) => i);

/** one live pull: which pointer, where it started, and how far it has been */
interface Grab {
  id: number;
  y: number;
  from: number;
  moved: number;
}

export default function WindowShade() {
  const stage = useRef<HTMLDivElement>(null);
  const slider = useRef<HTMLDivElement>(null);
  const readout = useRef<HTMLSpanElement>(null);

  /*
   * The animation, in refs. `shade` is where the panel is and `target` is where
   * it has been asked to be, and neither belongs in a render: one custom
   * property, one string of text and two attributes change per frame, and all
   * four are written straight to the node.
   */
  const shade = useRef(0);
  const target = useRef(0);
  const frame = useRef(0);
  const at = useRef(0);

  /** the live gesture, and what one unit of shade is worth in px for it */
  const grab = useRef<Grab | null>(null);
  const span = useRef(0);

  const reduced = useReducedMotion();

  const write = useCallback((value: number) => {
    stage.current?.style.setProperty("--shade", value.toFixed(4));
    if (readout.current) readout.current.textContent = value.toFixed(3);

    // the control's value is the same number, so it is written here rather than
    // rendered, or a drag would be a state update per frame
    const node = slider.current;
    if (!node) return;
    const percent = Math.round(value * 100);
    node.setAttribute("aria-valuenow", String(percent));
    node.setAttribute("aria-valuetext", `${percent}% closed`);
  }, []);

  const stop = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = 0;
  }, []);

  /*
   * One frame. Named, because it hands itself to the next
   * `requestAnimationFrame`.
   *
   * Reduced motion takes the whole gap in one step. The shade still opens and the
   * cabin still crosses, which is the demo. It just does not travel, the line
   * `book-opening` draws between what happened and how it looked.
   */
  const tick = useCallback(
    function tick(now: number) {
      const dt =
        at.current === 0
          ? FIRST_STEP
          : Math.min((now - at.current) / 1000, MAX_STEP);
      at.current = now;

      const to = target.current;
      shade.current = lerp(shade.current, to, reduced ? 1 : approach(TAU, dt));
      if (Math.abs(to - shade.current) < EPSILON) shade.current = to;

      write(shade.current);
      frame.current = shade.current === to ? 0 : requestAnimationFrame(tick);
    },
    [reduced, write],
  );

  /**
   * Point the shade at a value and make sure a frame is coming.
   *
   * The handle is for cancelling and is never a flag saying the loop is alive.
   * `book-opening` documents what skipping the request costs: a scheduled frame
   * that never arrives leaves a target nothing will read, and every gesture after
   * it does nothing but write that target again. The clock only restarts when the
   * loop was idle, or every frame of a drag would be handed the same assumed step.
   */
  const aim = useCallback(
    (to: number) => {
      target.current = to;
      if (!frame.current) at.current = 0;
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(tick);
    },
    [tick],
  );

  /** and the other kind of write: the pointer's own, which owns the value outright */
  const put = useCallback(
    (to: number) => {
      stop();
      shade.current = to;
      target.current = to;
      write(to);
    },
    [stop, write],
  );

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  /*
   * Re-assert what was written imperatively, after every render.
   *
   * There is only one thing that can render this component, which is the OS
   * changing its reduced-motion setting, and it would take `aria-valuenow` back
   * to the 0 in the markup. No dependency array on purpose: the cost is three DOM
   * writes on a render that happens once or never.
   */
  useEffect(() => write(shade.current));

  /*
   * ── the gesture ─────────────────────────────────────────────────────────────
   *
   * Grab and pull, relative to wherever the press landed, rather than aim and
   * jump. **That is the one reason this is not a native `range`**, which is what
   * the signature player's scrubber is and what the shared rules would otherwise
   * point at: a range moves its thumb to the click, and a shade that leaps to meet
   * your finger is not a shade. The cost is spelling out the keys, which is the
   * block below.
   */
  const down = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const width = stage.current?.getBoundingClientRect().width ?? 0;
    if (!width) return;

    span.current = (width * TRAVEL) / 100;
    grab.current = {
      id: event.pointerId,
      y: event.clientY,
      from: shade.current,
      moved: 0,
    };
    // so a pull that runs off the stage still tracks, and so the lift is heard
    // wherever it happens
    event.currentTarget.setPointerCapture(event.pointerId);
    put(shade.current);
  };

  const move = (event: React.PointerEvent<HTMLDivElement>) => {
    const held = grab.current;
    if (!held || held.id !== event.pointerId) return;

    const dy = event.clientY - held.y;
    held.moved = Math.max(held.moved, Math.abs(dy));
    put(clamp01(held.from + dy / span.current));
  };

  /**
   * A release leaves the panel exactly where it was let go, which is what a real
   * shade does and is what makes the crossing a continuum rather than a switch.
   * Only a press that never travelled is read as a throw.
   */
  const up = (event: React.PointerEvent<HTMLDivElement>) => {
    const held = grab.current;
    if (!held || held.id !== event.pointerId) return;
    grab.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (held.moved < SLOP) aim(shade.current > 0.5 ? 0 : 1);
  };

  /**
   * A touch that became a scroll is cancelled rather than lifted, so it never
   * reaches the release above and never counts as a press. That is the same slop
   * `folder-stack` relies on, arriving from the browser rather than measured.
   */
  const abandon = () => {
    grab.current = null;
  };

  /**
   * The keys, in the vertical slider's own order.
   *
   * Down and right close, up and left open. The maximum is at the bottom of the
   * travel here, so up meaning less is what the panel is visibly doing, and
   * `aria-valuetext` announces the result either way.
   */
  const key = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const from = target.current;
    const to =
      event.key === "ArrowDown" || event.key === "ArrowRight"
        ? from + STEP
        : event.key === "ArrowUp" || event.key === "ArrowLeft"
          ? from - STEP
          : event.key === "PageDown"
            ? from + PAGE
            : event.key === "PageUp"
              ? from - PAGE
              : event.key === "End"
                ? 1
                : event.key === "Home"
                  ? 0
                  : event.key === "Enter" || event.key === " "
                    ? from > 0.5
                      ? 0
                      : 1
                    : null;

    if (to === null) return;
    event.preventDefault();
    aim(clamp01(to));
  };

  return (
    <div
      ref={stage}
      className="@container relative w-full select-none overflow-hidden rounded-lg"
      style={{ aspectRatio: STAGE_ASPECT, backgroundColor: WALL }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: POOL, opacity: "calc(1 - var(--shade, 0))" }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: FALLOFF,
          opacity: "calc(var(--shade, 0) * 0.62)",
        }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.14] mix-blend-overlay"
        style={{ backgroundImage: GRAIN }}
      />

      {/* The cabin. A panel joint under the window and a frame break to its left,
          each a groove: a shadow on one side and a lit lip on the other, so one
          of the two carries it whichever end of the crossing the wall is at. The
          vertical stops at the joint, the way a panel above one does, which also
          keeps it off the readout. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 h-0.5"
        style={{
          top: pc(SEAM_Y),
          borderTop: `1px solid ${SEAM_SHADOW}`,
          borderBottom: `1px solid ${SEAM_LIP}`,
        }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-0 w-0.5"
        style={{
          left: pc(SEAM_X),
          height: pc(SEAM_Y),
          borderLeft: `1px solid ${SEAM_SHADOW}`,
          borderRight: `1px solid ${SEAM_LIP}`,
        }}
      />

      {/* The window. Decoration: the control below is a sibling covering the same
          box, and nothing inside here may answer a pointer.

          Flat fill and one hairline per face. The hairline is an `outline` rather
          than a ring so nothing can overwrite it, and its offset is negative so
          it paints on the face it belongs to rather than on the wall, which is
          why it needs no flip. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute"
        style={{
          left: pc(WINDOW_X),
          top: cq(WIN_TOP),
          translate: "-50% 0",
          width: cq(WIN_W),
          height: cq(WIN_H),
          borderRadius: cq(R_BEZEL),
          backgroundColor: BEZEL,
          outline: `1px solid ${EDGE}`,
          outlineOffset: "-1px",
        }}
      >
        <div
          className="absolute"
          style={{
            inset: cq(RECESS_INSET),
            borderRadius: cq(R_RECESS),
            backgroundColor: RECESS,
            outline: `1px solid ${EDGE}`,
            outlineOffset: "-1px",
          }}
        >
          <div
            className="absolute overflow-hidden"
            style={{
              inset: cq(PANE_INSET),
              borderRadius: cq(R_PANE),
              outline: `1px solid ${EDGE}`,
              outlineOffset: "-1px",
            }}
          >
            <View />

            {/* The breather hole in the inner pane, which is the one detail a
                reader who has sat by one will look for. Under the panel in
                document order, since the panel is the layer nearest the cabin. */}
            <span
              aria-hidden="true"
              className="absolute left-1/2 rounded-full bg-black/30"
              style={{
                translate: "-50% 0",
                bottom: cq(2.4),
                width: cq(0.5),
                height: cq(0.5),
              }}
            />

            <span
              aria-hidden="true"
              className="absolute inset-x-0"
              style={{
                top: cq(SHADE_FOOT),
                height: cq(FLARE_H),
                translate: SLIDE,
                backgroundImage: FLARE,
                opacity: "calc(0.3 + var(--shade, 0) * 0.45)",
              }}
            />

            {/* The panel. One `translate` off one property, and the only thing on
                the stage that moves at all. */}
            <div
              className="absolute overflow-hidden"
              style={{
                left: cq(SHADE_GAP),
                top: cq(SHADE_TOP),
                width: cq(SHADE_W),
                height: cq(SHADE_H),
                backgroundColor: SHADE_FACE,
                translate: SLIDE,
                outline: `1px solid ${EDGE}`,
                outlineOffset: "-1px",
              }}
            >
              {/* The grip, drawn rather than toned. A moulded recess needs a
                  shadow at one end of the crossing and a highlight at the other,
                  and the two cancel in the middle. A hairline reads at all
                  three. */}
              <span
                className="absolute inset-x-0 bottom-0"
                style={{ height: cq(HANDLE_H), borderTop: `1px solid ${EDGE}` }}
              >
                <span
                  className="absolute top-1/2 left-1/2 rounded-full"
                  style={{
                    translate: "-50% -50%",
                    width: cq(SHADE_W * 0.28),
                    height: cq(HANDLE_H * 0.34),
                    border: `1px solid ${EDGE}`,
                  }}
                />
              </span>
            </div>

            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-[inherit]"
              style={{ boxShadow: LEAK, opacity: "var(--shade, 0)" }}
            />
          </div>
        </div>
      </div>

      {/*
        The scale.

        It spans the panel's exact travel, so the marker is level with the panel's
        own foot rather than merely near it, and its two ends name the tokens the
        wall is mixed from, which is what `book-opening` prints on its cover for
        the same reason. The ticks are quiet, the marker is the loudest thing on
        the stage after the window, and nothing here answers a pointer: the
        control below does that.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute"
        style={{ left: cq(SCALE_X), top: cq(SCALE_TOP), height: cq(TRAVEL) }}
      >
        <span
          className="absolute inset-y-0 left-0 w-px"
          style={{ backgroundColor: MARK }}
        />

        {TICKS.map((i) => (
          <span
            key={i}
            className="absolute left-0 h-px"
            style={{
              top: cq((i / 10) * TRAVEL),
              // centred on the value it names, rather than hanging below it
              marginTop: "-0.5px",
              width: cq(i % 5 === 0 ? TICK_LONG : TICK),
              backgroundColor: MARK,
            }}
          />
        ))}

        {/* the live position, reaching back toward the panel it is reading */}
        <span
          className="absolute top-0 left-0 h-0.5"
          style={{
            marginTop: "-1px",
            marginLeft: cq(-TICK_LONG),
            width: cq(TICK_LONG),
            translate: RIDE,
            backgroundColor: INK,
          }}
        />

        <span
          className="absolute bottom-full left-0 mb-1.5 font-mono text-meta whitespace-nowrap"
          style={{ color: INK }}
        >
          {WALL_ENDS[0]}
        </span>
        <span
          className="absolute top-full left-0 mt-1.5 font-mono text-meta whitespace-nowrap"
          style={{ color: INK }}
        >
          {WALL_ENDS[1]}
        </span>
      </div>

      {/*
        The control, over the window and nothing else.

        `role="slider"` rather than the reference's `aria-pressed` button, because
        the value here is genuinely continuous: half way down is a state a reader
        can stop at and the whole stage reports it.

        `touch-action: pan-y`, so a thumb scrolling the page through a demo that is
        mostly window is never trapped. **On touch the panel is therefore dragged
        by its grip alone**, which is the one child below that takes the gesture
        back, and tapping anywhere else throws it. That is what a real shade
        offers as well, and it is why the grip is drawn.
      */}
      <div
        ref={slider}
        role="slider"
        tabIndex={0}
        aria-label="Window shade"
        aria-orientation="vertical"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={0}
        aria-valuetext="0% closed"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={abandon}
        onKeyDown={key}
        className="absolute cursor-grab focus-visible:outline-2 focus-visible:outline-offset-2 active:cursor-grabbing"
        style={{
          left: pc(WINDOW_X),
          top: cq(WIN_TOP),
          translate: "-50% 0",
          width: cq(WIN_W),
          height: cq(WIN_H),
          borderRadius: cq(R_BEZEL),
          touchAction: "pan-y",
          // set unconditionally, since there is no outline to colour until
          // `focus-visible` gives it a style. See `MARK` for why the project's
          // own focus pattern cannot serve a ground that moves.
          outlineColor: INK,
        }}
      >
        <span
          aria-hidden="true"
          className="absolute"
          style={{
            left: cq(PANE_OFFSET + SHADE_GAP),
            top: cq(PANE_OFFSET + SHADE_FOOT - HANDLE_H - GRIP_PAD),
            width: cq(SHADE_W),
            height: cq(HANDLE_H + GRIP_PAD * 2),
            translate: SLIDE,
            touchAction: "none",
          }}
        />
      </div>

      {/* The number the whole stage is, written straight to the node. It sits
          below the panel joint, on the lower run of wall, so it reads as a label
          on the cabin rather than as a caption floating on it. Its ink flips
          rather than crossing, for the reason `INK` gives. */}
      <p
        className="pointer-events-none absolute bottom-3 left-4 flex items-center gap-1.5 font-mono text-meta tabular-nums"
        style={{ color: INK }}
      >
        <span>shade</span>
        <span ref={readout}>0.000</span>
      </p>
    </div>
  );
}
