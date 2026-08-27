"use client";

import {
  type AnimationPlaybackControls,
  animate,
  type MotionValue,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  useVelocity,
} from "motion/react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * One thing that can be knocked out of the avatar and fall.
 *
 * Everything here is per body: its own flight, its own drag, its own magnet home.
 * It is a hook rather than a component because what falls is somebody else's
 * markup, so this owns the physics and the caller owns the paint.
 */

/** the box every body is, 40px exactly */
const SIZE_PX = 40;

/** how far a body keeps off a viewport edge, its own tilt aside */
const EDGE = 12;

/**
 * The magnet, centre to centre, and how much of the remaining gap it eats.
 *
 * **The pull is what makes this magnetic rather than merely snappy.** Inside the
 * radius the body leads the pointer toward its slot, by nothing at the rim and by
 * `PULL` of whatever is left at the middle, so you feel it caught before you let
 * go. Arming the slot happens on the same test, so what lights up and what will
 * catch are the same thing by construction.
 *
 * 72px is a shade under two body widths. At one width the pull starts so close to
 * home that there is nothing left to close.
 */
const MAGNET = 72;
const PULL = 0.42;

/*
 * ── the world it falls in, in pixels, seconds and degrees ────────────────────
 *
 * **The fall is integrated rather than keyframed, and that is what makes a
 * release anywhere on the page fall from there.** A tween has to know its
 * destination and its duration before it starts, so every drop from a different
 * height and every throw with a different velocity would need its own, and a
 * bounce would need its own keyframes on top. Gravity does not need to be told
 * where the floor is: it accelerates, the floor is a test, and the same handful
 * of lines serve the first drop, a lob across the page and a body nudged an inch.
 *
 * `G` is set so a full-height drop takes about the 0.72s the keyframed version
 * did: at 680px, `sqrt(2h/G)` is 0.723.
 */
const G = 2600;

/** what it loses to the air in flight, and to the floor once it is lying on it */
const AIR = 0.55;
const GROUND = 6;

/** how much of a contact comes back: the floor is the soft one on purpose */
const FLOOR_BOUNCE = 0.24;
const WALL_BOUNCE = 0.28;
const CEILING_BOUNCE = 0.3;

/** and what a floor contact costs the slide and the spin */
const SLIDE = 0.72;
const SPIN_KEEP = 0.5;

/**
 * The turn, in degrees per second of the horizontal speed that caused it.
 *
 * A thrown body turns the way it is travelling, and a rolling one keeps turning
 * until the floor takes it off.
 *
 * **The cap is what keeps this subtle, and it was three times this to start
 * with.** At 110 deg/s a hard flick across the page came to rest 120 degrees
 * over, which is a tumbling photo rather than one that fell. At 70 the same throw
 * is nearer 40, and the floor has taken half of it by the second contact.
 */
const SPIN_PER_SPEED = 0.045;
const SPIN_MAX = 70;

/**
 * How a body leans while a hand is carrying it.
 *
 * Rotation off its own horizontal velocity, so it trails the hand the way a held
 * sheet of paper does, and swings back when the hand stops. **The numbers are
 * `event-stacking`'s, unchanged**, because it is the same claim about the same
 * gesture and that lab calibrated them against real drags: 213px/s leans 2.4
 * degrees and 2167px/s leans 9.5, against a 12 degree clamp. A slow reposition
 * should barely register, since the lean says the body is being carried and not
 * that it is held.
 *
 * The spring's own rise time is what holds a short flick short of the clamp,
 * which is why the lean is turned up by lowering `PER_DEGREE` rather than by
 * raising `MAX`. Damping ratio 0.57 puts 11% of overshoot on it, and that wobble
 * as the hand stops is the part that reads as weight.
 *
 * Horizontal only. A carried object swings about the axis it is being moved
 * along, and a vertical drag has nothing to swing.
 */
const LEAN = { MAX: 12, PER_DEGREE: 110 } as const;
const LEAN_SPRING = { stiffness: 500, damping: 18, mass: 0.5 } as const;

/**
 * The most a body will ever lie over, in degrees.
 *
 * A design cap rather than physics, the same call `document-pocket` makes for its
 * bow. Spin is honest about the throw that caused it and honest ends up sideways:
 * a hard flick came to rest 92 degrees over even with the spin rate cut, because
 * it kept turning through the wall bounce and the slide. Past about 40 it reads
 * as tumbling rather than as having fallen askew, so it stops turning there.
 * Reaching the cap takes the spin with it, since something that cannot turn any
 * further is not turning.
 */
const TILT_MAX = 42;

