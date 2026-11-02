"use client";

import { animate, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  KNOB as BALL,
  Caption,
  Cycle,
  Empty,
  Frame,
  Meter,
  Pair,
  Pill,
  Ping,
  RAISED,
  Readout,
  WELL,
} from "./frame";

/*
 * Two demos about time: a spring that takes about as long for 8px as for a
 * whole lane, and a lift whose lag lives in its first two frames.
 */

/** the drop spring from event-stacking, tuned for a card crossing a grid */
const TRAVEL = { type: "spring", stiffness: 420, damping: 32 } as const;
/** the spring the same lab hands to every move the drag is not holding */
const SNAPPY = { type: "spring", stiffness: 1400, damping: 75 } as const;

const SHORT = 8;
/** `size-4` on this scale is 12.8px, and `left-1` sets it 3.2px in */
const KNOB = 12.8;
const INSET = 3.2;

type Mode = "one spring" | "by distance";
const MODES = ["one spring", "by distance"] as const;

/** translateY out of a live transform, in px */
function shiftY(el: HTMLElement): number {
  const t = getComputedStyle(el).transform;
  return t === "none" ? 0 : new DOMMatrix(t).m42;
}

export function SpringDemo() {
  const reduce = useReducedMotion();
  const shortKnob = useRef<HTMLDivElement>(null);
  const longKnob = useRef<HTMLDivElement>(null);
  const longLane = useRef<HTMLDivElement>(null);
  const out = useRef(false);
  const [mode, setMode] = useState<Mode>("one spring");
  const [times, setTimes] = useState<[number, number] | null>(null);
  const [busy, setBusy] = useState(false);

  const run = () => {
    const a = shortKnob.current;
    const b = longKnob.current;
    const lane = longLane.current;
    if (!a || !b || !lane || busy) return;

    const far = lane.getBoundingClientRect().width - KNOB - INSET * 2;
    const to = out.current ? 0 : 1;
    out.current = !out.current;

    if (reduce) {
      a.style.transform = `translateX(${to * SHORT}px)`;
      b.style.transform = `translateX(${to * far}px)`;
      setTimes([0, 0]);
      return;
    }

    setBusy(true);
    const start = performance.now();
    const done: [number, number] = [0, 0];
    let left = 2;
    const finish = (i: 0 | 1) => {
      done[i] = Math.round(performance.now() - start);
      left -= 1;
      if (left === 0) {
        setTimes(done);
        setBusy(false);
      }
    };
    animate(a, { x: to * SHORT }, mode === "one spring" ? TRAVEL : SNAPPY).then(
      () => finish(0),
    );
    animate(b, { x: to * far }, TRAVEL).then(() => finish(1));
  };

  /* the result holds a fixed width, or its arrival would shrink a lane after
     its knob had been sent to the old end */
  const Time = ({ ms }: { ms: number | undefined }) => (
    <span className="w-12 shrink-0 text-right font-mono text-meta text-text-primary tabular-nums">
      {ms === undefined ? <Empty /> : `${ms}ms`}
    </span>
  );

  return (
    <Frame
      hint="Press move, then try it by distance."
      after={
        times
          ? mode === "one spring"
            ? "The 8px move still takes about a quarter of a second."
            : "The stiffer spring finishes the 8px move sooner."
          : null
      }
      controls={
        <>
          <Cycle
            value={mode}
            options={MODES}
            onChange={setMode}
            label="springs"
          />
          <Pill lead onClick={run} disabled={busy}>
            move
            <Ping />
          </Pill>
        </>
      }
    >
      <div className="flex flex-col gap-8">
        <div className="flex items-center gap-3">
          <span className="w-8 shrink-0">
            <Caption>8px</Caption>
          </span>
          <div className={cn("relative h-6 w-6 shrink-0 rounded-full", WELL)}>
            <div
              ref={shortKnob}
              className={cn("absolute top-1 left-1 size-4 rounded-full", BALL)}
            />
          </div>
          <span className="flex-1" />
          <Time ms={times?.[0]} />
        </div>
        <div className="flex items-center gap-3">
          <span className="w-8 shrink-0">
            <Caption>lane</Caption>
          </span>
          <div
            ref={longLane}
            className={cn(
              "relative h-6 min-w-0 flex-1 overflow-hidden rounded-full",
              WELL,
            )}
          >
            <div
              ref={longKnob}
              className={cn("absolute top-1 left-1 size-4 rounded-full", BALL)}
            />
          </div>
          <Time ms={times?.[1]} />
        </div>
      </div>
    </Frame>
  );
}

