"use client";

import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { approach } from "@/lib/lerp";
import {
  createGrains,
  drawGrains,
  type Grains,
  loadGrains,
  type Run,
  type Tone,
} from "./grains";
import {
  buildPassage,
  fontFor,
  PASSAGE,
  type Passage,
  tripFor,
  typeFor,
} from "./passage";

/*
 * A headline that breaks into grains as it scrolls out at the head, and comes
 * back together as it scrolls in from the foot.
 *
 * `passage.ts` lays the words out and cuts the atlas into cells. `grains.ts` is
 * the shader that draws one point per cell. This file is the stage, the scroll
 * and the frame loop.
 *
 * The page scrolls natively under the canvas, and nothing renders on scroll.
 * The canvas draws the passage at an eased copy of the scroll position, so a
 * mouse wheel's 100px notch is one glide rather than a jump in every grain.
 */

/** the eased scroll's time constant, in seconds */
const TAU = 0.12;

const SENTENCE = PASSAGE.join(" ");

/** a token's colour as linear 0..1 floats, normalised by a 2D context */
function tone(name: string): Tone {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return [0, 0, 0];
  ctx.fillStyle = value;
  const hex = ctx.fillStyle;
  if (!hex.startsWith("#")) return [0, 0, 0];
  const n = Number.parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

interface Mirror {
  pieces: { lines: string[]; top: number }[];
  font: number;
  leading: number;
  pad: number;
  contentHeight: number;
  family: string;
}

export default function ScrollDisintegrate() {
  const reduce = useReducedMotion();
  const stage = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [mirror, setMirror] = useState<Mirror | null>(null);
  const [failed, setFailed] = useState(false);

  // everything the loop reads, kept out of React
  const live = useRef({
    grains: null as Grains | null,
    passage: null as Passage | null,
    raf: 0,
    last: 0,
    reduce: false,
    w: 0,
    h: 0,
    dpr: 1,
    shown: 0,
    target: 0,
    ink: [0, 0, 0] as Tone,
    dust: [0, 0, 0] as Tone,
  });

  const draw = useCallback(() => {
    const s = live.current;
    const p = s.passage;
    const c = canvas.current;
    if (!s.grains || !p || !c) return;
    const runs: Run[] = [];
    for (const piece of p.pieces) {
      const top = piece.top - s.shown;
      const centre = top + piece.height / 2;
      // a piece wholly past the head has gone, and one far under the foot has
      // not started to arrive
      if (centre < -s.h * 0.1 || top > s.h * 1.2) continue;
      const trip = tripFor(centre, s.h);
      if (trip >= 1) continue;
      runs.push({
        first: piece.first,
        count: piece.count,
        // whole device pixels, so a grain at rest lands on its own texels
        shift: Math.round(top * s.dpr) - piece.atlasTop,
        trip,
      });
    }
    drawGrains(s.grains, {
      width: c.width,
      height: c.height,
      atlasWidth: p.atlas.width,
      atlasHeight: p.atlas.height,
      cell: p.cell,
      dpr: s.dpr,
      calm: s.reduce,
      ink: s.ink,
      dust: s.dust,
      runs,
    });
  }, []);

  const tick = useCallback(
    (now: number) => {
      const s = live.current;
      const dt = Math.min(0.05, (now - s.last) / 1000);
      s.last = now;
      if (s.reduce) s.shown = s.target;
      else s.shown += (s.target - s.shown) * approach(TAU, dt);
      if (Math.abs(s.target - s.shown) < 0.25) s.shown = s.target;
      draw();
      s.raf = s.shown === s.target ? 0 : requestAnimationFrame(tick);
    },
    [draw],
  );

  const start = useCallback(() => {
    const s = live.current;
    if (s.raf) return;
    s.last = performance.now();
    s.raf = requestAnimationFrame(tick);
  }, [tick]);

  const onScroll = () => {
    const node = scroller.current;
    if (!node) return;
    live.current.target = node.scrollTop;
    start();
  };

  useEffect(() => {
    live.current.reduce = reduce === true;
    draw();
  }, [reduce, draw]);

  // the context, the stage's size, and the passage laid out for it
  useEffect(() => {
    const node = stage.current;
    const c = canvas.current;
    const sc = scroller.current;
    if (!node || !c || !sc) return;
    const s = live.current;
    s.ink = tone("--color-text-primary");
    s.dust = tone("--color-text-muted");
    let cancelled = false;

    const init = () => {
      const gl = c.getContext("webgl", {
        alpha: true,
        premultipliedAlpha: true,
        antialias: false,
        powerPreference: "low-power",
      });
      s.grains = gl ? createGrains(gl) : null;
      setFailed(!s.grains);
    };
    init();

    const build = async () => {
      const w = node.clientWidth;
      const h = node.clientHeight;
      if (w === 0 || h === 0) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const family = getComputedStyle(sc).fontFamily;
      // the atlas is drawn once, so it has to wait for the face it is drawn in
      await document.fonts.load(fontFor(typeFor(w).font, family));
      if (cancelled) return;
      const p = buildPassage(w, h, dpr, family);
      if (!p) return;
      s.w = w;
      s.h = h;
      s.dpr = dpr;
      s.passage = p;
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      if (s.grains) loadGrains(s.grains, p.atlas, p.cells);
      setMirror({
        pieces: p.pieces.map(({ lines, top }) => ({ lines, top })),
        font: p.font,
        leading: p.leading,
        pad: p.pad,
        contentHeight: p.contentHeight,
        family,
      });
      s.target = sc.scrollTop;
      s.shown = s.target;
      draw();
    };
    build();
    const resize = new ResizeObserver(() => {
      build();
    });
    resize.observe(node);

    const lost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(s.raf);
      s.raf = 0;
      s.grains = null;
    };
    const restored = () => {
      init();
      if (s.grains && s.passage) {
        loadGrains(s.grains, s.passage.atlas, s.passage.cells);
      }
      draw();
    };
    c.addEventListener("webglcontextlost", lost);
    c.addEventListener("webglcontextrestored", restored);

    return () => {
      cancelled = true;
      resize.disconnect();
      c.removeEventListener("webglcontextlost", lost);
      c.removeEventListener("webglcontextrestored", restored);
      cancelAnimationFrame(s.raf);
      s.raf = 0;
    };
  }, [draw]);

  return (
    <div
      ref={stage}
      className="relative isolate aspect-8/5 min-h-78 w-full select-none overflow-hidden rounded-lg bg-fill"
    >
      {/* the page, which scrolls natively with no visible bar */}
      <section
        ref={scroller}
        aria-label="A passage that breaks into grains as you scroll"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: a scroll region needs focus for the arrow and page keys to scroll it
        tabIndex={0}
        onScroll={onScroll}
        className="peer absolute inset-0 overflow-y-auto overscroll-y-contain [scrollbar-width:none] focus-visible:outline-none [&::-webkit-scrollbar]:hidden"
      >
        <p className="sr-only">{SENTENCE}</p>
        {mirror && (
          <div
            aria-hidden="true"
            className="relative"
            style={{ height: mirror.contentHeight }}
          >
            {/* The same lines the canvas draws, at the same places. Clear while
                the grains run, and the passage itself when there is no WebGL. */}
            {mirror.pieces.map((piece) => (
              <div
                key={piece.top}
                className={
                  failed
                    ? "absolute font-semibold text-text-primary"
                    : "absolute font-semibold text-transparent"
                }
                style={{
                  top: piece.top,
                  left: mirror.pad,
                  fontSize: mirror.font,
                  lineHeight: `${mirror.leading}px`,
                  letterSpacing: "-0.035em",
                  fontFamily: mirror.family,
                }}
              >
                {piece.lines.map((line) => (
                  <span key={line} className="block whitespace-nowrap">
                    {line}
                  </span>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>

      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <canvas ref={canvas} className="block size-full" />
      </div>

      {/* the focus ring is a layer over the passage, since an inset ring on a
          scroller paints under its own children */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 ring-2 ring-text-primary/15 ring-inset transition-opacity duration-150 peer-focus-visible:opacity-100"
      />
    </div>
  );
}
