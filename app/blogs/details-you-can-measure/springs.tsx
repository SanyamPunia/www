"use client";

import { animate, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Caption, Cycle, Empty, Frame, Pair, Pill, Readout } from "./frame";

/*
 * Two demos about time: a spring that takes about as long for 8px as for a
 * whole lane, and a lift whose lag lives in its first two frames rather than
 * in its total.
 */

/** the drop spring from event-stacking, tuned for a card crossing a grid */
const TRAVEL = { type: "spring", stiffness: 420, damping: 32 } as const;
/** the spring the same lab hands to every move the drag is not holding */
const SNAPPY = { type: "spring", stiffness: 1400, damping: 75 } as const;

const SHORT = 8;
/** `size-4` on this scale is 12.8px, and `left-1` sets it 3.2px in */
const KNOB = 12.8;
const INSET = 3.2;
/** how long the trace watches, longer than either spring takes */
const WATCH = 700;

type Mode = "same spring" | "by distance";
const MODES = ["same spring", "by distance"] as const;

/** translateX or translateY out of a live transform, in px */
function shift(el: HTMLElement, axis: "x" | "y"): number {
  const t = getComputedStyle(el).transform;
  if (t === "none") return 0;
  const m = new DOMMatrix(t);
  return axis === "x" ? m.m41 : m.m42;
}

interface Sample {
  t: number;
  p: number;
}

/**
 * Both moves on one time axis, as a share of their own distance. On one
 * spring the two curves lie on top of each other, which is the whole point:
 * the 8px knob is still travelling when the lane knob is.
 */