/** how far each card lifts on hover */
const LIFT = 14;
/** two frames at 60Hz */
const TWO_FRAMES = 33;
/** how long the control holds a lift before letting go */
const HOLD = 900;

const LIFT_SPRING = { type: "spring", stiffness: 300, damping: 20 } as const;
const LIFT_TWEEN = { duration: 0.12, ease: [0.16, 1, 0.3, 1] } as const;

function Card({
  curve,
  onLift,
  hold,
}: {
  curve: typeof LIFT_SPRING | typeof LIFT_TWEEN;
  onLift: (early: number) => void;
  hold: number;
}) {
  const reduce = useReducedMotion();
  const card = useRef<HTMLDivElement>(null);

  const lift = () => {
    const el = card.current;
    if (!el) return;
    if (reduce) {
      el.style.transform = `translateY(${-LIFT}px)`;
      return;
    }
    animate(el, { y: -LIFT }, curve);
    setTimeout(() => {
      onLift(Math.round(-shiftY(el) * 10) / 10);
    }, TWO_FRAMES);
  };

  const drop = () => {
    const el = card.current;
    if (!el) return;
    if (reduce) {
      el.style.transform = "";
      return;
    }
    animate(el, { y: 0 }, curve);
  };

  /* the control lifts and holds, for a reader with no hover */
  // biome-ignore lint/correctness/useExhaustiveDependencies: `hold` is a counter, and each tick is one lift
  useEffect(() => {
    if (!hold) return;
    lift();
    const id = setTimeout(drop, HOLD);
    return () => clearTimeout(id);
  }, [hold]);

  return (
    <div className="relative mt-6">
      {/* the place it lifted from, cut into the stage */}
      <div className={cn("absolute inset-0 rounded-lg", WELL)} />
      <div
        ref={card}
        onPointerEnter={(e) => {
          if (e.pointerType !== "touch") lift();
        }}
        onPointerLeave={(e) => {
          if (e.pointerType !== "touch") drop();
        }}
        className={cn("relative h-24 w-40 rounded-lg", RAISED)}
      />
    </div>
  );
}

function Side({
  name,
  curve,
  hold,
  value,
  onLift,
}: {
  name: string;
  curve: typeof LIFT_SPRING | typeof LIFT_TWEEN;
  hold: number;
  value: number | null;
  onLift: (early: number) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-5">
      <Card curve={curve} hold={hold} onLift={onLift} />
      <Meter value={value === null ? null : value / LIFT} />
      <Readout label={name} value={value === null ? <Empty /> : `${value}px`} />
    </div>
  );
}

export function FirstFramesDemo() {
  const [spring, setSpring] = useState<number | null>(null);
  const [tween, setTween] = useState<number | null>(null);
  const [hold, setHold] = useState(0);

  return (
    <Frame
      hint="Lift both cards. The bars show how far each gets in two frames."
      after={
        spring !== null && tween !== null
          ? "Same distance, but the ease-out does its work in the first frames."
          : null
      }
      controls={
        <Pill lead onClick={() => setHold((h) => h + 1)}>
          lift both
          <Ping />
        </Pill>
      }
    >
      <Pair>
        <Side
          name="spring"
          curve={LIFT_SPRING}
          hold={hold}
          value={spring}
          onLift={setSpring}
        />
        <Side
          name="ease-out"
          curve={LIFT_TWEEN}
          hold={hold}
          value={tween}
          onLift={setTween}
        />
      </Pair>
    </Frame>
  );
}
