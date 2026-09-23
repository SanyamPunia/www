"use client";

import { useReducedMotion } from "motion/react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useRef } from "react";
import { approach, clamp01, lerp } from "@/lib/lerp";
import {
  ACORN_H,
  ACORN_W,
  angle,
  CORDS,
  COUNT,
  type Cord,
  cordLength,
  cq,
  LADDERS,
  PITCH,
  pivot,
  RAIL_H,
  SLAT_H,
  TRAVEL,
} from "./blind";

/*
 * A venetian blind over a page, tilted by its two cords. Pull the left cord down
 * and the slats turn open, pull the right one and they shut.
 *
 * Nothing renders while any of it moves. One frame loop writes each slat's angle,
 * each cord's length and swing, and the slider's value straight to the DOM, the
 * bar `book-opening` and `window-shade` set.
 */

/**
 * How quickly the top slat follows the cord, and each slat the one above it.
 *
 * **The tilt runs down the blind rather than landing on every slat at once.** A
 * real tilter turns a drum in the head rail, and the ladder tapes carry that
 * turn down one rung at a time, so a sharp pull reaches the foot of the blind a
 * beat after the top. It is `arc-menu`'s chain turned on its side: each slat
 * follows the one above it through its own exponential. At 16ms a link the foot
 * lags the head by about a quarter of a second on a hard tug and by nothing you
 * can see on a slow pull.
 */
const HEAD_TAU = 0.05;
const LINK_TAU = 0.016;

/** how fast a released cord finishes a tug, and gives back a strain */
const CORD_TAU = 0.11;
const STRAIN_TAU = 0.07;

/**
 * The cord's swing, as a spring on its angle about the rail.
 *
 * Underdamped on purpose, at a ratio of 0.3. A cord with a weight on the end is
 * a pendulum, and a pendulum that stops dead when the hand lets go reads as a
 * drawing of one. At 0.2 it rang for four seconds after every release, which
 * reads as a cord in a draught rather than a cord that was let go.
 */
const SWING_K = 70;
const SWING_C = 5;
const SWING_MAX = 9;
/** the swing a tap leaves behind, in degrees a second */
const TUG_KICK = 38;

/**
 * Pulling past the end of the travel stretches the cord by a third of the
 * overshoot, up to this many cqw, and it springs back on release. A hard stop
 * feels like hitting a wall where resistance says there is nothing further.
 */
const STRAIN_MAX = 1.6;

const EPSILON = 1e-4;
const FIRST_STEP = 1 / 60;
const MAX_STEP = 1 / 15;

/** a press that travels less than this is a tug to the far end, in px */
const SLOP = 4;
const STEP = 0.1;

/**
 * The hit region round each acorn, in cqw. The cords hang 2.8cqw apart, so the
 * two regions meet at the midline between them rather than overlapping, and
 * each is taller than its acorn so a finger does not have to find a 7px pill.
 */
const HIT_W = 2.8;
const HIT_PAD = 2.6;

/**
 * One crown across each slat, lit from above: a bright lip along the top edge,
 * a face falling away, and a dark line where the slat below it tucks under when
 * the blind is shut. White and black at low alpha over the slat's own tone,
 * which is this project's rule for shading a surface.
 */
const CROWN = [
  "linear-gradient(to bottom, rgb(255 255 255 / 0.9) 0, rgb(255 255 255 / 0.9) 1px, rgb(255 255 255 / 0) 1px)",
  "linear-gradient(to bottom, rgb(255 255 255 / 0.55), rgb(0 0 0 / 0.015) 42%, rgb(0 0 0 / 0.08) 94%, rgb(0 0 0 / 0.16) 100%)",
].join(", ");

/** the shadow a tilted slat throws on the page just below it */
const CAST =
  "linear-gradient(to bottom, rgb(0 0 0 / 0.1), rgb(0 0 0 / 0.03) 45%, rgb(0 0 0 / 0) 80%)";

/** a round cord, which is a light core with its edges turning away */
const ROPE =
  "linear-gradient(to right, var(--color-stroke-strong), var(--color-bg) 45%, var(--color-stroke-strong))";

