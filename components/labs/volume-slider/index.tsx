"use client";

import { useReducedMotion } from "motion/react";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";
import {
  box,
  burst,
  CORNER,
  drag,
  HEIGHT,
  REACH,
  STEPS,
  snap,
  stepOf,
  WIDTH,
  wavesOf,
} from "./volume";
import { armVolume, knock, pop, step } from "./volume-sound";

/*
 * The Control Center volume slider. Drag it and the fill follows the hand,
 * pull past either end and the slab stretches and springs back, and every
 * sixteenth is heard at the level it lands on. `volume.ts` is the numbers and
 * `volume-sound.ts` the sound. This file is the slab, the hand and one loop.
 *
 * **Nothing renders while it moves.** The level, the stretch and the press are
 * refs, and the slab's box, the fill, the speaker and the readout are written
 * to the nodes from them.
 */

/** iOS opens on the ninth of sixteen steps */
const START = 9 / STEPS;

/*
 * The stretch springs back with a soft bounce, a 0.6 damping ratio, since
 * letting go of something elastic overshoots. The press grows and shrinks on
 * a plain approach, quicker in than out, and a release eases the fill onto
 * the nearest sixteenth.
 */
const STIFF = 320;
const DAMP = 2 * 0.6 * Math.sqrt(STIFF);
const PRESS_IN = 0.09;
const PRESS_OUT = 0.18;
const SNAP = 0.09;

/*
 * The slab is a soft charcoal rather than the near-black of the inverse set:
 * `inverse-fill` mixed a third of the way toward `text-secondary`. The white
 * fill still reads on it at a glance, and it sits on the light stage as an
 * object rather than a hole.
 */
const SLAB =
  "color-mix(in oklab, var(--color-inverse-fill), var(--color-text-secondary) 32%)";

/** the same end does not doodle again inside this many ms */
const DOODLE_GAP = 420;

/** a key pressed at an end throws the slab this fast past it, in px/s */
const BUMP = 260;

/** how long a turn of the trackpad waits before the slab lets go */
const SETTLE = 140;

