"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  bodyFont,
  Caption,
  Empty,
  Frame,
  hexToRgb,
  Pair,
  Pill,
  Readout,
  token,
} from "./frame";

/*
 * Two demos about what a press looks like: the step it takes, and how long
 * the step is allowed to take.
 */

const BASE =
  "inline-flex h-11 cursor-pointer select-none items-center justify-center rounded-full bg-fill px-7 text-action font-medium text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2";

/** the label both pills carry, lowercased here since a canvas has no `text-transform` */
const LABEL = "save changes";
/** the pill as the loupe rasterises it, in CSS px */
const RASTER = { w: 140, h: 35, font: 12.8 };
/** the window the loupe magnifies, in CSS px of the raster, and how much */
const WINDOW = { w: 16, h: 9, zoom: 12 };
const SCALE = 0.98;

type Side = "scale" | "fill";

/**
 * A magnified view of the label's first letter, drawn the way the compositor
 * draws a pressed pill.
 *
 * A CSS `scale` on a button does not re-rasterise the text. The layer is
 * rasterised once and the transform resamples that texture, so a 0.98 scale
 * is a bilinear resample of the glyphs at a sub-pixel offset. That is the
 * smear, and it is reproduced here by the same two steps: the label is drawn
 * to an offscreen canvas at device resolution, then drawn again onto the stage
 * canvas through a 0.98 transform with smoothing on. The fill side draws the
 * label crisp on a darker ground, which is what a fill step does.
 *
 * The loupe then blows a window around the first glyph up eight times with
 * smoothing off, so each device pixel is a square the eye can read.
 */
function Loupe({ side, pressed }: { side: Side; pressed: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const raster = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const out = canvas.current;
    if (!out) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const fill = token("fill");
    const active = token("fill-active");
    const ink = token("text-primary");

    /* the pill, rasterised once at device resolution */
    if (!raster.current) {
      const r = document.createElement("canvas");
      r.width = RASTER.w * dpr;
      r.height = RASTER.h * dpr;
      const rc = r.getContext("2d");
      if (!rc) return;
      rc.setTransform(dpr, 0, 0, dpr, 0, 0);
      rc.font = bodyFont(RASTER.font);
      rc.textBaseline = "middle";
      rc.textAlign = "center";
      rc.fillStyle = ink;
      rc.fillText(LABEL, RASTER.w / 2, RASTER.h / 2);
      raster.current = r;
    }
    const r = raster.current;
    const rc = r.getContext("2d");
    if (!rc) return;

    /* the stage: the pill as the compositor paints it */
    const stage = document.createElement("canvas");
    stage.width = RASTER.w * dpr;
    stage.height = RASTER.h * dpr;
    const sc = stage.getContext("2d");
    if (!sc) return;
    sc.setTransform(dpr, 0, 0, dpr, 0, 0);
    sc.fillStyle = side === "fill" && pressed ? active : fill;
    sc.fillRect(0, 0, RASTER.w, RASTER.h);
    if (side === "scale" && pressed) {
      sc.translate(RASTER.w / 2, RASTER.h / 2);
      sc.scale(SCALE, SCALE);
      sc.translate(-RASTER.w / 2, -RASTER.h / 2);
    }
    sc.imageSmoothingEnabled = true;
    sc.drawImage(r, 0, 0, RASTER.w, RASTER.h);

    /* the loupe: a window round the first glyph's left edge, magnified */
    rc.font = bodyFont(RASTER.font);
    const width = rc.measureText(LABEL).width;
    const edge = (RASTER.w - width) / 2;
    const x0 = edge - 4;
    const y0 = RASTER.h / 2 - WINDOW.h / 2;
    out.width = WINDOW.w * WINDOW.zoom * dpr;
    out.height = WINDOW.h * WINDOW.zoom * dpr;
    const oc = out.getContext("2d");
    if (!oc) return;
    oc.imageSmoothingEnabled = false;
    oc.drawImage(
      stage,
      x0 * dpr,
      y0 * dpr,
      WINDOW.w * dpr,
      WINDOW.h * dpr,
      0,
      0,
      out.width,
      out.height,
    );
  }, [side, pressed]);

  return (
    <canvas
      ref={canvas}
      className="rounded-md ring-1 ring-stroke ring-inset"
      style={{ width: WINDOW.w * WINDOW.zoom, height: WINDOW.h * WINDOW.zoom }}
    />
  );
}

/** how long the control holds both pills down, for a reader with no mouse */
const HOLD = 900;

/**
 * A 2% scale against a fill step. The scale is the one thing this site bans,
 * and this is the one place it is rendered, as the thing being argued against.
 */
