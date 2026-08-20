"use client";

import { animate } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { HandGlyph, HORNS_BODY, HORNS_HAND, POINTING_HAND } from "./cursors";
import { anchorOn, contains, type Point, splat, splatHub, strand } from "./web";

/**
 * Press anywhere on the stage and the hand shoots a web at the nearest edge of
 * the button, which goes down when the web lands rather than when the mouse
 * does.
 *
 * The custom cursor is scoped to this stage, so the page's own links keep their
 * real arrow. That is also why the button below carries no `cursor-pointer`:
 * it would hand the system arrow back over the one element you aim at.
 */

/** the hand's box in px. OpenMoji's 72 units map onto this. */
const HAND_SIZE = 34;

/** px per second, so distance sets the flight time and every shot has one speed */
const SPEED = 2200;
const MIN_FLIGHT = 0.09;
const MAX_FLIGHT = 0.26;

/**
 * ms the button stays down at minimum. Past this it stays down for as long as
 * the pointer is, so the press tracks the finger rather than a timer. The floor
 * is for a click quicker than the web's own flight: without it such a press
 * lands and releases within a few frames and never reads as a press at all.
 */
const MIN_PRESS = 140;
/** ms for a press with no pointer to wait on, which means the keyboard */
const KEY_PRESS = 260;
/** ms the web takes to fade once the button releases, spent in CSS */
const FADE = 200;
/**
 * ms the fade waits before it starts. The fall is the point of the release, and
 * gravity is slowest at the start, so an undelayed fade spends its opacity on
 * the part of the drop that has barely moved and is gone by the time the strand
 * is really falling.
 */
const FADE_DELAY = 150;
/** seconds the release takes. Inside `FADE`, so it plays out before it is gone. */
const RELEASE = 0.24;
/** px the free end falls once nothing is holding it up */
const FALL_DROP = 44;
/** px of extra slack at the bottom of that fall, which is the silk going limp */
const FALL_SLACK = 26;

const SPLAT_RADIUS = 10;

/**
 * How far the strand's visible start can slide along the run, in px. Spent in
 * proportion to how far the shot points into the hand, so a shot away from the
 * body still leaves the thumb tip and one into it clears the ink first. See
 * `HORNS_BODY`.
 */
const LAUNCH_INSET = 16;

/** how faint the strand launches, before it darkens over its own run */
const LAUNCH_OPACITY = 0.3;

const reduced = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * `tapped` is a press with no web: the keyboard, or a press on the button itself.
 * It is separate from `stuck` so the hand can stay pointing. The horns are the
 * gesture that shoots, and swapping to them when nothing shoots reads as the
 * cursor changing for no reason.
 */
type Phase = "idle" | "flight" | "stuck" | "tapped";