/** below these it has stopped falling, and then stopped sliding */
const REST_FALL = 28;
const REST_SLIDE = 16;

/**
 * The ceiling on a throw.
 *
 * It was 3200 and a flick reached it easily, which put the body into the far wall
 * and, at `WALL_BOUNCE`, most of the way back across the page. A hand does not
 * throw a 40px photo at three metres a second.
 */
const MAX_SPEED = 2000;

/** the most any one frame is worth, the same guard `book-opening` sets */
const MAX_STEP = 1 / 15;

/**
 * A shake in place, for a body still in its slot.
 *
 * A tween, because its shape is its keyframes rather than any physics. How hard
 * it shakes is the caller's, since only the caller knows what provoked it.
 */
const WOBBLE = { duration: 0.4, ease: "easeInOut" } as const;

/**
 * The snap home, at a 0.58 damping ratio.
 *
 * 11% of overshoot, which is what a magnet catching something looks like. It is
 * the one curve here that is a spring: the fall is gravity and the wobble the
 * caller owns is a tween, because its shape is its keyframes rather than physics.
 */
const SNAP = { type: "spring", stiffness: 500, damping: 26 } as const;

export const clamp = (value: number, low: number, high: number) =>
  Math.min(Math.max(value, low), high);

/**
 * How far a tilt puts a body outside its own box, per side.
 *
 * A rotated square covers more ground than a square: at 16 degrees a 40px box
 * spans 49.5, all of it grown about the centre. Everything that keeps a body on
 * screen is written in the untilted box's own offsets, so without this the margin
 * they think they are keeping is short at every edge and it sits nearer the glass
 * than `EDGE` says. Read off the live angle rather than a constant, since the
 * spin means the tilt is whatever it currently is.
 */
const overhang = (deg: number) => {
  const rad = (deg * Math.PI) / 180;
  return (
    (SIZE_PX * (Math.abs(Math.cos(rad)) + Math.abs(Math.sin(rad))) - SIZE_PX) /
    2
  );
};

/**
 * No selection ever starts on a body, in either state.
 *
 * `select-none` stops the body's own box being selected and does not stop a press
 * on it from anchoring a selection that then runs into the prose below, which
 * puts a highlight and a pair of `SelectionPins` carets on the page for a gesture
 * that was aimed at a picture. Preventing the pointerdown is what stops it, since
 * the selection is the mousedown's default action.
 *
 * **Touch is exempt.** A finger's press is also the start of a page scroll, and
 * `select-none` already covers the long press that would select there.
 */
export const deny = (event: PointerEvent) => {
  if (event.pointerType !== "touch") event.preventDefault();
};

interface FallingOptions {
  /** the element whose box the body belongs in */
  slot: React.RefObject<HTMLElement | null>;
  /**
   * Where inside that box, as a live ref rather than a value.
   *
   * The photo is the slot. Whatever is stacked behind it sits at its own offset,
   * captured when it drops, and read from a ref because the thing it was measured
   * off is hidden by then and would measure zero.
   */
  offset?: React.RefObject<{ x: number; y: number }>;
  /** the shared placeholder, lit while a body is near enough to be caught */
  mark: React.RefObject<HTMLElement | null>;
  /** the nudge it leaves the slot with, sideways and turning */
  speed: number;
  spin: number;
  /**
   * How long it hangs where it is before gravity gets it, in ms.
   *
   * **The wait is on the fall, not on leaving the slot.** A body that leaves late
   * is a body whose slot is still painting it, so the slot has to hold a place
   * for something that is about to be somewhere else. Leaving at once and falling
   * a beat later is the same beat with nothing to keep in sync.
   */
  delay?: number;
}

export interface Falling {
  /** out of the slot, so the caller paints it loose and portals it */
  out: boolean;
  /** where its slot is, in page coordinates */
  dock: { left: number; top: number };
  /** goes on whatever paints it, and is what the listeners bind to */
  body: React.RefObject<HTMLDivElement | null>;
  x: MotionValue<number>;
  y: MotionValue<number>;
  /** where it has come to rest plus the sway, which is what it paints */
  angle: MotionValue<number>;
  /** knock it out of the slot */
  drop: () => void;
  /** and put it back */
  home: () => void;
  /** shake it where it stands, by this many degrees */
  wobble: (swing: number) => void;
  /** read its slot again, for a caller that has just moved where home is */
  remeasure: () => void;
}

