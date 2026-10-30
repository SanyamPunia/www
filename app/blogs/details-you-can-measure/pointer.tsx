"use client";

import { useEffect, useRef, useState } from "react";
import { CursorIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import {
  Caption,
  Frame,
  Pair,
  Pill,
  Ping,
  RAISED,
  Readout,
  WELL,
} from "./frame";

/*
 * Two demos about the pointer: a hover that tests a box which moves, and the
 * events a press actually sends.
 */

/** how long the simulated hand stays parked */
const PARK = 3000;

const CARD = cn(
  "relative h-24 w-36 rounded-lg transition-transform duration-150",
  RAISED,
);
const HIT = "outline-1 outline-stroke-strong outline-dashed outline-offset-2";

/**
 * A card that lifts on hover. With `moves` the hit box is the card, so it leaves
 * a pointer parked on its bottom edge. Without it the hit box is a wrapper that
 * stays put. Both are tested against the box's current rect on every pointer
 * move, which is what the browser does for `:hover`.
 *
 * The parked hand has a pixel of jitter, since a real hand is never quite
 * still, and runs the same test.
 */
function HitBox({ moves, parked }: { moves: boolean; parked: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const hand = useRef<HTMLDivElement>(null);
  const count = useRef<HTMLSpanElement>(null);
  const over = useRef(false);

  const set = (inside: boolean) => {
    const el = box.current;
    if (!el) return;
    over.current = inside;
    el.dataset.hover = String(inside);
  };

  const test = (x: number, y: number) => {
    const el = box.current;
    const out = count.current;
    if (!el || !out) return;
    const r = el.getBoundingClientRect();
    const inside = x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    if (inside && !over.current) {
      out.textContent = String(Number(out.textContent) + 1);
    }
    set(inside);
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: the refs are stable, and test and set read them live
  useEffect(() => {
    const el = box.current;
    const h = hand.current;
    if (!parked || !el || !h || !count.current) return;
    count.current.textContent = "0";
    /* the bottom edge at rest, in page coordinates */
    const r = el.getBoundingClientRect();
    const rest = {
      x: r.left + r.width / 2 + window.scrollX,
      y: r.bottom - 3 + window.scrollY,
    };
    const start = performance.now();
    let frame = 0;
    let n = 0;
    const tick = (now: number) => {
      n += 1;
      const jx = n % 2;
      const jy = n % 3 === 0 ? 1 : 0;
      test(rest.x + jx - window.scrollX, rest.y + jy - window.scrollY);
      h.style.transform = `translate(${jx}px, ${jy}px)`;
      if (now - start < PARK) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      set(false);
    };
  }, [parked]);

  return (
    <div className="flex flex-col items-center gap-5 pt-4">
      <div
        className="relative"
        onPointerMove={(e) => {
          if (e.pointerType !== "touch") test(e.clientX, e.clientY);
        }}
        onPointerLeave={() => set(false)}
      >
        {/* the place the card lifts from, cut into the stage */}
        <div className={cn("absolute inset-0 rounded-lg", WELL)} />
        {moves ? (
          <div
            ref={box}
            className={cn(CARD, HIT, "data-[hover=true]:-translate-y-2.5")}
          />
        ) : (
          <div ref={box} className={cn("group rounded-lg", HIT)}>
            <div
              className={cn(CARD, "group-data-[hover=true]:-translate-y-2.5")}
            />
          </div>
        )}
        <div
          ref={hand}
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute top-[calc(100%-0.2rem)] left-1/2 text-text-primary",
            parked ? "opacity-100" : "opacity-0",
          )}
        >
          <CursorIcon className="size-4" />
        </div>
      </div>
      <Caption>{moves ? "hit box moves" : "hit box stays"}</Caption>
      <Readout label="hovers" value={<span ref={count}>0</span>} />
    </div>
  );
}

export function HoverDemo() {
  const [parked, setParked] = useState(false);

  useEffect(() => {
    if (!parked) return;
    const id = setTimeout(() => setParked(false), PARK);
    return () => clearTimeout(id);
  }, [parked]);

  return (
    <Frame
      hint="Park a hand on both bottom edges, or rest your pointer on one."
      after="The moving box keeps losing the hover. The still box holds it."
      controls={
        <Pill lead onClick={() => setParked(true)} disabled={parked}>
          park a hand
          <Ping />
        </Pill>
      }
    >
      <Pair>
        <HitBox moves parked={parked} />
        <HitBox moves={false} parked={parked} />
      </Pair>
    </Frame>
  );
}

interface Entry {
  id: number;
  at: number;
  name: string;
  value: string;
}

/** a new gesture after this long resets the clock */
const BURST = 1500;
const KEEP = 6;

/** what each kind of press sends, shown until the first real one arrives */
const GHOSTS: { who: string; events: string[][] }[] = [
  {
    who: "mouse",
    events: [
      ["pointerdown", "mouse"],
      ["pointerup", "mouse"],
      ["click", "detail 1"],
    ],
  },
  { who: "key", events: [["click", "detail 0"]] },
  {
    who: "touch",
    events: [
      ["pointerdown", "touch"],
      ["pointerup", "touch"],
      ["click", "detail 1"],
    ],
  },
];

/**
 * A button that prints what it hears. At rest the three sequences are shown
 * faintly, and the first real event replaces them.
 */
export function EventsDemo() {
  const [log, setLog] = useState<Entry[]>([]);
  const last = useRef(0);
  const base = useRef(0);
  const id = useRef(0);

  const note = (name: string, value: string) => {
    const now = performance.now();
    if (now - last.current > BURST) base.current = now;
    last.current = now;
    id.current += 1;
    const entry = {
      id: id.current,
      at: Math.round(now - base.current),
      name,
      value,
    };
    setLog((l) => [...l, entry].slice(-KEEP));
  };

  return (
    <Frame
      hint="Click the button, tap it, or tab to it and press Enter."
      after="Each input sends its own sequence. Try another one."
      controls={
        <Pill
          lead
          onPointerDown={(e) => note("pointerdown", e.pointerType)}
          onPointerUp={(e) => note("pointerup", e.pointerType)}
          onPointerCancel={(e) => note("pointercancel", e.pointerType)}
          onClick={(e) => note("click", `detail ${e.detail}`)}
          className="touch-manipulation"
        >
          press me
          <Ping />
        </Pill>
      }
    >
      <ol
        aria-live="polite"
        className={cn(
          "mx-auto flex w-full max-w-96 flex-col divide-y divide-stroke-soft rounded-lg px-5 py-3 font-mono text-meta tabular-nums",
          RAISED,
        )}
        style={{ minHeight: `${KEEP * 1.6 * 12 + KEEP * 6.4}px` }}
      >
        {log.length === 0
          ? GHOSTS.map((g) => (
              <li key={g.who} className="flex gap-4 py-0.75 text-text-muted">
                <span className="w-12 shrink-0">{g.who}</span>
                <span className="flex flex-col">
                  {g.events.map(([name, value]) => (
                    <span key={name + value} className="whitespace-nowrap">
                      {name} {value}
                    </span>
                  ))}
                </span>
              </li>
            ))
          : log.map((e) => (
              <li key={e.id} className="flex gap-4 py-0.75">
                <span className="w-12 shrink-0 text-right text-text-muted">
                  +{e.at}ms
                </span>
                <span className="w-24 shrink-0 text-text-secondary">
                  {e.name}
                </span>
                <span className="text-text-primary">{e.value}</span>
              </li>
            ))}
      </ol>
    </Frame>
  );
}