export default function TetherButton() {
  const stage = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const hand = useRef<HTMLDivElement>(null);
  const web = useRef<SVGGElement>(null);
  const core = useRef<SVGPathElement>(null);
  const left = useRef<SVGPathElement>(null);
  const right = useRef<SVGPathElement>(null);
  const mark = useRef<SVGPathElement>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [hasCursor, setHasCursor] = useState(false);

  /*
   * The running shot. Refs rather than state: a strand mid-flight rewrites path
   * data every frame and none of it belongs in a render.
   */
  const playing = useRef<{ stop: () => void }[]>([]);
  const timers = useRef<number[]>([]);

  const cancel = useCallback(() => {
    for (const control of playing.current) control.stop();
    playing.current = [];
    for (const timer of timers.current) window.clearTimeout(timer);
    timers.current = [];
  }, []);

  useEffect(() => cancel, [cancel]);

  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    setHasCursor(fine.matches);
    const sync = (event: MediaQueryListEvent) => setHasCursor(event.matches);
    fine.addEventListener("change", sync);
    return () => fine.removeEventListener("change", sync);
  }, []);

  /** where a pointer event lands inside the stage */
  const pointIn = (event: React.PointerEvent): Point | null => {
    const box = stage.current?.getBoundingClientRect();
    if (!box) return null;
    return { x: event.clientX - box.x, y: event.clientY - box.y };
  };

  const paint = useCallback(
    (origin: Point, tip: Point, slack: number, opacity: number) => {
      const drawn = strand(origin, tip, slack);
      core.current?.setAttribute("d", drawn.core);
      left.current?.setAttribute("d", drawn.left);
      right.current?.setAttribute("d", drawn.right);
      if (web.current) web.current.style.opacity = String(opacity);
    },
    [],
  );

  /** the pointer's last position inside the stage, which is the strand's tail */
  const pointer = useRef<Point>({ x: 0, y: 0 });
  /**
   * The shot currently on screen, or null. `anchor` is where the web stuck and
   * does not move again: that is what makes the strand a tether rather than a
   * line redrawn to the nearest edge, so it elongates and shrinks as the hand
   * moves instead of sliding around the button.
   */
  const shot = useRef<{
    anchor: Point;
    progress: number;
    /**
     * The run the web was spun to cover, set when it lands and 0 while it is
     * still travelling. Bringing the hand inside this leaves the difference
     * hanging as slack.
     */
    rest: number;
    /** 0 while anything holds the far end up, running to 1 once nothing does */
    fall: number;
  } | null>(null);

  /** whether the pointer that started this press is still down */
  const held = useRef(false);
  /** when the button went down, or 0 while it is up. Doubles as the down flag. */
  const pressedAt = useRef(0);

  /**
   * Draw the shot from wherever the hand is now to wherever it stuck.
   *
   * Everything here is derived per frame rather than fixed at launch, because
   * the hand moves while the web is out. The launch inset is one of them: the
   * heading changes as the hand orbits the anchor, so how far the strand's start
   * slides has to change with it or the thumb gets painted over on the way past.
   */
  const redraw = useCallback(() => {
    const live = shot.current;
    if (!live) return;

    const origin = pointer.current;
    const span = Math.hypot(live.anchor.x - origin.x, live.anchor.y - origin.y);
    if (span < 1) return;

    const heading = {
      x: (live.anchor.x - origin.x) / span,
      y: (live.anchor.y - origin.y) / span,
    };
    const into = Math.max(
      0,
      heading.x * HORNS_BODY.x + heading.y * HORNS_BODY.y,
    );
    // capped against the run as well as the dot product, or a hand pulled right
    // up to the anchor insets past it and the strand inverts
    const inset = Math.min(LAUNCH_INSET * into, span * 0.4);
    const start = {
      x: origin.x + heading.x * inset,
      y: origin.y + heading.y * inset,
    };
    // the strand stops at the rim of the splat's open hub rather than at the
    // anchor itself. Nothing sits there during the flight, so the few px it
    // gives up cost nothing on the way in.
    const rim = {
      x: live.anchor.x - heading.x * splatHub(SPLAT_RADIUS),
      y: live.anchor.y - heading.y * splatHub(SPLAT_RADIUS),
    };

    /*
     * The tip is interpolated toward the rim, then dropped.
     *
     * The drop has to land after the interpolation, not on the rim. Offsetting
     * the rim scales the offset by `progress`, so a strand reeling in would
     * cancel its own fall exactly as gravity was meant to take over.
     */
    const tip = {
      x: start.x + (rim.x - start.x) * live.progress,
      y: start.y + (rim.y - start.y) * live.progress + live.fall * FALL_DROP,
    };

    // whatever the web was spun to cover and no longer has to, plus the silk
    // that goes limp once nothing is pulling on it
    const slack =
      (live.rest > 0 ? Math.max(0, live.rest - span) : 0) +
      live.fall * FALL_SLACK;

    /*
     * The strand darkens as it extends, so a shot leaves the hand faint and
     * reads solid once it is anchored. That ramp belongs to the launch only:
     * `progress` also runs back down on release, which ran the ramp in reverse
     * and dimmed the strand just as it started to fall. Past the landing the
     * layer's own fade owns the disappearance.
     */
    paint(
      start,
      tip,
      slack,
      live.rest > 0 ? 1 : LAUNCH_OPACITY + (1 - LAUNCH_OPACITY) * live.progress,
    );
  }, [paint]);

  const release = useCallback(() => {
    pressedAt.current = 0;
    setPhase("idle");

    const live = shot.current;
    if (!live || reduced()) {
      shot.current = null;
      return;
    }

    /*
     * Letting go does two things at once, which is what makes it read as silk
     * rather than a line being deleted. The strand reels back toward the hand,
     * and the end that was stuck falls, because nothing holds it up any more.
     *
     * One linear clock drives both so they cannot drift apart. The reel is linear
     * on it and the fall is its square, which is constant acceleration, so the
     * drop starts imperceptibly and is still gathering pace when the layer
     * finishes fading. Reeling alone looked like a rewind.
     */
    const from = live.progress;
    playing.current.push(
      animate(0, 1, {
        duration: RELEASE,
        ease: "linear",
        onUpdate: (t) => {
          if (!shot.current) return;
          shot.current.progress = from * (1 - t);
          shot.current.fall = t * t;
          redraw();
        },
        onComplete: () => {
          shot.current = null;
        },
      }),
    );
  }, [redraw]);

  /**
   * Let go, once the press has been on screen long enough to read. Called when
   * the pointer lifts, and by `land` for a pointer that lifted mid-flight.
   */
  const settle = useCallback(() => {
    // nothing is down yet, so the press has not started. `land` calls this again.
    if (pressedAt.current === 0) return;
    const remaining = MIN_PRESS - (performance.now() - pressedAt.current);
    if (remaining <= 0) release();
    else timers.current.push(window.setTimeout(release, remaining));
  }, [release]);

  /*
   * The pointer can lift anywhere, including outside the stage and outside the
   * window, so this listens on the window rather than the stage.
   *
   * `blur` counts as a lift. A window that loses focus mid-press never sends the
   * `pointerup`, and a button stuck down forever is worse than one that lets go
   * early. Pointer capture was the other way to catch a lift outside the stage,
   * and it costs more than it gives: capture suppresses `pointerleave`, so
   * dragging out of the stage would leave the drawn hand on screen next to the
   * real cursor, which reappears the moment the pointer is over anything without
   * `cursor-none`.
   */
  useEffect(() => {
    const lift = () => {
      if (!held.current) return;
      held.current = false;
      settle();
    };
    window.addEventListener("pointerup", lift);
    window.addEventListener("pointercancel", lift);
    window.addEventListener("blur", lift);
    return () => {
      window.removeEventListener("pointerup", lift);
      window.removeEventListener("pointercancel", lift);
      window.removeEventListener("blur", lift);
    };
  }, [settle]);

  const fire = (origin: Point | null) => {
    const stageEl = stage.current;
    const buttonEl = button.current;
    if (!stageEl || !buttonEl) return;

    cancel();
    // the button is up for the length of a flight, and a stale timestamp here
    // would let a lift mid-flight settle against the previous press
    pressedAt.current = 0;

    const stageBox = stageEl.getBoundingClientRect();
    const rect = buttonEl.getBoundingClientRect();
    const box = {
      x: rect.x - stageBox.x,
      y: rect.y - stageBox.y,
      width: rect.width,
      height: rect.height,
    };

    /*
     * Read the radius rather than restating it, so the anchor cannot drift from
     * the corner the button actually paints.
     *
     * `rounded-full` compiles to `calc(infinity * 1px)` in Tailwind v4, and what
     * `getComputedStyle` gives back for that is not something to rely on, so a
     * value that is not a real number falls back to the pill radius. `anchorOn`
     * clamps to half the shorter side either way.
     */
    const parsed = Number.parseFloat(
      getComputedStyle(buttonEl).borderTopLeftRadius,
    );
    const radius = Number.isFinite(parsed)
      ? parsed
      : Math.min(box.width, box.height) / 2;

    if (origin === null || contains(box, radius, origin)) {
      // a keyboard press, or a press on the button itself. There is nowhere to
      // shoot from, so the press is the whole interaction.
      shot.current = null;
      setPhase("tapped");
      pressedAt.current = performance.now();
      // `held` is what separates the two: a pointer press waits for its lift, a
      // keyboard one has no lift coming and is timed
      if (!held.current) {
        timers.current.push(window.setTimeout(release, KEY_PRESS));
      }
      return;
    }

    // blank the last splat before anything paints. A hidden layer keeps the
    // path data it was left with, so without this the previous shot's web
    // flashes at its old anchor for the length of this shot's flight.
    mark.current?.setAttribute("d", "");

    const anchor = anchorOn(box, radius, origin);

    setPhase("flight");

    const span = Math.hypot(anchor.x - origin.x, anchor.y - origin.y);
    shot.current = { anchor, progress: 0, rest: 0, fall: 0 };

    /*
     * `MotionProvider`'s `reducedMotion` governs motion components, not a value
     * animation driving path data by hand, so the setting is read here. Read once
     * per shot: it cannot change mid-flight, and `land` needs the same answer as
     * the branch below it.
     */
    const reduceMotion = reduced();

    const land = () => {
      setPhase("stuck");
      /*
       * The splat's rotation is fixed at impact, not tracked. One spoke lines up
       * with the strand as it lands, and after that the hand can orbit: a web
       * that turned to keep facing the hand would be a web that is not stuck.
       */
      const rotation = Math.atan2(anchor.y - origin.y, anchor.x - origin.x);
      mark.current?.setAttribute("d", splat(anchor, SPLAT_RADIUS, rotation));

      const grow = (scale: number) =>
        mark.current?.setAttribute(
          "transform",
          `translate(${anchor.x} ${anchor.y}) scale(${scale}) translate(${-anchor.x} ${-anchor.y})`,
        );

      if (reduceMotion) grow(1);
      else {
        playing.current.push(
          animate(0.35, 1, {
            duration: 0.2,
            ease: [0.34, 1.56, 0.64, 1],
            onUpdate: grow,
          }),
        );
      }

      /*
       * The rest length is the run at launch, not at landing. That is the silk
       * actually spun, so moving closer during the flight lands a web that is
       * already slack, which is right.
       */
      if (shot.current) shot.current.rest = span;

      pressedAt.current = performance.now();
      // still holding: the lift handler ends this. Already let go during the
      // flight: settle now, which spends the floor and then releases.
      if (!held.current) settle();
    };

    // the web still lands and the button still presses, it just does not travel
    if (reduceMotion) {
      shot.current.progress = 1;
      redraw();
      land();
      return;
    }

    playing.current.push(
      animate(0, 1, {
        duration: Math.min(MAX_FLIGHT, Math.max(MIN_FLIGHT, span / SPEED)),
        ease: "linear",
        onUpdate: (progress) => {
          if (shot.current) shot.current.progress = progress;
          redraw();
        },
        onComplete: land,
      }),
    );
  };

  const track = (event: React.PointerEvent) => {
    const at = pointIn(event);
    if (!at) return;
    pointer.current = at;
    if (hand.current) hand.current.style.translate = `${at.x}px ${at.y}px`;
    /*
     * A shot that is still out follows the hand, so holding the press and moving
     * pays out or reels in the strand against a fixed anchor.
     *
     * Only inside the stage. Dragging out freezes the strand at the last point
     * it had, which is the same trade the hand makes: it hides on leave, since
     * the real cursor is back the moment the pointer is over anything without
     * `cursor-none`, and two cursors is worse than a strand that pauses.
     */
    redraw();
  };

  const reveal = (event: React.PointerEvent) => {
    track(event);
    if (hand.current) hand.current.style.opacity = "1";
  };

  const conceal = () => {
    if (hand.current) hand.current.style.opacity = "0";
  };

  const down = phase === "stuck" || phase === "tapped";
  /** a web is on screen, which is what the horns hand and the web layer follow */
  const shooting = phase === "flight" || phase === "stuck";

  return (
    <div
      ref={stage}
      onPointerDown={(event) => {
        held.current = true;
        // seed the tail before firing. A press can arrive without a move first,
        // and `redraw` reads this rather than the event.
        const at = pointIn(event);
        if (at) pointer.current = at;
        fire(at);
      }}
      onPointerMove={track}
      onPointerEnter={reveal}
      onPointerLeave={conceal}
      className={cn(
        /*
         * Nothing clips. Both ends of a strand are inside the stage by
         * construction and the splat sits on the button, so the hand is the only
         * thing that can reach an edge, and it hangs down and to the right of
         * its hotspot. Clipping it to the frame's radius left a 20px fragment in
         * the bottom right corner, which reads as a glitch. A cursor that
         * carries on past a border reads as a cursor.
         */
        "relative h-80 w-full select-none",
        /*
         * The descendant rule is not belt and braces. `cursor` inherits, but the
         * UA stylesheet sets `cursor: default` on a `button`, which is a real
         * declaration and beats an inherited value, so the system arrow came
         * back over the one element you aim at. Setting it on the whole subtree
         * fixes the button and anything added here later.
         */
        hasCursor && "cursor-none [&_*]:cursor-none",
      )}
    >
      <div className="grid h-full place-items-center">
        <button
          ref={button}
          type="button"
          // the stage already fired on `pointerdown`. This is here for the
          // keyboard, where a click carries no coordinates and `detail` is 0.
          onClick={(event) => {
            if (event.detail === 0) fire(null);
          }}
          className={cn(
            /*
             * The site's own button: a `rounded-full bg-fill` pill, the same
             * shape `InlineLink` uses. It was a white face with a near-black
             * border and a solid black 4px lip, which is the reference's
             * aesthetic and not this one. `shadow-*` appears nowhere else here
             * outside the toaster's third-party override, and nothing on this
             * site depresses.
             */
            "h-11 rounded-full px-8",
            "font-medium text-action text-text-primary",
            /*
             * The press is a background step, which is this codebase's press
             * language. Written as a branch rather than a `data-pressed:`
             * variant because the two states have to beat `hover`, and pressed
             * has to win: the whole point is that the button can be pressed from
             * across the stage, so it is usually pressed and not hovered, but
             * pressing it directly would otherwise read as a hover.
             */
            down ? "bg-fill-active" : "bg-fill hover:bg-fill-hover",
            /*
             * Asymmetric, and it has to be. The step in is instant and only the
             * step back is timed. At 200ms both ways a press shorter than the
             * transition never reaches its own colour, and `MIN_PRESS` is 140ms,
             * so the quickest clicks showed almost no press at all. Same shape as
             * the web layer and as `cursor-origin-button`.
             */
            "transition-colors",
            down ? "duration-0" : "duration-200",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2",
          )}
        >
          tether
        </button>
      </div>

      {/* no viewBox, so one user unit is one stage pixel and the strand needs no
          scale correction. Above the button, because the splat sits on the
          boundary with half of itself over the face. */}
      <svg
        aria-hidden="true"
        focusable="false"
        className="pointer-events-none absolute inset-0 size-full text-text-primary"
      >
        {/*
         * Two groups, because showing the web and darkening it are different
         * jobs. This one is the show, declared off `phase` and timed in CSS. It
         * used to be an `animate()` on opacity, which the next shot's `cancel()`
         * could stop part way and leave a landed web on screen with nothing left
         * to clear it. A transition driven by state cannot strand, since phase
         * always returns to idle.
         *
         * Asymmetric: the web appears the instant a shot starts and only its
         * disappearance is timed, the same shape as `cursor-origin-button`.
         */}
        <g
          className="transition-opacity"
          style={{
            opacity: shooting ? 1 : 0,
            transitionDuration: shooting ? "0ms" : `${FADE}ms`,
            transitionDelay: shooting ? "0ms" : `${FADE_DELAY}ms`,
          }}
        >
          <g
            ref={web}
            fill="none"
            stroke="currentColor"
            strokeWidth={1}
            strokeLinecap="round"
          >
            <path ref={core} />
            <path ref={left} />
            <path ref={right} />
            <path ref={mark} />
          </g>
        </g>
      </svg>

      {/* the wrapper sits at the bare pointer coordinate and the hand hangs off
          its own hotspot, so the drawing lines up on the point that was pressed */}
      {hasCursor && (
        <div
          ref={hand}
          className="pointer-events-none absolute top-0 left-0 text-text-primary"
          style={{ opacity: 0 }}
        >
          <HandGlyph
            hand={shooting ? HORNS_HAND : POINTING_HAND}
            size={HAND_SIZE}
            className="absolute"
          />
        </div>
      )}
    </div>
  );
}