export function useFalling({
  slot,
  offset,
  mark,
  speed,
  spin,
  delay,
}: FallingOptions): Falling {
  const [out, setOut] = useState(false);
  const [dock, setDock] = useState({ left: 0, top: 0 });

  const body = useRef<HTMLDivElement>(null);

  /*
   * The gesture and the flight, in refs. Nothing here belongs in a render: the
   * drag and the fall both write three motion values and one data attribute
   * straight to the DOM, so a throw across the page and every bounce after it
   * cost zero renders.
   */
  const dockAt = useRef({ left: 0, top: 0 });
  const grab = useRef<{ px: number; py: number; x: number; y: number } | null>(
    null,
  );
  const running = useRef<AnimationPlaybackControls[]>([]);

  /**
   * The flight: velocity in px/s, spin in deg/s, the loop's own clock, and
   * whether this one may be caught.
   *
   * **The drop out of the slot is sealed and a throw is not.** The pointer that
   * dropped it is sitting exactly where it launches from, so a flurry that has
   * not stopped yet catches it within a frame or two of letting go and the fall
   * never happens: it appears to stick to the cursor instead of leaving. A throw
   * has no such problem, since the hand that threw it has to go back for it, so
   * catching one in mid-air stays.
   */
  const flight = useRef({
    vx: 0,
    vy: 0,
    spin: 0,
    frame: 0,
    at: 0,
    sealed: false,
  });

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const turn = useMotionValue(0);

  /*
   * Read here rather than left to `MotionProvider`, which governs motion
   * components and never a value animation driven by hand. Same reason
   * `tether-button` reads it.
   */
  const reduced = useReducedMotion();

  /**
   * How fast it is going, and whether a hand has it.
   *
   * **Motion's own velocity rather than one measured off the pointer**, and it
   * serves both the lean and the throw. Two things come free with it. It is
   * measured off where the body actually went, so the magnet's pull is in it and
   * a body let go on the way in is already travelling toward its slot. And it
   * decays on its own: `getVelocity` returns 0 once the value has not changed for
   * 30ms, which is what stops a hand that held position and let go from throwing
   * anything, where a velocity kept by hand freezes at whatever it last was.
   *
   * `grip` gates the lean rather than the lean reading a flag, since `x` keeps
   * moving after the release: it is what the fall is written to. Zeroing the grip
   * at the release lets the spring level the body out while it flies, which is
   * what putting something down looks like. Set in the gesture handlers, since
   * they already know both moments and neither needs a render.
   */
  const carryX = useVelocity(x);
  const carryY = useVelocity(y);
  const grip = useMotionValue(0);
  const lean = useSpring(
    useTransform([carryX, grip], ([pace, held]: number[]) =>
      held === 0 ? 0 : clamp(pace / LEAN.PER_DEGREE, -LEAN.MAX, LEAN.MAX),
    ),
    LEAN_SPRING,
  );

  /**
   * What it actually paints: where it has come to rest, plus the sway.
   *
   * Two values rather than one, because they answer to different things. `turn`
   * is the angle it fell to, written by the loop and unwound by the snap. `lean`
   * is a spring on the hand's speed and belongs to nobody once the hand is gone.
   */
  const angle = useTransform(() => turn.get() + lean.get());

  /**
   * Where it belongs, in page coordinates.
   *
   * **A body already out keeps the place it is in.** Its offsets are measured
   * from a dock that just moved, so they are corrected by however far it moved.
   * Without that the cover jumps 12px every time the photo comes home and takes
   * the front of the stack back, and a loose body jumps whenever the column
   * reflows under it.
   */
  const measure = useCallback(() => {
    const rect = slot.current?.getBoundingClientRect();
    if (!rect) return;
    const from = offset?.current ?? { x: 0, y: 0 };
    const at = {
      left: rect.left + window.scrollX + from.x,
      top: rect.top + window.scrollY + from.y,
    };
    const was = dockAt.current;
    dockAt.current = at;
    setDock(at);

    if (!out) return;
    x.set(x.get() + (was.left - at.left));
    y.set(y.get() + (was.top - at.top));
  }, [offset, out, slot, x, y]);

  /**
   * The room it has, in the offsets it is written in.
   *
   * **`maxY` is the floor as well as the drag's lower bound**, which is why there
   * is one function rather than two numbers that have to agree: a body dragged to
   * the bottom of the screen is already resting on the same line gravity would
   * have taken it to.
   */
  const bounds = useCallback(() => {
    const { left, top } = dockAt.current;
    const keep = EDGE + overhang(angle.get());
    return {
      minX: window.scrollX + keep - left,
      maxX: window.scrollX + window.innerWidth - keep - SIZE_PX - left,
      minY: window.scrollY + keep - top,
      maxY: window.scrollY + window.innerHeight - keep - SIZE_PX - top,
    };
  }, [angle]);

  /**
   * One frame of the fall. Named, because it hands itself to the next
   * `requestAnimationFrame`.
   *
   * Gravity, then air, then the walls, then the floor. A contact fast enough to
   * matter comes back at `FLOOR_BOUNCE` and pays `SLIDE` and `SPIN_KEEP` for it,
   * and one too slow to matter is the body lying down: from there it only loses
   * its slide, and once that is gone the loop stops asking for frames at all.
   */
  const tick = useCallback(
    function tick(now: number) {
      const f = flight.current;
      const dt = f.at === 0 ? 1 / 60 : Math.min((now - f.at) / 1000, MAX_STEP);
      f.at = now;

      const { minX, maxX, minY, maxY } = bounds();

      f.vy += G * dt;
      f.vx *= Math.exp(-AIR * dt);

      let nx = x.get() + f.vx * dt;
      let ny = y.get() + f.vy * dt;

      if (nx < minX) {
        nx = minX;
        f.vx = -f.vx * WALL_BOUNCE;
      } else if (nx > maxX) {
        nx = maxX;
        f.vx = -f.vx * WALL_BOUNCE;
      }

      if (ny < minY) {
        ny = minY;
        f.vy = -f.vy * CEILING_BOUNCE;
      }

      let lying = false;
      if (ny >= maxY) {
        ny = maxY;
        if (f.vy > REST_FALL) {
          f.vy = -f.vy * FLOOR_BOUNCE;
          f.vx *= SLIDE;
          f.spin *= SPIN_KEEP;
        } else {
          f.vy = 0;
          f.vx *= Math.exp(-GROUND * dt);
          f.spin *= Math.exp(-GROUND * dt);
          lying = true;
        }
      }

      const spun = turn.get() + f.spin * dt;
      if (spun < -TILT_MAX || spun > TILT_MAX) f.spin = 0;

      x.set(nx);
      y.set(ny);
      turn.set(clamp(spun, -TILT_MAX, TILT_MAX));

      if (lying && Math.abs(f.vx) < REST_SLIDE) {
        f.vx = 0;
        f.spin = 0;
        f.frame = 0;
        // it has landed and stopped sliding, so it is fair game again
        f.sealed = false;
        return;
      }
      f.frame = requestAnimationFrame(tick);
    },
    [bounds, turn, x, y],
  );

  /**
   * Hand it to gravity, with whatever speed put it there.
   *
   * Cancel and reschedule rather than bailing out when a frame is already
   * pending, and only restart the clock when the loop was idle: the handle is for
   * cancelling and is never a flag saying the loop is alive, which is the trap
   * `book-opening` documents.
   */
  const launch = useCallback(
    (vx: number, vy: number, turning?: number, seal = false) => {
      const f = flight.current;
      f.vx = clamp(vx, -MAX_SPEED, MAX_SPEED);
      f.vy = clamp(vy, -MAX_SPEED, MAX_SPEED);
      f.spin = clamp(turning ?? f.vx * SPIN_PER_SPEED, -SPIN_MAX, SPIN_MAX);

      if (reduced) {
        // the destination without the travel, the line `book-opening` draws
        y.set(Math.max(y.get(), bounds().maxY));
        f.sealed = false;
        return;
      }

      f.sealed = seal;
      if (!f.frame) f.at = 0;
      cancelAnimationFrame(f.frame);
      f.frame = requestAnimationFrame(tick);
    },
    [bounds, reduced, tick, y],
  );

  /**
   * Stop whatever is driving the values.
   *
   * A fall and a snap both write every frame, so a pointer that grabs the body
   * mid-flight would be fighting one. Stopping rather than letting it finish is
   * what makes catching it in mid-air work, and it is why the snap's `onComplete`
   * cannot fire after an interrupted return.
   */
  const halt = useCallback(() => {
    const f = flight.current;
    cancelAnimationFrame(f.frame);
    f.frame = 0;
    f.vx = 0;
    f.vy = 0;
    f.spin = 0;
    // a cancelled flight never reaches the rest test that would clear this
    f.sealed = false;
    for (const animation of running.current) animation.stop();
    running.current = [];
  }, []);

  const arm = useCallback(
    (on: boolean) => {
      const node = mark.current;
      if (!node) return;
      if (on) node.dataset.armed = "true";
      else delete node.dataset.armed;
    },
    [mark],
  );

  /** back into the slot, and only then back into the layout */
  const home = useCallback(() => {
    halt();
    arm(false);
    grip.set(0);

    /*
     * Wound back to the same angle inside one turn first. The spin accumulates
     * across throws, so a body that has rolled twice would otherwise unwind two
     * full revolutions on its way into the slot. The jump is invisible, since
     * what it lands on is the angle it is already painting.
     */
    turn.set(((((turn.get() + 180) % 360) + 360) % 360) - 180);

    if (reduced) {
      x.set(0);
      y.set(0);
      turn.set(0);
      setOut(false);
      return;
    }

    running.current = [
      animate(y, 0, SNAP),
      animate(turn, 0, SNAP),
      animate(x, 0, { ...SNAP, onComplete: () => setOut(false) }),
    ];
  }, [arm, grip, halt, reduced, turn, x, y]);

  const wobble = useCallback(
    (swing: number) => {
      if (reduced) return;
      halt();
      running.current = [
        animate(turn, [0, -swing, swing * 0.7, -swing * 0.35, 0], WOBBLE),
      ];
    },
    [halt, reduced, turn],
  );

  const drop = useCallback(() => {
    // measured before the flip, off the slot, which does not move
    measure();
    setOut(true);
  }, [measure]);

  /* out of the slot, with a nudge sideways and a turn, and gravity takes it */
  useEffect(() => {
    if (!out) return;
    if (!delay) {
      launch(speed, 0, spin, true);
      return;
    }
    const timer = window.setTimeout(() => launch(speed, 0, spin, true), delay);
    return () => window.clearTimeout(timer);
    // the drop is the trigger. `dock` moving on a resize must not refire it.
  }, [delay, launch, out, speed, spin]);

  /*
   * The drag, while it is out.
   *
   * Hand-rolled rather than Motion's `drag`, which `spring-image` uses for the
   * same gesture, and the magnet is the whole reason: `drag` writes the pointer's
   * own offset and there is no seam in it to bias, where this blends the raw
   * offset toward the slot before it is written.
   *
   * On the window rather than the node, since a pointer can leave the body mid
   * drag and a lift outside it still has to end the gesture. Pointer capture is
   * what keeps the moves coming while it is out there.
   */
  useEffect(() => {
    if (!out) return;
    const node = body.current;
    if (!node) return;

    const down = (event: PointerEvent) => {
      deny(event);
      // still on its way out of the slot, so it is not there to be picked up
      if (flight.current.sealed) return;
      halt();
      node.setPointerCapture(event.pointerId);
      node.dataset.held = "true";
      grab.current = {
        px: event.clientX,
        py: event.clientY,
        x: x.get(),
        y: y.get(),
      };
      grip.set(reduced ? 0 : 1);
    };

    const move = (event: PointerEvent) => {
      const from = grab.current;
      if (!from) return;

      const { minX, maxX, minY, maxY } = bounds();
      const raw = {
        x: clamp(from.x + (event.clientX - from.px), minX, maxX),
        y: clamp(from.y + (event.clientY - from.py), minY, maxY),
      };
      const gap = Math.hypot(raw.x, raw.y);
      const near = gap < MAGNET;
      const pull = near ? PULL * (1 - gap / MAGNET) : 0;

      x.set(raw.x * (1 - pull));
      y.set(raw.y * (1 - pull));
      arm(near);
    };

    const up = () => {
      if (!grab.current) return;
      grab.current = null;
      delete node.dataset.held;

      /* the lean levels out on the way down, wherever it is going */
      const carry = { x: carryX.get(), y: carryY.get() };
      grip.set(0);

      if (Math.hypot(x.get(), y.get()) < MAGNET) {
        home();
        return;
      }

      // let go anywhere else and it falls from there, carrying the throw
      arm(false);
      launch(carry.x, carry.y);
    };

    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") home();
    };

    /* the slot moves when the column reflows, and the body's whole position is
       expressed against it, so it is put back inside its own room with it */
    const resize = () => {
      measure();
      const { minX, maxX, minY, maxY } = bounds();
      x.set(clamp(x.get(), minX, maxX));
      y.set(clamp(y.get(), minY, maxY));
    };

    node.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("keydown", key);
    window.addEventListener("resize", resize);

    return () => {
      node.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("keydown", key);
      window.removeEventListener("resize", resize);
    };
  }, [
    arm,
    bounds,
    carryX,
    carryY,
    grip,
    halt,
    home,
    launch,
    measure,
    out,
    reduced,
    x,
    y,
  ]);

  useEffect(() => () => cancelAnimationFrame(flight.current.frame), []);

  return {
    out,
    dock,
    body,
    x,
    y,
    angle,
    drop,
    home,
    wobble,
    remeasure: measure,
  };
}
