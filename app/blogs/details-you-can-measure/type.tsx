"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Caption,
  Cycle,
  Empty,
  Frame,
  Morph,
  Pair,
  Pill,
  Ping,
  RAISED,
  Readout,
} from "./frame";

/*
 * Four small demos about type: digits that hold still, lines that wrap
 * evenly, separators that hold their size, and casing that belongs to the
 * stylesheet.
 */

/** a number that changes every 90ms while running */
export function DigitsDemo() {
  const [n, setN] = useState(1000);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setN(1000 + Math.floor(Math.random() * 9000));
    }, 90);
    return () => clearInterval(id);
  }, [running]);

  const digits = n.toLocaleString("en-US");

  return (
    <Frame
      hint="Run the counter and watch the line in each pill."
      after="The proportional line jumps with every digit. The tabular one holds."
      controls={
        <Pill lead onClick={() => setRunning((r) => !r)}>
          <Morph>{running ? "stop" : "run"}</Morph>
          <Ping />
        </Pill>
      }
    >
      {/* the hairline after each number is what shows the reflow: it jumps
          with proportional digits and holds with tabular ones */}
      <Pair>
        <div className="flex flex-col items-center gap-3">
          <span
            className={cn(
              "inline-flex h-11 items-center rounded-full px-5 pb-[0.16em] text-body font-medium text-text-primary",
              RAISED,
            )}
          >
            {digits}
            <span
              aria-hidden="true"
              className="mx-2.5 h-3.5 w-px shrink-0 bg-text-muted"
            />
            views
          </span>
          <Caption>proportional</Caption>
        </div>
        <div className="flex flex-col items-center gap-3">
          <span
            className={cn(
              "inline-flex h-11 items-center rounded-full px-5 pb-[0.16em] text-body font-medium text-text-primary tabular-nums",
              RAISED,
            )}
          >
            {digits}
            <span
              aria-hidden="true"
              className="mx-2.5 h-3.5 w-px shrink-0 bg-text-muted"
            />
            views
          </span>
          <Caption>tabular-nums</Caption>
        </div>
      </Pair>
    </Frame>
  );
}

type Wrap = "wrap" | "balance" | "pretty";
const WRAPS = ["wrap", "balance", "pretty"] as const;
const WIDTH = { min: 200, max: 480 };

const TITLE = "The submenu closes before you get there, and the fix has a name";
const BODY =
  "Aim at the bottom of a submenu and your cursor cuts across three rows on the way. Every one is a real hover, and the menu believes";
const LAST = "them.";

/**
 * A column with its own edges as the handles. Drag either edge and the
 * column narrows about its centre. The last word of the paragraph is marked
 * whenever it sits alone on the last line, which is measured rather than
 * guessed: its rect is compared with the word before it.
 */