export function PressDemo() {
  const [down, setDown] = useState<Side | "both" | null>(null);
  const [edge, setEdge] = useState<number | null>(null);
  const scaled = useRef<HTMLButtonElement>(null);

  /* how far one edge of the real pill moves at 0.98, off its measured height */
  useEffect(() => {
    const el = scaled.current;
    if (!el) return;
    setEdge((el.getBoundingClientRect().height * (1 - SCALE)) / 2);
  }, []);

  /* a lift anywhere ends a press, the call tether-button makes */
  useEffect(() => {
    const up = () => setDown((d) => (d === "both" ? d : null));
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("blur", up);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("blur", up);
    };
  }, []);

  const both = () => {
    setDown("both");
    setTimeout(() => setDown(null), HOLD);
  };

  const is = (side: Side) => down === side || down === "both";
  const keys = (side: Side) => ({
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") setDown(side);
    },
    onKeyUp: () => setDown((d) => (d === "both" ? d : null)),
  });

  return (
    <Frame
      label="press and hold"
      readouts={
        <Readout
          label="each edge moves"
          value={edge === null ? <Empty /> : `${edge.toFixed(2)}px`}
        />
      }
      controls={
        <Pill onClick={both} disabled={down === "both"}>
          press both
        </Pill>
      }
    >
      <Pair>
        <div className="flex flex-col items-center gap-3">
          <button
            ref={scaled}
            type="button"
            onPointerDown={() => setDown("scale")}
            {...keys("scale")}
            className={cn(
              BASE,
              "transition-transform duration-150",
              is("scale") && "scale-[0.98]",
            )}
          >
            Save changes
          </button>
          <Loupe side="scale" pressed={is("scale")} />
          <Caption>scale 0.98</Caption>
        </div>
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onPointerDown={() => setDown("fill")}
            {...keys("fill")}
            className={cn(
              BASE,
              "transition-colors duration-200 hover:bg-fill-hover",
              is("fill") && "bg-fill-active duration-0",
            )}
          >
            Save changes
          </button>
          <Loupe side="fill" pressed={is("fill")} />
          <Caption>fill step</Caption>
        </div>
      </Pair>
    </Frame>
  );
}

/** how long a quick tap holds the button, in ms */
const TAP = 90;
/** how long after the press the colour is sampled, so the step back shows too */
const WATCH = 480;

interface Sample {
  t: number;
  p: number;
}

/** the pressed colour's share, off the red channel of the live background */
function progress(el: HTMLElement, from: number, to: number): number {
  const rgb = getComputedStyle(el).backgroundColor.match(/[\d.]+/g);
  if (!rgb) return 0;
  return Math.min(1, Math.max(0, (from - Number(rgb[0])) / (from - to)));
}

/** the colour over time, as a small line */
function Trace({ samples }: { samples: Sample[] | null }) {
  const W = 160;
  const H = 44;
  const x = (t: number) => (t / WATCH) * W;
  const y = (p: number) => H - 3 - p * (H - 6);
  const release = x(TAP);
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      className="text-text-primary"
    >
      {/* the pressed colour, and the release */}
      <line
        x1={0}
        x2={W}
        y1={y(1)}
        y2={y(1)}
        className="stroke-stroke-strong"
        strokeDasharray="2 3"
      />
      <line
        x1={release}
        x2={release}
        y1={0}
        y2={H}
        className="stroke-stroke-strong"
        strokeDasharray="2 3"
      />
      {samples ? (
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinejoin="round"
          points={samples.map((s) => `${x(s.t)},${y(s.p)}`).join(" ")}
        />
      ) : null}
    </svg>
  );
}

/**
 * Two pills with the same 200ms colour step. One takes the step in over
 * 200ms as well, the other takes it at once. A simulated 90ms tap presses both
 * and traces the colour each one paints, frame by frame, through the press
 * and the release.
 */
export function TapDemo() {
  const slow = useRef<HTMLButtonElement>(null);
  const fast = useRef<HTMLButtonElement>(null);
  const [traces, setTraces] = useState<[Sample[], Sample[]] | null>(null);
  const [reached, setReached] = useState<[number, number] | null>(null);
  const [busy, setBusy] = useState(false);

  const tap = () => {
    const a = slow.current;
    const b = fast.current;
    if (!a || !b || busy) return;
    setBusy(true);
    const [from] = hexToRgb(token("fill"));
    const [to] = hexToRgb(token("fill-active"));
    const start = performance.now();
    const out: [Sample[], Sample[]] = [[], []];
    let peak: [number, number] = [0, 0];
    a.setAttribute("data-pressed", "");
    b.setAttribute("data-pressed", "");

    const frame = (now: number) => {
      const t = now - start;
      if (t >= TAP) {
        a.removeAttribute("data-pressed");
        b.removeAttribute("data-pressed");
      }
      const pa = progress(a, from, to);
      const pb = progress(b, from, to);
      out[0].push({ t, p: pa });
      out[1].push({ t, p: pb });
      /* what each reached is its colour at the moment the tap let go */
      if (t < TAP) peak = [pa, pb];
      if (t < WATCH) {
        requestAnimationFrame(frame);
      } else {
        setTraces(out);
        setReached([Math.round(peak[0] * 100), Math.round(peak[1] * 100)]);
        setBusy(false);
      }
    };
    requestAnimationFrame(frame);
  };

  return (
    <Frame
      label="tap fast"
      readouts={
        <>
          <Readout
            label="timed in"
            value={reached ? `${reached[0]}%` : <Empty />}
          />
          <Readout
            label="instant in"
            value={reached ? `${reached[1]}%` : <Empty />}
          />
        </>
      }
      controls={
        <Pill onClick={tap} disabled={busy}>
          tap both for {TAP}ms
        </Pill>
      }
    >
      <Pair>
        <div className="flex flex-col items-center gap-3">
          <button
            ref={slow}
            type="button"
            className={cn(
              BASE,
              "transition-colors duration-200 hover:bg-fill-hover active:bg-fill-active data-pressed:bg-fill-active",
            )}
          >
            200ms in, 200ms out
          </button>
          <Trace samples={traces?.[0] ?? null} />
        </div>
        <div className="flex flex-col items-center gap-3">
          <button
            ref={fast}
            type="button"
            className={cn(
              BASE,
              "transition-colors duration-200 hover:bg-fill-hover active:bg-fill-active active:duration-0 data-pressed:bg-fill-active data-pressed:duration-0",
            )}
          >
            instant in, 200ms out
          </button>
          <Trace samples={traces?.[1] ?? null} />
        </div>
      </Pair>
    </Frame>
  );
}