export default function VolumeSlider() {
  const slab = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLDivElement>(null);
  const covered = useRef<HTMLDivElement>(null);
  // the doodle at each end, the top's at 0 and the bottom's at 1
  const ends = useRef<(SVGGElement | null)[]>([]);
  const strokes = useRef<(SVGPathElement | null)[][]>([[], []]);
  const doodled = useRef([0, 0]);
  const seed = useRef(1);
  const icons = useRef<(SVGSVGElement | null)[]>([]);
  const stage = useRef<HTMLDivElement>(null);

  const level = useRef(START);
  /** the sixteenth a release is easing the fill onto, or null */
  const aim = useRef<number | null>(null);
  /** the stretch along `side`, and below zero while a release squashes it */
  const over = useRef(0);
  /** the end being stretched, 1 at the top and -1 at the bottom */
  const side = useRef<1 | -1>(1);
  const speed = useRef(0);
  const press = useRef(0);
  const pressed = useRef(false);
  const lastStep = useRef(stepOf(START));
  const frame = useRef(0);
  const clock = useRef(0);
  const grip = useRef<{
    id: number;
    y: number;
    from: number;
    moved: boolean;
  } | null>(null);
  const wheel = useRef({ raw: 0, timer: 0 });
  const armed = useRef(false);
  const reduceValue = useReducedMotion() ?? false;
  const reduce = useRef(reduceValue);
  reduce.current = reduceValue;

  /* -------------------------------------------------------------- drawing */

  const paint = useCallback(() => {
    const s = slab.current;
    if (!s) return;
    const b = box(over.current, side.current, press.current);
    s.style.width = `${b.width}px`;
    s.style.height = `${b.height}px`;
    s.style.transform = `translate(-50%, ${b.top}px)`;
    // each doodle rides its end of the slab as it stretches
    ends.current[0]?.setAttribute(
      "transform",
      `translate(${WIDTH / 2} ${b.top + CORNER})`,
    );
    ends.current[1]?.setAttribute(
      "transform",
      `translate(${WIDTH / 2} ${b.top + b.height - CORNER})`,
    );
    const filled =
      level.current * b.base + (side.current > 0 ? over.current : 0);
    if (fill.current) fill.current.style.height = `${filled}px`;
    if (covered.current)
      covered.current.style.clipPath = `inset(${b.height - filled}px 0 0 0)`;
    const waves = String(wavesOf(level.current));
    for (const icon of icons.current)
      if (icon && icon.dataset.waves !== waves) icon.dataset.waves = waves;
    const pct = Math.round(level.current * 100);
    s.setAttribute("aria-valuenow", String(pct));
    s.setAttribute("aria-valuetext", pct ? `${pct} percent` : "Muted");
  }, []);

  /* --------------------------------------------------------------- motion */

  const loop = useCallback(
    function tick(now: number) {
      frame.current = 0;
      const dt = Math.min(0.032, (now - clock.current) / 1000);
      clock.current = now;
      const target = pressed.current ? 1 : 0;
      press.current +=
        (target - press.current) *
        (1 - Math.exp(-dt / (pressed.current ? PRESS_IN : PRESS_OUT)));
      if (aim.current !== null) {
        level.current +=
          (aim.current - level.current) * (1 - Math.exp(-dt / SNAP));
        if (Math.abs(aim.current - level.current) < 0.0005) {
          level.current = aim.current;
          aim.current = null;
        }
      }
      if (!grip.current && !wheel.current.timer) {
        // the stretch springs home, in two half steps for a stable spring
        for (let k = 0; k < 2; k++) {
          const h = dt / 2;
          speed.current += (-STIFF * over.current - DAMP * speed.current) * h;
          over.current += speed.current * h;
        }
        over.current = Math.max(
          -REACH * 1.4,
          Math.min(REACH * 1.4, over.current),
        );
      }
      paint();
      const resting =
        aim.current === null &&
        Math.abs(press.current - target) < 0.002 &&
        (grip.current ||
          wheel.current.timer ||
          (Math.abs(over.current) < 0.05 && Math.abs(speed.current) < 0.5));
      if (resting) {
        press.current = target;
        if (!grip.current && !wheel.current.timer) {
          over.current = 0;
          speed.current = 0;
        }
        paint();
        return;
      }
      frame.current = requestAnimationFrame(tick);
    },
    [paint],
  );

  const run = useCallback(() => {
    if (reduce.current) {
      press.current = pressed.current ? 1 : 0;
      if (aim.current !== null) {
        level.current = aim.current;
        aim.current = null;
      }
      if (!grip.current && !wheel.current.timer) {
        over.current = 0;
        speed.current = 0;
      }
      paint();
      return;
    }
    if (frame.current) return;
    clock.current = performance.now();
    frame.current = requestAnimationFrame(loop);
  }, [loop, paint]);

  /** a buzz on a phone with a motor, once a press has allowed it */
  const buzz = useCallback((ms: number) => {
    if (armed.current) navigator.vibrate?.(ms);
  }, []);

  /**
   * A doodle at the end the slab was sent to: a fan of short strokes that draw
   * on, flick outward and wipe off, like the marks round something that hit a
   * wall in a sketch. Each is shaped afresh, so no two bursts are the same.
   *
   * The dash is `1 2` and rests at 1.02 and -1.02, past both ends of the path.
   * At `1 1` resting on 1 and -1, a dash ends exactly on an end of the path,
   * and a round cap on a zero-length dash paints a dot, so every finished
   * stroke left one behind. The signature documents the same trap.
   */
  const doodle = useCallback((top: boolean) => {
    if (reduce.current) return;
    const end = top ? 0 : 1;
    const t = performance.now();
    if (t - doodled.current[end] < DOODLE_GAP) return;
    doodled.current[end] = t;
    const b = box(over.current, side.current, press.current);
    const shape = burst(top ? 1 : -1, b.width, b.height, seed.current++);
    strokes.current[end].forEach((path, k) => {
      const s = shape[k];
      if (!path || !s) return;
      path.setAttribute("d", s.d);
      path.animate(
        [
          {
            strokeDashoffset: 1.02,
            transform: "translate(0px, 0px)",
            opacity: 1,
          },
          {
            strokeDashoffset: 0,
            transform: `translate(${s.dx * 0.45}px, ${s.dy * 0.45}px)`,
            opacity: 1,
            offset: 0.4,
          },
          {
            strokeDashoffset: -1.02,
            transform: `translate(${s.dx}px, ${s.dy}px)`,
            opacity: 0.5,
          },
        ],
        {
          duration: 560,
          delay: Math.abs(k - 3) * 18,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        },
      );
    });
  }, []);

  /** an end reached: a knock, a buzz and a doodle at that end */
  const reach = useCallback(
    (top: boolean) => {
      knock();
      buzz(10);
      doodle(top);
    },
    [buzz, doodle],
  );

  /**
   * A new level, and a new stretch when one is given, signed, up being
   * positive: a blip for each sixteenth crossed, heard at the level it lands
   * on, and a knock the moment the slab starts to stretch.
   */
  const set = useCallback(
    (next: number, stretch?: number) => {
      const was = over.current;
      level.current = next;
      if (stretch !== undefined) {
        if (stretch !== 0) side.current = stretch > 0 ? 1 : -1;
        over.current = Math.abs(stretch);
      }
      const s = stepOf(next);
      if (s !== lastStep.current) {
        lastStep.current = s;
        step(next);
        buzz(3);
      }
      if (was <= 0 && over.current > 0) reach(side.current > 0);
      paint();
    },
    [paint, buzz, reach],
  );

  /* ------------------------------------------------------------- the hand */

  const arm = () => {
    armed.current = true;
    armVolume();
  };

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (grip.current || e.button !== 0) return;
    arm();
    e.currentTarget.setPointerCapture(e.pointerId);
    // a hand on a slab still springing back catches it, stretch and all
    // and a fill still easing onto its step is caught where it is
    aim.current = null;
    const from = level.current + (side.current * over.current) / HEIGHT;
    grip.current = { id: e.pointerId, y: e.clientY, from, moved: false };
    speed.current = 0;
    pressed.current = true;
    if (stage.current) stage.current.dataset.carry = "true";
    run();
  };

  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = grip.current;
    if (!g || g.id !== e.pointerId) return;
    const moved = g.y - e.clientY;
    if (Math.abs(moved) > 2) g.moved = true;
    const next = drag(g.from, moved);
    set(next.level, next.over);
  };

  const onUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = grip.current;
    if (!g || g.id !== e.pointerId) return;
    grip.current = null;
    pressed.current = false;
    if (stage.current) stage.current.dataset.carry = "false";
    // the fill comes to rest on the nearest sixteenth, and letting go is heard
    // at that level, the way a Mac does it
    aim.current = snap(level.current);
    pop(aim.current);
    run();
  };

  /* ---------------------------------------------------------- the keyboard */

  const onKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const steps: Record<string, number> = {
      ArrowUp: 1,
      ArrowRight: 1,
      ArrowDown: -1,
      ArrowLeft: -1,
      PageUp: 4,
      PageDown: -4,
      Home: -STEPS,
      End: STEPS,
    };
    const n = steps[e.key];
    if (n === undefined) return;
    e.preventDefault();
    arm();
    const now = stepOf(level.current);
    const next = Math.max(0, Math.min(STEPS, now + n));
    if (next === now) {
      // pushing at an end bumps the slab past it and it springs back
      reach(n > 0);
      if (!reduce.current) {
        side.current = n > 0 ? 1 : -1;
        speed.current += BUMP;
      }
      run();
      return;
    }
    set(next / STEPS);
    run();
  };

  /* ------------------------------------------------------------- the wheel */

  useEffect(() => {
    const s = slab.current;
    if (!s) return;
    const w = wheel.current;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || grip.current) return;
      e.preventDefault();
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      // a mouse notch is one sixteenth, and a trackpad moves the fill by hand
      if (e.deltaMode !== 0 || Math.abs(dy) >= 50) {
        const now = stepOf(level.current);
        const next = Math.max(0, Math.min(STEPS, now - Math.sign(dy)));
        if (next === now) {
          reach(dy < 0);
          if (!reduce.current) {
            side.current = dy < 0 ? 1 : -1;
            speed.current += BUMP * 0.7;
          }
          run();
          return;
        }
        set(next / STEPS);
        pop(next / STEPS);
        return;
      }
      aim.current = null;
      if (!w.timer)
        w.raw = level.current + (side.current * over.current) / HEIGHT;
      w.raw -= dy / HEIGHT;
      const next = drag(w.raw, 0);
      set(next.level, next.over);
      window.clearTimeout(w.timer);
      w.timer = window.setTimeout(() => {
        w.timer = 0;
        aim.current = snap(level.current);
        pop(aim.current);
        run();
      }, SETTLE);
    };
    s.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      s.removeEventListener("wheel", onWheel);
      window.clearTimeout(w.timer);
    };
  }, [run, set, reach]);

  useLayoutEffect(() => {
    paint();
  }, [paint]);

  useEffect(() => {
    const f = frame;
    return () => cancelAnimationFrame(f.current);
  }, []);

  /* --------------------------------------------------------------- render */

  return (
    <div
      ref={stage}
      className="relative flex h-[25rem] w-full select-none items-center justify-center overflow-hidden rounded-lg bg-fill data-[carry=true]:cursor-grabbing data-[carry=true]:[&_*]:cursor-grabbing"
    >
      <div className="relative" style={{ width: WIDTH, height: HEIGHT }}>
        {/* the doodles at the two ends, outside the slab and behind it */}
        <svg
          aria-hidden="true"
          focusable="false"
          width={WIDTH}
          height={HEIGHT}
          className="pointer-events-none absolute inset-0 overflow-visible text-text-secondary"
        >
          {[0, 1].map((end) => (
            <g
              key={end}
              ref={(el) => {
                ends.current[end] = el;
              }}
            >
              {Array.from({ length: 7 }, (_, k) => (
                <path
                  // biome-ignore lint/suspicious/noArrayIndexKey: a stroke is its place in the fan
                  key={k}
                  ref={(el) => {
                    strokes.current[end][k] = el;
                  }}
                  pathLength={1}
                  className="fill-none stroke-current [stroke-dasharray:1_2] [stroke-dashoffset:1.02] [stroke-linecap:round] [stroke-width:2.25]"
                />
              ))}
            </g>
          ))}
        </svg>
        <div
          ref={slab}
          role="slider"
          tabIndex={0}
          aria-label="Volume"
          aria-orientation="vertical"
          aria-valuemin={0}
          aria-valuemax={100}
          // the first value, which `paint` then keeps current on the node
          aria-valuenow={Math.round(START * 100)}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onKeyDown={onKey}
          className="group absolute top-0 left-1/2 cursor-grab touch-none overflow-hidden rounded-[2rem] outline-offset-4 focus-visible:outline-2 focus-visible:outline-text-secondary"
          style={{
            width: WIDTH,
            height: HEIGHT,
            transform: "translate(-50%, 0px)",
            backgroundColor: SLAB,
            boxShadow:
              "0 1px 2px rgba(0,0,0,0.06), 0 8px 18px -8px rgba(0,0,0,0.16), 0 28px 56px -24px rgba(0,0,0,0.26)",
          }}
        >
          {/* the glass: a lit top edge, a sheen, and a lift under a mouse */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-linear-to-b from-white/6 to-transparent to-50%"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-white/0 transition-colors duration-150 group-hover:bg-white/4"
          />
          <div
            ref={fill}
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 bg-inverse-text"
          />
          {/* the speaker twice: light over the glass, dark over the fill */}
          <Speaker
            ref={(el) => {
              icons.current[0] = el;
            }}
            className="text-inverse-text"
          />
          <div
            ref={covered}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
          >
            <Speaker
              ref={(el) => {
                icons.current[1] = el;
              }}
              className="text-text-secondary"
            />
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-white/10 ring-inset"
          />
        </div>
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-lg ring-1 ring-stroke ring-inset"
      />
    </div>
  );
}

