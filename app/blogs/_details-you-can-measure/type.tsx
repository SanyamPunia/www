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
  Readout,
} from "./frame";

/*
 * Four small demos about type: digits that hold still, lines that wrap
 * evenly, separators that sit on the baseline, and casing that belongs to
 * the stylesheet.
 */

/** a number that changes every 90ms while running */
export function DigitsDemo() {
  const [n, setN] = useState(1000);
  const [running, setRunning] = useState(false);
  const one = useRef<HTMLSpanElement>(null);
  const eight = useRef<HTMLSpanElement>(null);
  const tab = useRef<HTMLSpanElement>(null);
  const [widths, setWidths] = useState<[number, number, number] | null>(null);

  useEffect(() => {
    if (!one.current || !eight.current || !tab.current) return;
    const w = (el: HTMLElement) =>
      Math.round(el.getBoundingClientRect().width * 10) / 10;
    setWidths([w(one.current), w(eight.current), w(tab.current)]);
  }, []);

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
      label="run"
      readouts={
        <>
          <Readout label="a 1" value={widths ? `${widths[0]}px` : <Empty />} />
          <Readout label="an 8" value={widths ? `${widths[1]}px` : <Empty />} />
          <Readout
            label="tabular, both"
            value={widths ? `${widths[2]}px` : <Empty />}
          />
        </>
      }
      controls={
        <Pill onClick={() => setRunning((r) => !r)}>
          <Morph>{running ? "stop" : "run"}</Morph>
        </Pill>
      }
    >
      {/* the hairline after each number is what shows the reflow: it jumps
          with proportional digits and holds with tabular ones */}
      <Pair>
        <div className="flex flex-col items-center gap-3">
          <span className="inline-flex h-11 items-center rounded-full bg-fill px-5 text-body font-medium text-text-primary">
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
          <span className="inline-flex h-11 items-center rounded-full bg-fill px-5 text-body font-medium text-text-primary tabular-nums">
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
      {/* the digits measured, in the pill's own type, out of the flow */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute opacity-0 text-body font-medium"
      >
        <span ref={one}>1</span>
        <span ref={eight}>8</span>
        <span ref={tab} className="tabular-nums">
          1
        </span>
      </span>
    </Frame>
  );
}

type Wrap = "wrap" | "balance" | "pretty";
const WRAPS = ["wrap", "balance", "pretty"] as const;
const WIDTH = { min: 180, max: 340 };

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
  const [width, setWidth] = useState(260);
  const [lines, setLines] = useState<number | null>(null);
  const [lone, setLone] = useState(false);
  const title = useRef<HTMLParagraphElement>(null);
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
    const t = title.current;
    const b = before.current;
    const w = last.current;
    if (!t || !b || !w) return;
    const lh = Number.parseFloat(getComputedStyle(t).lineHeight);
    setLines(Math.round(t.getBoundingClientRect().height / lh));
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
    "absolute inset-y-0 w-3 cursor-ew-resize touch-none before:absolute before:inset-y-0 before:left-1/2 before:border-stroke-strong before:border-l before:border-dashed focus-visible:outline-none focus-visible:before:border-text-primary";

  return (
    <Frame
      label="drag an edge"
      readouts={
        <>
          <Readout label="width" value={<span>{width}px</span>} />
          <Readout
            label="title"
            value={lines === null ? <Empty /> : `${lines} lines`}
          />
          <Readout label="last line" value={lone ? "one word" : "full"} />
        </>
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
        <div className="relative px-3" style={{ width: width + 24 }}>
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
            className={cn(EDGE, "left-0")}
          />
          <div className="flex flex-col gap-2 py-1" style={{ textWrap: wrap }}>
            <p ref={title} className="text-body font-medium text-text-primary">
              {TITLE}
            </p>
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
            className={cn(EDGE, "right-0")}
          />
        </div>
      </div>
    </Frame>
  );
}

const SIZES = [
  { cls: "text-meta", name: "meta" },
  { cls: "text-body", name: "body" },
  { cls: "text-lead", name: "lead" },
] as const;

const META = ["7 min read", "Sep 2026"];

function Dot({ dotRef }: { dotRef?: React.Ref<HTMLSpanElement> }) {
  return (
    <span
      ref={dotRef}
      aria-hidden="true"
      className="inline-block size-1 shrink-0 rounded-full bg-stroke-strong"
    />
  );
}

interface Guide {
  baseline: number;
  glyph: { x: number; w: number; y: number };
  dot: { x: number; w: number; y: number };
}

/**
 * Where a glyph's ink sits, measured off a canvas rather than off its box. A
 * span's rect is the line box, whose centre is the line's centre whatever the
 * glyph inside it looks like. The middot's ink is a few pixels wide and it
 * sits wherever the font put it, so the glyph is drawn at the row's own font
 * and its pixels are scanned for the ink's top and bottom.
 */
function inkCentre(font: string): number {
  const size = 64;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) return 0;
  ctx.font = font;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#000";
  const baseline = size * 0.7;
  ctx.fillText("\u00b7", 8, baseline);
  const { data } = ctx.getImageData(0, 0, size, size);
  let top = size;
  let bottom = -1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (data[(y * size + x) * 4 + 3] > 40) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  if (bottom < 0) return 0;
  /* how far the ink's centre sits above the baseline */
  return baseline - (top + bottom + 1) / 2;
}

/**
 * The same row at three sizes, a middot on the left and a 4px element on the
 * right. Hovering a row draws its baseline and marks the centre of each
 * separator, and the readouts say how wide each one is and how far it sits
 * above the baseline. The glyph grows with the type. The element does not.
 */