function Curves({ a, b }: { a: Sample[] | null; b: Sample[] | null }) {
  const H = 56;
  const x = (t: number) => `${(t / WATCH) * 100}`;
  const y = (p: number) => H - 2 - p * (H - 4);
  const line = (s: Sample[]) => s.map((v) => `${x(v.t)},${y(v.p)}`).join(" ");
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 100 ${H}`}
      preserveAspectRatio="none"
      className="h-14 w-full text-text-primary"
    >
      <line
        x1={0}
        x2={100}
        y1={y(1)}
        y2={y(1)}
        className="stroke-stroke-strong"
        strokeDasharray="1 2"
        vectorEffect="non-scaling-stroke"
      />
      {b ? (
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
          points={line(b)}
        />
      ) : null}
      {a ? (
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeDasharray="3 3"
          vectorEffect="non-scaling-stroke"
          points={line(a)}
        />
      ) : null}
    </svg>
  );
}

export function SpringDemo() {
  const reduce = useReducedMotion();
  const shortKnob = useRef<HTMLDivElement>(null);
  const longKnob = useRef<HTMLDivElement>(null);
  const longLane = useRef<HTMLDivElement>(null);
  const out = useRef(false);
  const [mode, setMode] = useState<Mode>("same spring");
  const [times, setTimes] = useState<[number, number] | null>(null);
  const [curves, setCurves] = useState<[Sample[], Sample[]] | null>(null);
  const [busy, setBusy] = useState(false);

  const run = () => {
    const a = shortKnob.current;
    const b = longKnob.current;
    const lane = longLane.current;
    if (!a || !b || !lane || busy) return;

    const far = lane.getBoundingClientRect().width - KNOB - INSET * 2;
    const to = out.current ? 0 : 1;
    out.current = !out.current;
    const fromA = shift(a, "x");
    const fromB = shift(b, "x");

    if (reduce) {
      a.style.transform = `translateX(${to * SHORT}px)`;
      b.style.transform = `translateX(${to * far}px)`;
      setTimes([0, 0]);
      setCurves(null);
      return;
    }

    setBusy(true);
    const start = performance.now();
    const done: [number, number] = [0, 0];
    let left = 2;
    const finish = (i: 0 | 1) => {
      done[i] = Math.round(performance.now() - start);
      if (--left === 0) setTimes([done[0], done[1]]);
    };
    animate(
      a,
      { x: to * SHORT },
      mode === "same spring" ? TRAVEL : SNAPPY,
    ).then(() => finish(0));
    animate(b, { x: to * far }, TRAVEL).then(() => finish(1));

    /* trace both knobs as a share of their own distance, per frame */
    const sa: Sample[] = [];
    const sb: Sample[] = [];
    const frame = (now: number) => {
      const t = now - start;
      sa.push({ t, p: Math.abs(shift(a, "x") - fromA) / SHORT });
      sb.push({ t, p: Math.abs(shift(b, "x") - fromB) / far });
      if (t < WATCH) {
        requestAnimationFrame(frame);
      } else {
        setCurves([sa, sb]);
        setBusy(false);
      }
    };
    requestAnimationFrame(frame);
  };

  return (
    <Frame
      label="press move"
      readouts={
        <>
          <Readout label="8px" value={times ? `${times[0]}ms` : <Empty />} />
          <Readout label="lane" value={times ? `${times[1]}ms` : <Empty />} />
        </>
      }
      controls={
        <>
          <Pill onClick={run} disabled={busy}>
            move
          </Pill>
          <Cycle
            value={mode}
            options={MODES}
            onChange={setMode}
            label="springs"
          />
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Caption>8px</Caption>
            <div className="relative h-6 w-6 shrink-0 rounded-full bg-fill">
              <div
                ref={shortKnob}
                className="absolute top-1 left-1 size-4 rounded-full bg-text-primary"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Caption>lane</Caption>
            <div
              ref={longLane}
              className="relative h-6 min-w-0 flex-1 rounded-full bg-fill"
            >
              <div
                ref={longKnob}
                className="absolute top-1 left-1 size-4 rounded-full bg-text-primary"
              />
            </div>
          </div>
        </div>
        {/* the 8px move is the dashed line */}
        <Curves a={curves?.[0] ?? null} b={curves?.[1] ?? null} />
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

/**
 * A card that lifts, and a rail beside it that stamps where the card was on
 * every frame of the lift. A spring's stamps bunch near the start, since it
 * barely moves in its first frames, and spread out at the top. A sharp
 * ease-out's spread out at the start and bunch at the top. The rail is the
 * shape of the lag.
 */
function Card({
  curve,
  onLift,
  hold,
}: {
  curve: typeof LIFT_SPRING | typeof LIFT_TWEEN;
  onLift: (early: number, settled: number) => void;
  hold: number;
}) {
  const reduce = useReducedMotion();
  const card = useRef<HTMLDivElement>(null);
  const rail = useRef<SVGSVGElement>(null);
  const stamps = useRef<number[]>([]);

  const draw = () => {
    const svg = rail.current;
    if (!svg) return;
    svg.replaceChildren();
    for (const y of stamps.current) {
      const line = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line",
      );
      line.setAttribute("x1", "0");
      line.setAttribute("x2", "20");
      line.setAttribute("y1", String(LIFT + y));
      line.setAttribute("y2", String(LIFT + y));
      line.setAttribute("stroke", "currentColor");
      svg.appendChild(line);
    }
  };

  const lift = () => {
    const el = card.current;
    if (!el) return;
    if (reduce) {
      el.style.transform = `translateY(${-LIFT}px)`;
      return;
    }
    const start = performance.now();
    const early = { current: 0 };
    stamps.current = [];
    let running = true;
    const frame = () => {
      if (!running) return;
      stamps.current.push(shift(el, "y"));
      draw();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    animate(el, { y: -LIFT }, curve).then(() => {
      running = false;
      const settled = Math.round(performance.now() - start);
      onLift(early.current, settled);
    });
    setTimeout(() => {
      early.current = Math.round(-shift(el, "y") * 10) / 10;
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
    <div className="flex items-end gap-2 pt-4">
      <div
        ref={card}
        onPointerEnter={(e) => {
          if (e.pointerType !== "touch") lift();
        }}
        onPointerLeave={(e) => {
          if (e.pointerType !== "touch") drop();
        }}
        className="h-16 w-28 rounded-lg bg-fill ring-1 ring-stroke ring-inset"
      />
      <svg
        ref={rail}
        aria-hidden="true"
        width={20}
        height={LIFT + 64}
        className="shrink-0 text-text-primary"
      />
    </div>
  );
}

export function FirstFramesDemo() {
  const [spring, setSpring] = useState<[number, number] | null>(null);
  const [tween, setTween] = useState<[number, number] | null>(null);
  const [hold, setHold] = useState(0);

  return (
    <Frame
      label="hover"
      readouts={
        <>
          {/* fixed widths, since these arrive on hover and a readout that
              reflows the stage moves the card out from under the pointer */}
          <Readout
            label="spring at 33ms"
            className="w-40"
            value={spring ? `${spring[0]}px` : <Empty />}
          />
          <Readout
            label="ease at 33ms"
            className="w-40"
            value={tween ? `${tween[0]}px` : <Empty />}
          />
        </>
      }
      controls={<Pill onClick={() => setHold((h) => h + 1)}>lift both</Pill>}
    >
      <Pair>
        <div className="flex flex-col items-center gap-2">
          <Card
            curve={LIFT_SPRING}
            hold={hold}
            onLift={(early, settled) => setSpring([early, settled])}
          />
          <Caption>spring</Caption>
        </div>
        <div className="flex flex-col items-center gap-2">
          <Card
            curve={LIFT_TWEEN}
            hold={hold}
            onLift={(early, settled) => setTween([early, settled])}
          />
          <Caption>ease-out</Caption>
        </div>
      </Pair>
    </Frame>
  );
}