export function WrapDemo() {
  const [wrap, setWrap] = useState<Wrap>("wrap");
  const [width, setWidth] = useState(340);
  const [lone, setLone] = useState(false);
  const before = useRef<HTMLSpanElement>(null);
  const last = useRef<HTMLSpanElement>(null);
  const grab = useRef<{
    id: number;
    x: number;
    width: number;
    side: 1 | -1;
  } | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the effect measures the DOM, and `wrap` and `width` are what reflow it
  useLayoutEffect(() => {
    const b = before.current;
    const w = last.current;
    if (!b || !w) return;
    setLone(
      Math.abs(b.getBoundingClientRect().top - w.getBoundingClientRect().top) >
        1,
    );
  }, [wrap, width]);

  const down = (side: 1 | -1) => (e: React.PointerEvent<HTMLElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    grab.current = { id: e.pointerId, x: e.clientX, width, side };
  };
  const move = (e: React.PointerEvent<HTMLElement>) => {
    const g = grab.current;
    if (!g || e.pointerId !== g.id) return;
    /* the column narrows about its centre, so an edge dragged 10px moves the width 20px */
    const next = g.width + (e.clientX - g.x) * 2 * g.side;
    setWidth(Math.round(Math.min(WIDTH.max, Math.max(WIDTH.min, next))));
  };
  const up = () => {
    grab.current = null;
  };
  const keys = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") setWidth((w) => Math.max(WIDTH.min, w - 4));
    else if (e.key === "ArrowRight")
      setWidth((w) => Math.min(WIDTH.max, w + 4));
    else return;
    e.preventDefault();
  };

  const EDGE =
    "absolute inset-y-0 z-10 w-4 cursor-ew-resize touch-none before:absolute before:top-1/2 before:left-1/2 before:h-9 before:w-1.5 before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:bg-text-muted before:shadow-[0_1px_2px_rgb(0_0_0/0.25)] before:transition-colors before:duration-150 hover:before:bg-text-secondary focus-visible:outline-none focus-visible:before:bg-text-primary";

  return (
    <Frame
      hint="Drag a handle to resize the column, then switch the wrap mode."
      after={
        lone
          ? "One word sits alone on the last line."
          : "The last line holds more than one word."
      }
      controls={
        <Cycle
          value={wrap}
          options={WRAPS}
          onChange={setWrap}
          label="text-wrap"
        />
      }
    >
      <div className="flex justify-center">
        <div
          className={cn("relative max-w-full rounded-lg px-5 py-4", RAISED)}
          style={{ width: width + 40 }}
        >
          <div
            role="slider"
            tabIndex={0}
            aria-label="column width, left edge"
            aria-valuemin={WIDTH.min}
            aria-valuemax={WIDTH.max}
            aria-valuenow={width}
            onPointerDown={down(-1)}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            onKeyDown={keys}
            className={cn(EDGE, "-left-2")}
          />
          <div className="flex flex-col gap-2 py-1" style={{ textWrap: wrap }}>
            <p className="text-body font-medium text-text-primary">{TITLE}</p>
            <p className="text-meta text-text-secondary">
              {BODY} <span ref={before}>all of</span>{" "}
              <span
                ref={last}
                className={cn(
                  lone &&
                    "underline decoration-danger decoration-dotted underline-offset-2",
                )}
              >
                {LAST}
              </span>
            </p>
          </div>
          <div
            role="slider"
            tabIndex={0}
            aria-label="column width, right edge"
            aria-valuemin={WIDTH.min}
            aria-valuemax={WIDTH.max}
            aria-valuenow={width}
            onPointerDown={down(1)}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            onKeyDown={keys}
            className={cn(EDGE, "-right-2")}
          >
            <Ping className="top-1/2 left-1/2 h-9 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full [--ping:5px]" />
          </div>
        </div>
      </div>
    </Frame>
  );
}

const SIZES = ["text-meta", "text-body", "text-lead"] as const;
const META = ["7 min read", "Sep 2026"];
const SHEET = "flex flex-col items-center gap-4 rounded-lg px-4 py-8";

/** The same row at three sizes. The middot grows with the type. The element does not. */
export function DotsDemo() {
  return (
    <Frame
      still
      hint="The middot changes with the type. The element stays 4px."
    >
      <Pair>
        <div className={cn(SHEET, RAISED)}>
          {SIZES.map((size) => (
            <p key={size} className={cn(size, "text-text-secondary")}>
              {META[0]} · {META[1]}
            </p>
          ))}
          <Caption>middot</Caption>
        </div>
        <div className={cn(SHEET, RAISED)}>
          {SIZES.map((size) => (
            <p
              key={size}
              className={cn(
                size,
                "flex items-center gap-1.5 text-text-secondary",
              )}
            >
              {META[0]}
              <span
                aria-hidden="true"
                className="inline-block size-1 shrink-0 rounded-full bg-text-secondary"
              />
              {META[1]}
            </p>
          ))}
          <Caption>element</Caption>
        </div>
      </Pair>
    </Frame>
  );
}

export function LowercaseDemo() {
  const inherits = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState<string | null>(null);

  /*
   * The stage is `select-none`, so the reader cannot select the label and
   * copy it. The control copies it for them, off the node's own text, and the
   * readout shows what the clipboard got.
   */
  const copy = async () => {
    const text = inherits.current?.textContent ?? "";
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* a clipboard that refuses still leaves the readout honest */
    }
    setCopied(text);
  };

  return (
    <Frame
      hint="Copy the label on the right, which the stylesheet lowercases."
      after="The screen says lowercase. The clipboard gets the real casing."
      controls={
        <Pill lead onClick={copy}>
          copy the label
          <Ping />
        </Pill>
      }
    >
      <Pair>
        <div className="flex flex-col items-center gap-3">
          {/* inline, since the site's own `button { text-transform: inherit }`
              is unlayered and beats any utility */}
          <Pill className={RAISED} style={{ textTransform: "none" }}>
            Save Changes
          </Pill>
          <Caption>text-transform: none</Caption>
        </div>
        <div className="flex flex-col items-center gap-3">
          <Pill ref={inherits} className={RAISED}>
            Save Changes
          </Pill>
          <Caption>text-transform: inherit</Caption>
        </div>
      </Pair>
      <div className="mt-6 flex justify-center">
        <Readout
          label="clipboard"
          value={copied === null ? <Empty /> : <code>{copied}</code>}
        />
      </div>
    </Frame>
  );
}
