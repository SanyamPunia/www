"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  bodyFont,
  Caption,
  Empty,
  Frame,
  hexToRgb,
  Meter,
  Pair,
  Pill,
  Ping,
  PRESSED,
  RAISED,
  Readout,
  token,
} from "./frame";

/*
 * Two demos about what a press looks like: the step it takes, and how long
 * the step is allowed to take.
 */

const BASE =
  "relative inline-flex h-11 cursor-pointer select-none items-center justify-center rounded-full px-7 pb-[0.16em] text-action font-medium text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2";

/** the label both pills carry, lowercased here since a canvas has no `text-transform` */
const LABEL = "save changes";
/** the pill as the loupe rasterises it, in CSS px */
const RASTER = { w: 140, h: 35, font: 12.8 };
/** the window the loupe magnifies, in CSS px of the raster, and how much */
const WINDOW = { w: 9, h: 9, zoom: 12 };
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
 * The loupe then blows a window around the first glyph up twelve times with
 * smoothing off, so each device pixel is a square the eye can read.
 */
function Loupe({ side, pressed }: { side: Side; pressed: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const raster = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const out = canvas.current;
    if (!out) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const rest = token("bg");
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
    sc.fillStyle = side === "fill" && pressed ? active : rest;
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
    const x0 = edge - 1;
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
    <div className={cn("relative rounded-full p-1", RAISED)}>
      <canvas
        ref={canvas}
        className="block rounded-full"
        style={{
          width: WINDOW.w * WINDOW.zoom,
          height: WINDOW.h * WINDOW.zoom,
        }}
      />
      {/* the glass: a bevel and a soft highlight, over the pixels */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-1 rounded-full bg-linear-145 from-bg/45 to-transparent to-40% shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08),inset_0_2px_6px_rgb(0_0_0/0.12)]"
      />
    </div>
  );
}

/** how long the control holds both pills down */
const HOLD = 900;

/**
 * A 2% scale against a fill step. The scale is the one thing this site bans,
 * and this is the one place it is rendered, as the thing being argued against.
 */
export function PressDemo() {
  const [down, setDown] = useState<Side | "both" | null>(null);

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
      hint="Press and hold a pill, then watch its first letter."
      after="Only the scaled pill resamples its letter. The fill leaves it sharp."
      controls={
        <Pill lead onClick={both} disabled={down === "both"}>
          press both
        </Pill>
      }
    >
      <Pair>
        <div className="flex flex-col items-center gap-4">
          <button
            type="button"
            onPointerDown={() => setDown("scale")}
            {...keys("scale")}
            className={cn(
              BASE,
              RAISED,
              "transition-transform duration-150",
              is("scale") && "scale-[0.98]",
            )}
          >
            Save changes
            <Ping />
          </button>
          <span
            aria-hidden="true"
            className="-my-4 h-4 w-px bg-stroke-strong"
          />
          <Loupe side="scale" pressed={is("scale")} />
          <Caption>scale 0.98</Caption>
        </div>
        <div className="flex flex-col items-center gap-4">
          <button
            type="button"
            onPointerDown={() => setDown("fill")}
            {...keys("fill")}
            className={cn(
              BASE,
              RAISED,
              "transition-[background-color,box-shadow] duration-200 hover:bg-surface",
              is("fill") && cn("bg-fill-active duration-0", PRESSED),
            )}
          >
            Save changes
          </button>
          <span
            aria-hidden="true"
            className="-my-4 h-4 w-px bg-stroke-strong"
          />
          <Loupe side="fill" pressed={is("fill")} />
          <Caption>fill step</Caption>
        </div>
      </Pair>
    </Frame>
  );
}

/** how long a quick tap holds the button, in ms */
const TAP = 90;

/** the pressed colour's share, off the red channel of the live background */
function progress(el: HTMLElement, from: number, to: number): number {
  const rgb = getComputedStyle(el).backgroundColor.match(/[\d.]+/g);
  if (!rgb) return 0;
  return Math.min(1, Math.max(0, (from - Number(rgb[0])) / (from - to)));
}

/**
 * Two pills with the same 200ms step back. One takes the step in over 200ms as
 * well, the other takes it at once. A simulated 90ms tap presses both and
 * reports how much of the pressed colour each reached before the release.
 */
export function TapDemo() {
  const slow = useRef<HTMLButtonElement>(null);
  const fast = useRef<HTMLButtonElement>(null);
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
    let peak: [number, number] = [0, 0];
    a.setAttribute("data-pressed", "");
    b.setAttribute("data-pressed", "");

    const frame = (now: number) => {
      if (now - start < TAP) {
        peak = [progress(a, from, to), progress(b, from, to)];
        requestAnimationFrame(frame);
        return;
      }
      a.removeAttribute("data-pressed");
      b.removeAttribute("data-pressed");
      setReached([Math.round(peak[0] * 100), Math.round(peak[1] * 100)]);
      setBusy(false);
    };
    requestAnimationFrame(frame);
  };

  return (
    <Frame
      hint="Tap both pills for 90ms and compare how far each one gets."
      after={
        reached
          ? "The timed press is cut off on the way. The instant one arrives."
          : null
      }
      controls={
        <Pill lead onClick={tap} disabled={busy}>
          tap both
          <Ping />
        </Pill>
      }
    >
      <Pair>
        <div className="flex flex-col items-center gap-5">
          <button
            ref={slow}
            type="button"
            className={cn(
              BASE,
              RAISED,
              "transition-colors duration-200 hover:bg-surface active:bg-fill-active data-pressed:bg-fill-active",
            )}
          >
            200ms in
          </button>
          <Meter value={reached ? reached[0] / 100 : null} />
          <Readout
            label="reached"
            value={reached ? `${reached[0]}%` : <Empty />}
          />
        </div>
        <div className="flex flex-col items-center gap-5">
          <button
            ref={fast}
            type="button"
            className={cn(
              BASE,
              RAISED,
              "transition-colors duration-200 hover:bg-surface active:bg-fill-active active:duration-0 data-pressed:bg-fill-active data-pressed:duration-0",
            )}
          >
            instant in
          </button>
          <Meter value={reached ? reached[1] / 100 : null} />
          <Readout
            label="reached"
            value={reached ? `${reached[1]}%` : <Empty />}
          />
        </div>
      </Pair>
    </Frame>
  );
}