export function DotsDemo() {
  const [active, setActive] = useState<number | null>(null);
  const [guide, setGuide] = useState<Guide | null>(null);
  const [pinned, setPinned] = useState(false);
  const rows = useRef<(HTMLDivElement | null)[]>([]);
  const probes = useRef<(HTMLSpanElement | null)[]>([]);
  const glyphs = useRef<(HTMLSpanElement | null)[]>([]);
  const dots = useRef<(HTMLSpanElement | null)[]>([]);

  const measure = (i: number) => {
    const row = rows.current[i];
    const probe = probes.current[i];
    const glyph = glyphs.current[i];
    const dot = dots.current[i];
    if (!row || !probe || !glyph || !dot) return;
    const r = row.getBoundingClientRect();
    const g = glyph.getBoundingClientRect();
    const d = dot.getBoundingClientRect();
    /* a zero-size inline-block sits on the baseline, so its bottom is the baseline */
    const baseline = probe.getBoundingClientRect().bottom - r.top;
    const up = inkCentre(getComputedStyle(glyph).font);
    setGuide({
      baseline,
      glyph: { x: g.left - r.left, w: g.width, y: baseline - up },
      dot: { x: d.left - r.left, w: d.width, y: d.top + d.height / 2 - r.top },
    });
    setActive(i);
  };

  const leave = () => {
    if (pinned) return;
    setActive(null);
  };

  return (
    <Frame
      label="hover a row"
      readouts={
        <>
          {/* fixed widths, and this was a bug. A readout arriving on hover
              wrapped the bottom row, the taller row shrank the centred middle
              one, the row under the pointer shifted out from under it, the
              hover ended, the readout emptied and the row came back. Every
              stage whose readouts change on hover holds their width. */}
          <Readout
            label="middot"
            className="w-48"
            value={
              guide && active !== null ? (
                `${guide.glyph.w.toFixed(1)}px, ${(guide.baseline - guide.glyph.y).toFixed(1)}px up`
              ) : (
                <Empty />
              )
            }
          />
          <Readout
            label="dot"
            className="w-48"
            value={
              guide && active !== null ? (
                `${guide.dot.w.toFixed(1)}px, ${(guide.baseline - guide.dot.y).toFixed(1)}px up`
              ) : (
                <Empty />
              )
            }
          />
        </>
      }
      controls={
        <Pill
          onClick={() => {
            const next = !pinned;
            setPinned(next);
            if (next) measure(active ?? 1);
            else setActive(null);
          }}
        >
          <Morph>{pinned ? "hide guides" : "show guides"}</Morph>
        </Pill>
      }
    >
      <div className="flex flex-col gap-4">
        {SIZES.map((s, i) => (
          <div
            key={s.name}
            ref={(el) => {
              rows.current[i] = el;
            }}
            onPointerEnter={(e) => {
              if (e.pointerType !== "touch") measure(i);
            }}
            onPointerLeave={leave}
            className="relative grid items-baseline gap-6 sm:grid-cols-2"
          >
            <p className={cn(s.cls, "whitespace-nowrap text-text-muted")}>
              <span
                ref={(el) => {
                  probes.current[i] = el;
                }}
                aria-hidden="true"
                className="inline-block w-0 align-baseline"
              />
              {META[0]}{" "}
              <span
                ref={(el) => {
                  glyphs.current[i] = el;
                }}
              >
                ·
              </span>{" "}
              {META[1]}
            </p>
            <p
              className={cn(
                s.cls,
                "flex flex-wrap items-center gap-1.5 text-text-muted",
              )}
            >
              {META.map((m, j) => (
                <span
                  key={m}
                  className="flex items-center gap-1.5 whitespace-nowrap"
                >
                  {j > 0 ? (
                    <Dot
                      dotRef={(el) => {
                        dots.current[i] = el;
                      }}
                    />
                  ) : null}
                  {m}
                </span>
              ))}
            </p>
            {/* the guides: the baseline across the row, and a tick at each
                separator's centre */}
            {active === i && guide ? (
              <svg
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 size-full overflow-visible text-text-primary"
              >
                <line
                  x1={0}
                  x2="100%"
                  y1={guide.baseline}
                  y2={guide.baseline}
                  className="stroke-text-muted"
                  strokeDasharray="2 3"
                />
                <line
                  x1={guide.glyph.x + guide.glyph.w / 2}
                  x2={guide.glyph.x + guide.glyph.w / 2}
                  y1={guide.glyph.y}
                  y2={guide.baseline}
                  stroke="currentColor"
                />
                <line
                  x1={guide.dot.x + guide.dot.w / 2}
                  x2={guide.dot.x + guide.dot.w / 2}
                  y1={guide.dot.y}
                  y2={guide.baseline}
                  stroke="currentColor"
                />
              </svg>
            ) : null}
          </div>
        ))}
      </div>
    </Frame>
  );
}

export function LowercaseDemo() {
  const inherits = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState<string | null>(null);

  /*
   * The stage is `select-none`, so the reader cannot select the label and
   * copy it. The control copies it for them, off the node's own text, and the
   * readout shows what the clipboard got. Same claim, one press.
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
      label="copy"
      readouts={
        <Readout
          label="copied"
          value={copied === null ? <Empty /> : <code>{copied}</code>}
        />
      }
      controls={<Pill onClick={copy}>copy the label</Pill>}
    >
      <Pair>
        <div className="flex flex-col items-center gap-3">
          {/* inline, since the site's own `button { text-transform: inherit }`
              is unlayered and beats any utility, which is the layer lesson
              from the list at the end of the post */}
          <Pill style={{ textTransform: "none" }}>Save Changes</Pill>
          <Caption>text-transform: none</Caption>
        </div>
        <div className="flex flex-col items-center gap-3">
          <Pill ref={inherits}>Save Changes</Pill>
          <Caption>text-transform: inherit</Caption>
        </div>
      </Pair>
    </Frame>
  );
}
