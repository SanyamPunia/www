"use client";

import { ArrowsLeftRightIcon } from "@phosphor-icons/react";
import {
  animate,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
} from "motion/react";
import type {
  CSSProperties,
  KeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { useEffect, useRef, useState } from "react";
import { TextMorph } from "torph/react";
import { cn } from "@/lib/utils";
import { H, PATTERN_URL, W } from "./pattern";

/*
 * A printed sheet that rolls into a column. Flat, it is a drawing. Press the
 * mode and it curls until its two edges meet behind it, and from there a drag
 * turns the column, it coasts when let go, and it idles on a slow turn.
 *
 * The sheet is seventy-two strips sharing one background image, and the roll
 * is a bend rather than a set of strips each turning on its own. The sheet
 * lies on a cylinder whose radius starts infinite and closes to the column's:
 * at `t` the radius is `R / t`, a strip that sits `x` along the flat sheet is
 * `t * x / R` radians round it, and its place is that radius times the sine
 * and the cosine of that angle. So at every moment of the roll the strips lie
 * edge to edge on one curved surface, and the front face never leaves the
 * plane the flat sheet was in: the axis is what moves, from infinitely far
 * behind the sheet to one radius behind it.
 *
 * One number, `--t`, carries every strip between the two ends, and one more,
 * `--rot`, turns the whole column about that axis: the browser interpolates
 * seventy-two transforms off two custom properties, `book-opening`'s claim
 * about its fourteen sheets. Nothing renders while the sheet rolls or the
 * column turns.
 */

/** how many strips the sheet is cut into, and the radius its width rolls to */
const STRIPS = 72;
const STRIP = W / STRIPS;
const RADIUS = W / (2 * Math.PI);

/** the roll */
const ROLL = { duration: 1.1, ease: [0.65, 0, 0.35, 1] } as const;
/**
 * the drag's coast when it is let go. An inertia leaves at `power / tau` of
 * its velocity, so with the power equal to the time constant in seconds the
 * column leaves the hand at the hand's own speed and slows from there
 */
const COAST = { power: 0.5, timeConstant: 500 } as const;
/** the idle turn, degrees a second, and how long after a hand leaves before it resumes */
const IDLE_SPEED = 14;
const IDLE_AFTER = 1600;
/** one arrow key */
const STEP = 15;
/** how far a strip facing away darkens */
const SHADE = 0.42;

const instant = { duration: 0 } as const;

const strips = Array.from({ length: STRIPS }, (_, i) => ({
  /** its bearing on the finished column, from the strip that faces the viewer */
  theta: (i - (STRIPS - 1) / 2) * (360 / STRIPS),
  /** where its slice of the print starts */
  offset: -i * STRIP,
}));

export default function WrappedPattern() {
  const reduce = useReducedMotion();
  const [wrapped, setWrapped] = useState(false);
  const scene = useRef<HTMLDivElement>(null);
  const t = useMotionValue(0);
  const rot = useMotionValue(0);
  useMotionValueEvent(t, "change", (v) => {
    scene.current?.style.setProperty("--t", String(v));
  });
  useMotionValueEvent(rot, "change", (v) => {
    scene.current?.style.setProperty("--rot", `${v}deg`);
  });

  /* the roll follows the mode */
  useEffect(() => {
    const controls = animate(t, wrapped ? 1 : 0, reduce ? instant : ROLL);
    return () => controls.stop();
  }, [wrapped, reduce, t]);

  /*
   * The idle turn, a linear repeat that a hand interrupts and that comes back
   * once the hand has been gone a while. Held in refs, since it is started and
   * stopped from handlers and never needs a render.
   */
  const spin = useRef<ReturnType<typeof animate> | null>(null);
  const resume = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopSpin = () => {
    spin.current?.stop();
    spin.current = null;
    if (resume.current) clearTimeout(resume.current);
  };
  const startSpin = () => {
    if (reduce) return;
    stopSpin();
    spin.current = animate(rot, rot.get() + 360, {
      duration: 360 / IDLE_SPEED,
      ease: "linear",
      repeat: Number.POSITIVE_INFINITY,
    });
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: startSpin and stopSpin close over refs and are remade every render, so listing them would restart the turn on each one
  useEffect(() => {
    if (wrapped) {
      resume.current = setTimeout(startSpin, ROLL.duration * 1000);
    } else {
      stopSpin();
      animate(rot, 0, reduce ? instant : { duration: 0.6, ease: ROLL.ease });
    }
    return stopSpin;
  }, [wrapped, reduce, rot]);

  /*
   * The drag, on nib's rules: down on the column, move, up, cancel and blur on
   * the window. A pixel of hand is a pixel of the column's surface, so the
   * angle per pixel is one over the radius.
   */
  const grab = useRef<{ id: number; x: number; from: number } | null>(null);
  const degPerPx = 180 / (Math.PI * RADIUS);
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!wrapped || grab.current) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    stopSpin();
    grab.current = { id: event.pointerId, x: event.clientX, from: rot.get() };
    event.currentTarget.setPointerCapture(event.pointerId);
    const finish = (coast: boolean) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("blur", cancel);
      grab.current = null;
      /*
       * Motion's own velocity, which reads zero once the value has been still
       * for a frame or two, so a hand that stopped before letting go throws
       * nothing. The target has to be where the coast will end and not where
       * the column is: an animation whose final keyframe is the value it
       * already holds is skipped before the inertia generator, which ignores
       * the target and works off the velocity, ever gets to run.
       */
      const velocity = rot.getVelocity();
      if (coast && !reduce && Math.abs(velocity) > 20) {
        spin.current = animate(rot, rot.get() + COAST.power * velocity, {
          type: "inertia",
          velocity,
          ...COAST,
          onComplete: () => {
            resume.current = setTimeout(startSpin, IDLE_AFTER);
          },
        });
      } else {
        resume.current = setTimeout(startSpin, IDLE_AFTER);
      }
    };
    const move = (e: PointerEvent) => {
      const g = grab.current;
      if (!g || e.pointerId !== g.id) return;
      if (e.buttons === 0) {
        finish(false);
        return;
      }
      rot.set(g.from + (e.clientX - g.x) * degPerPx);
    };
    const up = (e: PointerEvent) => {
      if (grab.current && e.pointerId === grab.current.id) finish(true);
    };
    const cancel = () => finish(false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("blur", cancel);
  };

  /* the keyboard turns the column in steps, from the mode control's focus */
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!wrapped) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    stopSpin();
    animate(
      rot,
      rot.get() + (event.key === "ArrowRight" ? STEP : -STEP),
      reduce ? instant : { duration: 0.3, ease: ROLL.ease },
    );
    resume.current = setTimeout(startSpin, IDLE_AFTER);
  };

  return (
    <div className="relative flex h-164 w-full select-none flex-col items-center justify-center gap-8 overflow-hidden rounded-lg bg-bg ring-1 ring-stroke ring-inset">
      {/* the scene: one perspective, and the two numbers everything reads */}
      <div
        ref={scene}
        className={cn(
          "relative shrink-0 [perspective:1100px]",
          wrapped && "cursor-grab touch-none active:cursor-grabbing",
        )}
        style={
          {
            width: W,
            height: H,
            "--t": 0,
            // the bend divides by t, and a radius over zero is not a number
            "--tt": "max(var(--t), 0.0001)",
            "--rot": "0deg",
            "--r": `${RADIUS}px`,
          } as CSSProperties
        }
        onPointerDown={onPointerDown}
      >
        {/* the shadow under it: the sheet's width flat, the column's when rolled */}
        <div
          className="pointer-events-none absolute -bottom-3 left-1/2 h-4 -translate-x-1/2 rounded-full bg-black/20 blur-md"
          style={{
            width: `calc(${W}px * (1 - var(--t)) + ${2 * RADIUS + 16}px * var(--t))`,
          }}
        />
        <div
          className="absolute inset-0 transform-3d"
          style={{
            transform: "rotateY(calc(var(--rot) * var(--t)))",
            // the column's axis sits one radius behind the sheet's plane
            transformOrigin: `50% 50% ${-RADIUS}px`,
          }}
        >
          {strips.map((s) => (
            <div
              key={s.theta}
              className="absolute top-0 h-full backface-hidden"
              style={
                {
                  // half a pixel wider than its pitch, or the seams between
                  // strips show as hairlines once they turn
                  width: STRIP + 0.5,
                  left: W / 2 - STRIP / 2,
                  "--theta": `${s.theta}deg`,
                  // its angle round the closing cylinder, then its place on it:
                  // the radius R / t times the sine across and the cosine back
                  "--a": "calc(var(--tt) * var(--theta))",
                  transform:
                    "translateX(calc(var(--r) / var(--tt) * sin(var(--a)))) translateZ(calc(var(--r) / var(--tt) * (cos(var(--a)) - 1))) rotateY(var(--a))",
                  backgroundImage: PATTERN_URL,
                  backgroundSize: `${W}px ${H}px`,
                  backgroundPosition: `${s.offset}px 0`,
                  backgroundRepeat: "no-repeat",
                } as CSSProperties
              }
            >
              {/* the light: a strip darkens by how far it faces from the viewer,
                  which is the cosine of the angle it has turned to, its bearing
                  plus the column's turn, both scaled by the roll */}
              <div
                className="absolute inset-0 bg-black"
                style={{
                  opacity: `calc((1 - cos(var(--tt) * (var(--rot) + var(--theta)))) * ${SHADE / 2})`,
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* the mode: one control whose label is the current state, the site's own */}
      <button
        type="button"
        onClick={() => setWrapped((w) => !w)}
        onKeyDown={onKeyDown}
        aria-label={
          wrapped ? "Lay the sheet flat" : "Roll the sheet into a column"
        }
        className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-full bg-fill px-3 font-mono text-meta text-text-secondary transition-colors duration-200 hover:bg-fill-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2 active:bg-fill-active"
      >
        <ArrowsLeftRightIcon aria-hidden="true" className="size-3.5" />
        <TextMorph duration={200} ease="cubic-bezier(0.4, 0, 0.2, 1)">
          {wrapped ? "wrapped" : "flat"}
        </TextMorph>
      </button>
    </div>
  );
}
