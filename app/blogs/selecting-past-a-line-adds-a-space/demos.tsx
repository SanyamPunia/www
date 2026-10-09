"use client";

import { ArrowsLeftRightIcon } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { TextMorph } from "torph/react";
import { cn } from "@/lib/utils";

/**
 * The post's two demos. `Anatomy` draws what Chrome paints, measured off real
 * text, so it reads the same in every browser. `Compare` is two real cards, the
 * browser's own highlight beside one painted from `getClientRects()`.
 */

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const MORPH = {
  duration: 200,
  ease: "cubic-bezier(0.32, 0.72, 0, 1)",
} as const;

const STAGE =
  "relative w-full rounded-md bg-fill ring-1 ring-stroke ring-inset";

function within(r: DOMRect, root: DOMRect): Box {
  return {
    x: r.left - root.left,
    y: r.top - root.top,
    w: r.width,
    h: r.height,
  };
}

/** One space's advance in an element's own font, which is the box Chrome adds. */
function spaceOf(el: Element): number {
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return 0;
  const cs = getComputedStyle(el);
  ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  return ctx.measureText(" ").width;
}

export function Anatomy() {
  const wrap = useRef<HTMLDivElement>(null);
  const num = useRef<HTMLDivElement>(null);
  const lab = useRef<HTMLDivElement>(null);
  const [into, setInto] = useState(false);
  const [geo, setGeo] = useState<{ num: Box; ove: Box; space: number }>();
  const reduce = useReducedMotion();
  const ease = reduce
    ? { duration: 0 }
    : { duration: 0.2, ease: [0.32, 0.72, 0, 1] as const };

  useLayoutEffect(() => {
    const root = wrap.current;
    const n = num.current?.firstChild;
    const l = lab.current?.firstChild;
    if (!root || !n || !l || !num.current) return;
    const el = num.current;

    const measure = () => {
      const box = root.getBoundingClientRect();
      const digits = document.createRange();
      digits.selectNodeContents(n);
      const ove = document.createRange();
      ove.setStart(l, 0);
      ove.setEnd(l, 3);
      setGeo({
        num: within(digits.getBoundingClientRect(), box),
        ove: within(ove.getBoundingClientRect(), box),
        space: spaceOf(el),
      });
    };

    measure();
    document.fonts.ready.then(measure);
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    return () => ro.disconnect();
  }, []);

  const right = geo ? geo.num.x + geo.num.w : 0;

  return (
    <div className="my-6 flex w-full select-none flex-col gap-3">
      <div className={cn(STAGE, "flex justify-center px-6 pt-14 pb-8")}>
        <div ref={wrap} className="relative isolate flex flex-col items-center">
          {geo && (
            <>
              {/* the digits' own box, which covers the font's whole height */}
              <div
                className="absolute bg-selection"
                style={{
                  left: geo.num.x,
                  top: geo.num.y,
                  width: geo.num.w,
                  height: geo.num.h,
                }}
              />
              {/* the line break, one space wide */}
              <motion.div
                className="absolute bg-selection outline-1 outline-text-primary outline-dashed -outline-offset-1"
                style={{ left: right, top: geo.num.y, height: geo.num.h }}
                initial={false}
                animate={{ width: into ? geo.space : 0, opacity: into ? 1 : 0 }}
                transition={ease}
              />
              <motion.div
                className="absolute bg-selection"
                style={{
                  left: geo.ove.x,
                  top: geo.ove.y,
                  width: geo.ove.w,
                  height: geo.ove.h,
                }}
                initial={false}
                animate={{ opacity: into ? 1 : 0 }}
                transition={ease}
              />

              {/* dimension brackets */}
              <div
                className="absolute h-1.5 border-text-muted border-x border-t"
                style={{
                  left: geo.num.x,
                  top: geo.num.y - 12,
                  width: geo.num.w,
                }}
              />
              <span
                className="absolute -translate-x-1/2 whitespace-nowrap font-mono text-meta text-text-muted"
                style={{ left: geo.num.x + geo.num.w / 2, top: geo.num.y - 34 }}
              >
                {geo.num.w.toFixed(1)}px
              </span>
              <motion.div
                className="absolute h-1.5 border-text-primary border-x border-t"
                style={{ left: right, top: geo.num.y - 12 }}
                initial={false}
                animate={{ width: into ? geo.space : 0, opacity: into ? 1 : 0 }}
                transition={ease}
              />
              <motion.span
                className="absolute whitespace-nowrap font-mono text-meta text-text-primary"
                style={{ left: right + 4, top: geo.num.y - 34 }}
                initial={false}
                animate={{ opacity: into ? 1 : 0 }}
                transition={ease}
              >
                +{geo.space.toFixed(1)}px
              </motion.span>
            </>
          )}
          <div
            ref={num}
            className="relative z-10 font-medium text-[4rem] text-text-primary leading-tight"
          >
            88
          </div>
          <div
            ref={lab}
            className="relative z-10 mt-1 text-body text-text-secondary"
          >
            Overall
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 text-meta text-text-muted">
        <span className="flex items-center gap-1.5">
          <span>copied:</span>
          <span className="whitespace-nowrap font-mono text-text-primary">
            <TextMorph duration={MORPH.duration} ease={MORPH.ease}>
              {into ? '"88\\nove"' : '"88"'}
            </TextMorph>
          </span>
        </span>
        <button
          type="button"
          onClick={() => setInto((v) => !v)}
          aria-label={
            into ? "End the selection in 88" : "Drag the selection into Overall"
          }
          className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-fill px-3 py-1.5 text-action text-text-secondary transition-colors duration-200 hover:bg-fill-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2 active:bg-fill-active"
        >
          <span className="whitespace-nowrap">
            <TextMorph duration={MORPH.duration} ease={MORPH.ease}>
              {into ? "ends in overall" : "ends in 88"}
            </TextMorph>
          </span>
          <ArrowsLeftRightIcon aria-hidden="true" className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

/** Every selected character's box inside `root`, one text node at a time. */
function selectedRects(root: HTMLElement): Box[] {
  const sel = getSelection();
  if (!sel?.rangeCount || sel.isCollapsed) return [];
  const live = sel.getRangeAt(0);
  const box = root.getBoundingClientRect();
  const out: Box[] = [];
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let t = walk.nextNode(); t; t = walk.nextNode()) {
    if (!live.intersectsNode(t)) continue;
    const part = document.createRange();
    part.selectNodeContents(t);
    if (t === live.startContainer) part.setStart(t, live.startOffset);
    if (t === live.endContainer) part.setEnd(t, live.endOffset);
    for (const r of part.getClientRects()) {
      if (r.width > 0) out.push(within(r, box));
    }
  }
  return out;
}

function Card({ painted }: { painted: boolean }) {
  const card = useRef<HTMLDivElement>(null);
  const [rects, setRects] = useState<Box[]>([]);

  useEffect(() => {
    const root = card.current;
    if (!painted || !root) return;
    const paint = () => setRects(selectedRects(root));
    document.addEventListener("selectionchange", paint);
    window.addEventListener("resize", paint);
    return () => {
      document.removeEventListener("selectionchange", paint);
      window.removeEventListener("resize", paint);
    };
  }, [painted]);

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={card}
        className={cn(
          STAGE,
          "isolate flex h-60 flex-col items-center justify-center gap-2",
          // `!` because the site's own `::selection` is unlayered and beats a
          // utility otherwise.
          painted && "selection:bg-transparent!",
        )}
      >
        {rects.map((r) => (
          <div
            key={`${r.x},${r.y}`}
            aria-hidden="true"
            className="absolute bg-selection"
            style={{ left: r.x, top: r.y, width: r.w, height: r.h }}
          />
        ))}
        <div className="relative z-10 grid size-32 place-items-center">
          <svg
            aria-hidden="true"
            viewBox="0 0 128 128"
            className="absolute inset-0 size-full -rotate-90"
          >
            <circle
              cx="64"
              cy="64"
              r="58"
              fill="none"
              strokeWidth="8"
              className="stroke-stroke-strong"
            />
            <circle
              cx="64"
              cy="64"
              r="58"
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray="88 100"
              className="stroke-text-primary"
            />
          </svg>
          <div className="font-medium text-[3rem] text-text-primary leading-tight">
            88
          </div>
        </div>
        <div className="relative z-10 text-body text-text-secondary">
          Overall
        </div>
      </div>
      <span className="text-meta text-text-muted">
        {painted ? (
          <>
            painted from <code className="font-mono">getClientRects()</code>
          </>
        ) : (
          "the browser's highlight"
        )}
      </span>
    </div>
  );
}

export function Compare() {
  return (
    <div className="my-6 grid w-full gap-4 sm:grid-cols-2">
      <Card painted={false} />
      <Card painted />
    </div>
  );
}