/**
 * The speaker, drawn here rather than taken from the icon set, since its waves
 * step in and out with the level and its slash draws on at silence. Each part
 * reads `data-waves` off the svg, so a level change is one attribute.
 */
function Speaker({
  ref,
  className,
}: {
  ref: (el: SVGSVGElement | null) => void;
  className: string;
}) {
  const wave =
    "fill-none stroke-current transition-[opacity,translate] duration-200 ease-out [stroke-linecap:round] [stroke-width:2]";
  return (
    <svg
      ref={ref}
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      data-waves="2"
      className={`group/speaker pointer-events-none absolute bottom-5 left-1/2 size-9 -translate-x-1/2 ${className}`}
    >
      <path
        className="fill-current"
        d="M4.5 9.4h2.7l4.4-3.6c.5-.4 1.2 0 1.2.6v11.2c0 .6-.7 1-1.2.6l-4.4-3.6H4.5c-.6 0-1-.4-1-1v-3.2c0-.6.4-1 1-1z"
      />
      <path
        className={`${wave} opacity-0 group-data-[waves=1]/speaker:opacity-100 group-data-[waves=2]/speaker:opacity-100 group-data-[waves=3]/speaker:opacity-100`}
        d="M15.6 9.7a3.4 3.4 0 0 1 0 4.6"
      />
      <path
        className={`${wave} -translate-x-0.5 opacity-0 group-data-[waves=2]/speaker:translate-x-0 group-data-[waves=2]/speaker:opacity-100 group-data-[waves=3]/speaker:translate-x-0 group-data-[waves=3]/speaker:opacity-100`}
        d="M17.9 7.6a6.6 6.6 0 0 1 0 8.8"
      />
      <path
        className={`${wave} -translate-x-0.5 opacity-0 group-data-[waves=3]/speaker:translate-x-0 group-data-[waves=3]/speaker:opacity-100`}
        d="M20.2 5.5a9.8 9.8 0 0 1 0 13"
      />
      {/* at silence a slash draws across, over a gap in the glass's own tone */}
      <path
        pathLength={1}
        style={{ stroke: SLAB }}
        className="fill-none transition-[stroke-dashoffset] duration-200 ease-out [stroke-dasharray:1] [stroke-dashoffset:1] [stroke-linecap:round] [stroke-width:3.6] group-data-[waves=0]/speaker:[stroke-dashoffset:0]"
        d="M4 4.5l15.5 15.5"
      />
      <path
        pathLength={1}
        className="fill-none stroke-current transition-[stroke-dashoffset] duration-200 ease-out [stroke-dasharray:1] [stroke-dashoffset:1] [stroke-linecap:round] [stroke-width:2] group-data-[waves=0]/speaker:[stroke-dashoffset:0]"
        d="M4 4.5l15.5 15.5"
      />
    </svg>
  );
}
