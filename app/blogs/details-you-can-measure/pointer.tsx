"use client";

import { CursorIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Caption, Frame, Pill, Readout } from "./frame";

/*
 * Two demos about the pointer: a hover that tests a box which moves, and the
 * events a press actually sends.
 */

/** how long the simulated hand stays parked */
const PARK = 3000;

/**
 * Two rows of cards that lift on hover. In the first row the hit box is the
 * card itself, so it moves away from a pointer parked on its bottom edge. In
 * the second the hit box is a wrapper that never moves. Both rows are hit
 * tested the same way, on every pointer move, against the box's current rect,
 * which is exactly what the browser does for `:hover`.
 *
 * The control parks a drawn hand on each first card's bottom edge with a pixel
 * of jitter, since a real hand is never quite still, and runs the same test.
 */
export function HoverDemo() {
  const rows = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];
  const counts = [useRef<HTMLSpanElement>(null), useRef<HTMLSpanElement>(null)];
  const hand = useRef<HTMLDivElement>(null);
  const [parked, setParked] = useState(false);

  /** run the hit test for one row at a viewport point */
  const test = (row: 0 | 1, x: number, y: number) => {
    const root = rows[row].current;
    const out = counts[row].current;
    if (!root || !out) return;
    for (const box of root.querySelectorAll<HTMLElement>("[data-hit]")) {
      const r = box.getBoundingClientRect();
      const inside = x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
      const was = box.dataset.hover === "true";
      if (inside && !was) {
        out.textContent = String(Number(out.textContent) + 1);
      }
      box.dataset.hover = inside ? "true" : "false";
    }
  };

  const clear = (row: 0 | 1) => {
    const root = rows[row].current;
    if (!root) return;
    for (const box of root.querySelectorAll<HTMLElement>("[data-hit]")) {
      box.dataset.hover = "false";
    }
  };

  /* the simulated hand */
  // biome-ignore lint/correctness/useExhaustiveDependencies: the refs are stable, and the test and clear read them live
  useEffect(() => {
    if (!parked) return;
    const h = hand.current;
    const firsts = rows.map(
      (r) => r.current?.querySelector<HTMLElement>("[data-hit]") ?? null,
    );
    if (!h || !firsts[0] || !firsts[1]) return;
    /* park on the bottom edge of the box at rest, in page coordinates */
    const rest = firsts.map((el) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      return {
        x: r.left + r.width / 2 + window.scrollX,
        y: r.bottom - 3 + window.scrollY,
      };
    });
    const start = performance.now();
    let frame = 0;
    let n = 0;
    const tick = (now: number) => {
      n += 1;
      const jx = n % 2;
      const jy = n % 3 === 0 ? 1 : 0;
      for (const row of [0, 1] as const) {
        const p = rest[row];
        test(row, p.x + jx - window.scrollX, p.y + jy - window.scrollY);
      }
      /* the hand is drawn on the first row's point */
      h.style.transform = `translate(${rest[0].x + jx}px, ${rest[0].y + jy}px)`;
      if (now - start < PARK) frame = requestAnimationFrame(tick);
      else setParked(false);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      clear(0);
      clear(1);
    };
  }, [parked]);

  const move = (row: 0 | 1) => (e: React.PointerEvent) => {
    if (e.pointerType === "touch") return;
    test(row, e.clientX, e.clientY);
  };

  const CARD =
    "h-16 w-20 rounded-lg bg-fill ring-1 ring-stroke ring-inset transition-transform duration-150";

  return (
    <Frame
      label="park on a bottom edge"
      readouts={
        <>
          <Readout
            label="moving box"
            className="w-28"
            value={<span ref={counts[0]}>0</span>}
          />
          <Readout
            label="still box"
            className="w-28"
            value={<span ref={counts[1]}>0</span>}
          />
        </>
      }
      controls={
        <Pill onClick={() => setParked(true)} disabled={parked}>
          park a hand
        </Pill>
      }
    >
      <div className="flex flex-col gap-6">
        {/* the hit box is the card, and it moves */}
        <div className="flex flex-col gap-2">
          <div
            ref={rows[0]}
            onPointerMove={move(0)}
            onPointerLeave={() => clear(0)}
            className="flex justify-center gap-4 pt-3"
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                data-hit=""
                data-hover="false"
                className={cn(
                  CARD,
                  "outline-1 outline-stroke-strong outline-dashed outline-offset-2 data-[hover=true]:-translate-y-2.5",
                )}
              />
            ))}
          </div>
          <Caption>the hit box is the card</Caption>
        </div>
        {/* the hit box is a wrapper, and it stays */}
        <div className="flex flex-col gap-2">
          <div
            ref={rows[1]}
            onPointerMove={move(1)}
            onPointerLeave={() => clear(1)}
            className="flex justify-center gap-4 pt-3"
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                data-hit=""
                data-hover="false"
                className="group rounded-lg outline-1 outline-stroke-strong outline-dashed outline-offset-2"
              >
                <div
                  className={cn(
                    CARD,
                    "group-data-[hover=true]:-translate-y-2.5",
                  )}
                />
              </div>
            ))}
          </div>
          <Caption>the hit box stays where it is</Caption>
        </div>
      </div>
      {/* the simulated hand, drawn on the page so it can sit on the card's edge */}
      <div
        ref={hand}
        aria-hidden="true"
        className={cn(
          "pointer-events-none fixed top-0 left-0 z-10 text-text-primary",
          parked ? "opacity-100" : "opacity-0",
        )}
        style={{ position: "absolute" }}
      >
        <CursorIcon
          weight="fill"
          className="size-4 -translate-x-1 -translate-y-1"
        />
      </div>
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
 * A button that prints what it hears. A mouse click, a finger and a key each
 * arrive as a different sequence, and the sequence is the only way to tell
 * them apart. At rest the three sequences are shown faintly, and the first
 * real event replaces them.
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
      label="click, tab, tap"
      controls={
        <>
          <Pill
            onPointerDown={(e) => note("pointerdown", e.pointerType)}
            onPointerUp={(e) => note("pointerup", e.pointerType)}
            onPointerCancel={(e) => note("pointercancel", e.pointerType)}
            onClick={(e) => note("click", `detail ${e.detail}`)}
            className="touch-manipulation"
          >
            press me
          </Pill>
          <Pill onClick={() => setLog([])} disabled={log.length === 0}>
            clear
          </Pill>
        </>
      }
    >
      <ol
        aria-live="polite"
        className="mx-auto flex w-full max-w-72 flex-col divide-y divide-stroke-soft font-mono text-meta tabular-nums"
        style={{ minHeight: `${KEEP * 1.6 * 12 + KEEP * 6.4}px` }}
      >
        {log.length === 0
          ? GHOSTS.map((g) => (
              <li key={g.who} className="flex gap-4 py-0.75 text-text-muted">
                <span className="w-12 shrink-0">{g.who}</span>
                <span className="flex flex-wrap gap-x-3">
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
