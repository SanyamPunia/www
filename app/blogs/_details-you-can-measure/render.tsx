"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTextMorph } from "torph/react";
import { Caption, Empty, Frame, MORPH, Readout } from "./frame";

/*
 * Two knobs that drag the same way and cost a different amount. One puts the
 * pointer through React state, the other writes the transform to the node.
 * Both count how many times React rendered them while the hand was moving.
 */

/** `size-4` on this scale, and its `left-1` inset */
const KNOB = 12.8;
const INSET = 3.2;
/** the render counter morphs every this many renders, not every one */
const EVERY = 5;

/**
 * The drag, on nib's rules. Only `pointerdown` belongs on the knob. Move, up,
 * cancel and blur all go on the window, since a release outside the knob never
 * reaches it and a window that loses focus mid-drag sends no pointer event at
 * all. A move with no button held means a release was missed, so it ends the
 * drag there.
 */
function useDrag(onMove: (x: number) => void, onEnd: () => void) {
  const grab = useRef<{ id: number; offset: number } | null>(null);

  useEffect(() => {
    const end = () => {
      if (!grab.current) return;
      grab.current = null;
      onEnd();
    };
    const move = (e: PointerEvent) => {
      const g = grab.current;
      if (!g || e.pointerId !== g.id) return;
      if (e.buttons === 0) {
        end();
        return;
      }
      onMove(e.clientX - g.offset);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    window.addEventListener("blur", end);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      window.removeEventListener("blur", end);
    };
  }, [onMove, onEnd]);

  /* the grab point is fixed at the grab and never recomputed */
  return (e: React.PointerEvent, from: number) => {
    grab.current = { id: e.pointerId, offset: e.clientX - from };
  };
}

const clamp = (v: number, max: number) => Math.max(0, Math.min(max, v));

const HANDLE =
  "absolute top-1 left-1 size-4 cursor-grab touch-none rounded-full bg-text-primary active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2";

/**
 * A count that arrives in steps. The counter is written from a render effect,
 * which fires per frame during a drag, and a morph per frame is a smear. So it
 * morphs every fifth render and once more when the drag ends.
 */
function useStepCounter() {
  const morph = useTextMorph({ duration: MORPH.duration, ease: MORPH.ease });
  const renders = useRef(0);
  const armed = useRef(false);

  const show = () => morph.update(String(renders.current));
  useEffect(() => {
    renders.current += 1;
    if (armed.current && renders.current % EVERY === 0) show();
  });
  const arm = () => {
    renders.current = 0;
    armed.current = true;
    show();
  };
  return { ref: morph.ref, arm, settle: show };
}

function Lane({
  laneRef,
  fill,
  children,
}: {
  laneRef: React.RefObject<HTMLDivElement | null>;
  fill: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      ref={laneRef}
      className="relative h-6 min-w-0 flex-1 overflow-hidden rounded-full bg-fill"
    >
      {fill}
      {children}
    </div>
  );
}

/** the knob whose position is React state */
function StateKnob() {
  const [x, setX] = useState(0);
  const lane = useRef<HTMLDivElement>(null);
  const max = useRef(0);
  const counter = useStepCounter();

  const onMove = useCallback((nx: number) => setX(clamp(nx, max.current)), []);
  const start = useDrag(onMove, counter.settle);

  const arm = () => {
    max.current =
      (lane.current?.getBoundingClientRect().width ?? 0) - KNOB - INSET * 2;
    counter.arm();
  };

  return (
    <div className="flex items-center gap-3">
      <Caption>state</Caption>
      <Lane
        laneRef={lane}
        fill={
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-stroke-strong"
            style={{ width: x + KNOB / 2 + INSET }}
          />
        }
      >
        <div
          role="slider"
          tabIndex={0}
          aria-label="state knob"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round((x / Math.max(1, max.current)) * 100)}
          onPointerDown={(e) => {
            arm();
            start(e, x);
          }}
          onKeyDown={(e) => {
            if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
            e.preventDefault();
            arm();
            setX((v) =>
              clamp(v + (e.key === "ArrowRight" ? 8 : -8), max.current),
            );
            setTimeout(counter.settle, 0);
          }}
          className={HANDLE}
          style={{ transform: `translateX(${x}px)` }}
        />
      </Lane>
      <Readout
        label="renders"
        value={
          <span ref={counter.ref as React.RefObject<HTMLSpanElement>}>
            <Empty />
          </span>
        }
        className="w-28 shrink-0"
      />
    </div>
  );
}

/** the knob whose position is written to the node */
function RefKnob() {
  const knob = useRef<HTMLDivElement>(null);
  const fill = useRef<HTMLDivElement>(null);
  const lane = useRef<HTMLDivElement>(null);
  const x = useRef(0);
  const max = useRef(0);
  const counter = useStepCounter();

  const place = useCallback((nx: number) => {
    x.current = clamp(nx, max.current);
    const el = knob.current;
    if (!el) return;
    el.style.transform = `translateX(${x.current}px)`;
    el.setAttribute(
      "aria-valuenow",
      String(Math.round((x.current / Math.max(1, max.current)) * 100)),
    );
    if (fill.current) {
      fill.current.style.width = `${x.current + KNOB / 2 + INSET}px`;
    }
  }, []);
  const start = useDrag(place, counter.settle);

  const arm = () => {
    max.current =
      (lane.current?.getBoundingClientRect().width ?? 0) - KNOB - INSET * 2;
    counter.arm();
  };

  return (
    <div className="flex items-center gap-3">
      <Caption>node</Caption>
      <Lane
        laneRef={lane}
        fill={
          <div
            ref={fill}
            className="absolute inset-y-0 left-0 rounded-full bg-stroke-strong"
            style={{ width: KNOB / 2 + INSET }}
          />
        }
      >
        <div
          ref={knob}
          role="slider"
          tabIndex={0}
          aria-label="node knob"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={0}
          onPointerDown={(e) => {
            arm();
            start(e, x.current);
          }}
          onKeyDown={(e) => {
            if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
            e.preventDefault();
            arm();
            place(x.current + (e.key === "ArrowRight" ? 8 : -8));
            counter.settle();
          }}
          className={HANDLE}
        />
      </Lane>
      <Readout
        label="renders"
        value={
          <span ref={counter.ref as React.RefObject<HTMLSpanElement>}>
            <Empty />
          </span>
        }
        className="w-28 shrink-0"
      />
    </div>
  );
}

export function RenderDemo() {
  return (
    <Frame label="drag">
      <div className="flex flex-col gap-6">
        <StateKnob />
        <RefKnob />
      </div>
    </Frame>
  );
}