const RAIL =
  "linear-gradient(to bottom, rgb(255 255 255 / 0.7), rgb(255 255 255 / 0) 40%, rgb(0 0 0 / 0.06))";

/**
 * The page's type, sized as a share of the stage like everything else on it.
 * It is 14.4px on the lab column, which is `text-body`, and it shrinks with a
 * phone's stage instead of wrapping into the line below. Off the scale for the
 * reason `foil-card`'s print is: it is part of a drawing, not copy on a surface.
 */
const TYPE = "max(0.625rem, 2.68cqw)";

const SLATS = Array.from({ length: COUNT }, (_, i) => i);
const CORD_KEYS = Object.keys(CORDS) as Cord[];

/** one cord's swing, integrated by hand */
interface Swing {
  angle: number;
  speed: number;
  aim: number;
}

/** one live pull: which cord, where the hand started, and how far it went */
interface Grab {
  id: number;
  cord: Cord;
  x: number;
  y: number;
  from: number;
  moved: number;
  /** one unit of tilt in px for this gesture, off the stage's width */
  span: number;
}

export default function VenetianBlind() {
  const reduced = useReducedMotion();

  const stage = useRef<HTMLDivElement>(null);
  const slider = useRef<HTMLDivElement>(null);
  const slats = useRef<(HTMLDivElement | null)[]>([]);
  const casts = useRef<(HTMLSpanElement | null)[]>([]);
  const ropes = useRef<Record<Cord, HTMLSpanElement | null>>({
    open: null,
    shut: null,
  });
  const hits = useRef<Record<Cord, HTMLSpanElement | null>>({
    open: null,
    shut: null,
  });

  /*
   * All of the animation, in refs. `target` is where the cords have been asked
   * to be, `cord` is where they are, and `tilt` is each slat's own share of that,
   * chained down the blind.
   */
  const target = useRef(0);
  const cord = useRef(0);
  const tilt = useRef<number[]>(SLATS.map(() => 0));
  const strain = useRef<Record<Cord, number>>({ open: 0, shut: 0 });
  const swing = useRef<Record<Cord, Swing>>({
    open: { angle: 0, speed: 0, aim: 0 },
    shut: { angle: 0, speed: 0, aim: 0 },
  });
  const grab = useRef<Grab | null>(null);
  const frame = useRef(0);
  const at = useRef(0);
  const said = useRef(-1);

  const paint = useCallback(() => {
    tilt.current.forEach((t, i) => {
      slats.current[i]?.style.setProperty("--a", angle(i, t).toFixed(3));
      slats.current[i]?.style.setProperty("--t", t.toFixed(4));
      casts.current[i]?.style.setProperty("opacity", t.toFixed(4));
    });

    for (const key of CORD_KEYS) {
      const length = cordLength(key, cord.current) + strain.current[key];
      const rope = ropes.current[key];
      if (rope) {
        rope.style.height = cq(length);
        rope.style.rotate = `${swing.current[key].angle.toFixed(3)}deg`;
      }
      const hit = hits.current[key];
      // the slider's own box starts at the rail, so this is in its coordinates
      if (hit) hit.style.top = cq(length - HIT_PAD);
    }

    // the value the slider reports, written only when it changes, or a drag
    // would rewrite two attributes on every frame for nothing
    const percent = Math.round(cord.current * 100);
    if (percent !== said.current && slider.current) {
      said.current = percent;
      slider.current.setAttribute("aria-valuenow", String(percent));
      slider.current.setAttribute("aria-valuetext", `${percent}% open`);
    }
  }, []);

  /*
   * One frame, named because it hands itself to the next request.
   *
   * Reduced motion takes every gap in one step and never swings. The slats still
   * open, which is the demo, and they just do not travel there, the line
   * `book-opening` draws.
   */
  const tick = useCallback(
    function tick(now: number) {
      const dt =
        at.current === 0
          ? FIRST_STEP
          : Math.min((now - at.current) / 1000, MAX_STEP);
      at.current = now;
      const held = grab.current?.cord ?? null;

      if (held === null) {
        cord.current = lerp(
          cord.current,
          target.current,
          reduced ? 1 : approach(CORD_TAU, dt),
        );
        if (Math.abs(cord.current - target.current) < EPSILON) {
          cord.current = target.current;
        }
      }

      let settled = cord.current === target.current;

      for (const key of CORD_KEYS) {
        if (key !== held) {
          const s = lerp(
            strain.current[key],
            0,
            reduced ? 1 : approach(STRAIN_TAU, dt),
          );
          strain.current[key] = Math.abs(s) < 1e-3 ? 0 : s;
        }
        if (strain.current[key] !== 0) settled = false;

        const s = swing.current[key];
        const aim = key === held ? s.aim : 0;
        if (reduced) {
          s.angle = 0;
          s.speed = 0;
        } else {
          s.speed += (SWING_K * (aim - s.angle) - SWING_C * s.speed) * dt;
          s.angle += s.speed * dt;
          if (Math.abs(s.angle - aim) < 0.01 && Math.abs(s.speed) < 0.05) {
            s.angle = aim;
            s.speed = 0;
          }
        }
        if (s.speed !== 0) settled = false;
      }

      let ahead = cord.current;
      tilt.current = tilt.current.map((t, i) => {
        let next = lerp(
          t,
          ahead,
          reduced ? 1 : approach(i === 0 ? HEAD_TAU : LINK_TAU, dt),
        );
        if (Math.abs(next - ahead) < EPSILON) next = ahead;
        else settled = false;
        ahead = next;
        return next;
      });

      paint();
      frame.current =
        settled && held === null ? 0 : requestAnimationFrame(tick);
    },
    [paint, reduced],
  );

  /**
   * Make sure a frame is coming. The handle is for cancelling and is never a
   * flag saying the loop is alive, the trap `book-opening` documents. The clock
   * only restarts when the loop was idle.
   */
  const wake = useCallback(() => {
    if (!frame.current) at.current = 0;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(tick);
  }, [tick]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  // put back what was written imperatively, after the one render that can
  // happen, which is the reduced-motion setting changing
  useEffect(() => {
    said.current = -1;
    paint();
  });

  const aim = (to: number) => {
    target.current = clamp01(to);
    wake();
  };

  /*
   * ── the pull ────────────────────────────────────────────────────────────────
   *
   * Grab and pull, relative to where the press landed. The cord under the hand
   * is exact, and the slats follow it down their chain. Pulling the open cord
   * down is the same as letting the shut one up, since they are one loop.
   */
  const down = (key: Cord) => (event: ReactPointerEvent<HTMLSpanElement>) => {
    if (event.button !== 0) return;
    const width = stage.current?.getBoundingClientRect().width ?? 0;
    if (!width) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    // the hand leaves the acorn's box on the first few pixels of a pull, so the
    // grabbing cursor is carried by the stage, see its classes
    stage.current?.setAttribute("data-carry", "true");
    target.current = cord.current;
    grab.current = {
      id: event.pointerId,
      cord: key,
      x: event.clientX,
      y: event.clientY,
      from: cord.current,
      moved: 0,
      span: (width * TRAVEL) / 100,
    };
    wake();
  };

  const move = (event: ReactPointerEvent<HTMLSpanElement>) => {
    const held = grab.current;
    if (!held || held.id !== event.pointerId) return;

    const dx = event.clientX - held.x;
    const dy = event.clientY - held.y;
    held.moved = Math.max(held.moved, Math.hypot(dx, dy));

    const sign = held.cord === "open" ? 1 : -1;
    const raw = held.from + (sign * dy) / held.span;
    const to = clamp01(raw);
    target.current = to;
    cord.current = to;

    // only a pull past the end stretches a cord: pushing one up just leaves the
    // acorn hanging where the stop is
    const over = held.cord === "open" ? raw - 1 : -raw;
    strain.current[held.cord] = Math.min(
      Math.max(over, 0) * TRAVEL * 0.33,
      STRAIN_MAX,
    );

    // the hand swings the cord from the rail, about as far as it has gone
    // sideways against the cord's own length
    const length = ((cordLength(held.cord, to) + ACORN_H) * held.span) / TRAVEL;
    const lean = (Math.atan2(-dx, length) * 180) / Math.PI;
    swing.current[held.cord].aim = Math.max(
      -SWING_MAX,
      Math.min(SWING_MAX, lean),
    );
    wake();
  };

  const release = (event: ReactPointerEvent<HTMLSpanElement>, tap: boolean) => {
    const held = grab.current;
    if (!held || held.id !== event.pointerId) return;
    grab.current = null;
    stage.current?.removeAttribute("data-carry");
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    // a press that went nowhere is a tug, all the way to that cord's own end
    if (tap && held.moved < SLOP) {
      target.current = held.cord === "open" ? 1 : 0;
      for (const key of CORD_KEYS) swing.current[key].speed += TUG_KICK;
    }
    wake();
  };

  const key = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const from = target.current;
    const to =
      event.key === "ArrowUp" || event.key === "ArrowRight"
        ? from + STEP
        : event.key === "ArrowDown" || event.key === "ArrowLeft"
          ? from - STEP
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
    aim(to);
  };

  return (
    <div
      ref={stage}
      className="@container relative aspect-8/5 w-full select-none overflow-hidden rounded-lg bg-bg data-carry:cursor-grabbing data-carry:[&_*]:cursor-grabbing"
    >
      {/*
        The page behind the blind. Nothing on it moves: what changes is how much
        of it the slats cover, so every line is uncovered rather than faded in.
        It is laid out loosely on purpose, so no one tilt shows all of it and a
        half-open blind cuts a line through the middle.
      */}
      <div aria-hidden="true" className="absolute inset-0">
        {/* biome-ignore lint/performance/noImgElement: a 200px portrait already on disk, painted into a 54px disc, is not worth an image pipeline */}
        <img
          src="/assets/sanyam.png"
          alt=""
          draggable={false}
          className="absolute select-none rounded-full object-cover ring-1 ring-stroke"
          style={{ left: cq(19), top: cq(11), width: cq(10), height: cq(10) }}
        />
        <p
          className="absolute whitespace-nowrap text-text-primary"
          style={{ left: cq(32), top: cq(12.4), fontSize: TYPE }}
        >
          Sanyam Punia
        </p>
        <p
          className="absolute whitespace-nowrap text-text-secondary"
          style={{ left: cq(32), top: cq(16.8), fontSize: TYPE }}
        >
          Frontend at Oliv AI
        </p>
        <p
          className="absolute whitespace-nowrap text-text-secondary"
          style={{ left: cq(42), top: cq(31), fontSize: TYPE }}
        >
          Writing about the small details
        </p>
        <p
          className="absolute whitespace-nowrap text-text-secondary"
          style={{ left: cq(19), top: cq(44.5), fontSize: TYPE }}
        >
          A lab of interfaces that answer the hand
        </p>

        {/* the back half of each ladder, which only shows through a gap */}
        {LADDERS.map((x) => (
          <span
            key={x}
            className="absolute inset-y-0 w-px bg-stroke-strong"
            style={{ left: `calc(${x}% + ${cq(0.7)})` }}
          />
        ))}

        {SLATS.map((i) => (
          <span
            key={i}
            ref={(node) => {
              casts.current[i] = node;
            }}
            className="absolute inset-x-0 opacity-0"
            style={{
              top: cq(pivot(i)),
              height: cq(PITCH),
              backgroundImage: CAST,
            }}
          />
        ))}
      </div>

      {/*
        The slats, under one perspective and flat to each other. No
        `preserve-3d`, so each is flattened in document order and a lower slat
        always paints over the one above it, which is the right way round: the
        slats turn top toward the room, so each one's top edge is the one in
        front of its neighbour's foot.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ perspective: cq(160) }}
      >
        {SLATS.map((i) => (
          <div
            key={i}
            ref={(node) => {
              slats.current[i] = node;
            }}
            className="absolute inset-x-0 bg-fill-hover/98"
            style={{
              top: cq(pivot(i) - SLAT_H / 2),
              height: cq(SLAT_H),
              transform: "rotateX(calc(var(--a, 0) * 1deg))",
              backgroundImage: CROWN,
            }}
          >
            {/* the face turning down, away from the room's light */}
            <span
              className="absolute inset-0 bg-black"
              style={{ opacity: "calc(var(--t, 0) * 0.12)" }}
            />
            {/* the route holes the ladder and the lift cord run through */}
            {LADDERS.map((x) => (
              <span
                key={x}
                className="absolute top-1/2 -translate-y-1/2 rounded-full bg-black/15"
                style={{
                  left: `calc(${x}% - ${cq(0.1)})`,
                  width: cq(0.5),
                  height: "34%",
                }}
              />
            ))}
          </div>
        ))}
      </div>

      {/* the front half of each ladder, in front of every slat */}
      {LADDERS.map((x) => (
        <span
          key={x}
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 w-px bg-stroke-strong"
          style={{ left: `${x}%` }}
        />
      ))}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 border-stroke-strong border-b bg-fill-hover"
        style={{ height: cq(RAIL_H), backgroundImage: RAIL }}
      />

      {/* The cords. Each turns about the point it leaves the rail, and its acorn
          rides the end of it, so one `rotate` swings the pair. */}
      {CORD_KEYS.map((k) => (
        <span
          key={k}
          ref={(node) => {
            ropes.current[k] = node;
          }}
          aria-hidden="true"
          className="pointer-events-none absolute origin-top"
          style={{
            left: `calc(${CORDS[k]}% - ${cq(0.18)})`,
            top: cq(RAIL_H),
            width: `max(1.5px, ${cq(0.36)})`,
            height: cq(cordLength(k, 0)),
            backgroundImage: ROPE,
          }}
        >
          <span
            className="absolute top-full left-1/2 -translate-x-1/2 rounded-full bg-bg ring-1 ring-stroke-strong"
            style={{
              width: cq(ACORN_W),
              height: cq(ACORN_H),
              backgroundImage:
                "linear-gradient(to right, rgb(0 0 0 / 0.08), rgb(0 0 0 / 0) 45%, rgb(0 0 0 / 0.1))",
            }}
          />
        </span>
      ))}

      {/*
        The control. `role="slider"` because the tilt is continuous and a half-open
        blind is a real place to stop, and it covers the column the cords hang in
        so its focus ring says where to pull. The two acorns inside it are the only
        things on the stage that take a pointer.
      */}
      <div
        ref={slider}
        role="slider"
        tabIndex={0}
        aria-label="Blind tilt"
        aria-orientation="vertical"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={0}
        aria-valuetext="0% open"
        onKeyDown={key}
        className="absolute rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2"
        style={{
          left: `calc(${(CORDS.open + CORDS.shut) / 2}% - ${cq(HIT_W)})`,
          top: cq(RAIL_H),
          width: cq(HIT_W * 2),
          height: cq(46),
        }}
      >
        {CORD_KEYS.map((k) => (
          <span
            key={k}
            ref={(node) => {
              hits.current[k] = node;
            }}
            aria-hidden="true"
            onPointerDown={down(k)}
            onPointerMove={move}
            onPointerUp={(event) => release(event, true)}
            onPointerCancel={(event) => release(event, false)}
            className="absolute cursor-grab touch-none active:cursor-grabbing"
            style={{
              // each region grows outward from the midline, so the two never
              // overlap, and never shrinks under a fingertip's width
              ...(k === "open" ? { right: "50%" } : { left: "50%" }),
              top: cq(cordLength(k, 0) - HIT_PAD),
              width: "max(50%, 1.4rem)",
              height: cq(ACORN_H + HIT_PAD * 2),
            }}
          />
        ))}
      </div>

      {/* the frame's own edge, which the slats would otherwise paint over */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-stroke ring-inset"
      />
    </div>
  );
}
