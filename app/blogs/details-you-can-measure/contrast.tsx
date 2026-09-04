"use client";

import { HeartIcon } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { INK } from "@/components/labs/halftone-ripple";
import { cn } from "@/lib/utils";
import { Cycle, Frame, hexToRgb, Pill, Readout, token } from "./frame";

/*
 * A colour you drag, and the only number that matters about it on a ground:
 * its contrast, against the floor for a graphic and the floor for text.
 */

/** the grounds a control on this site can paint */
type Ground = "bg" | "fill" | "fill-active";
const GROUNDS = ["bg", "fill", "fill-active"] as const;

/** the OKLCH chroma every colour here is drawn at */
const CHROMA = 0.22;
/** the range the drag can take lightness through */
const L = { min: 0.2, max: 0.95 };
/** how much of the range one drag across the whole swatch covers */
const REACH = { l: 0.75, h: 360 };
/** the scale's span */
const SCALE = { min: 1, max: 8 };
const FLOOR = { graphic: 3, text: 4.5 };

/** sRGB channel from linear light */
const gamma = (v: number) =>
  v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
/** linear light from an sRGB channel */
const linear = (v: number) =>
  v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;

/**
 * OKLCH to linear sRGB, clamped to the gamut. The clamp happens in linear
 * space so the swatch and the ratio are computed from the same colour.
 */
function oklchToLinear(
  l: number,
  c: number,
  h: number,
): [number, number, number] {
  const rad = (h * Math.PI) / 180;
  const a = c * Math.cos(rad);
  const b = c * Math.sin(rad);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const L3 = l_ ** 3;
  const M3 = m_ ** 3;
  const S3 = s_ ** 3;
  const clip = (v: number) => Math.min(1, Math.max(0, v));
  return [
    clip(4.0767416621 * L3 - 3.3077115913 * M3 + 0.2309699292 * S3),
    clip(-1.2684380046 * L3 + 2.6097574011 * M3 - 0.3413193965 * S3),
    clip(-0.0041960863 * L3 - 0.7034186147 * M3 + 1.707614701 * S3),
  ];
}

/**
 * Linear sRGB to OKLCH, so the preset can be the lab's own hex rather than a
 * hand-copied approximation of it. A copy would drift the day the lab moves.
 */
function linearToOklch([r, g, b]: [number, number, number]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L0 = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const h = (Math.atan2(bb, a) * 180) / Math.PI;
  return { l: L0, c: Math.hypot(a, bb), h: h < 0 ? h + 360 : h };
}

const luminance = ([r, g, b]: [number, number, number]) =>
  0.2126 * r + 0.7152 * g + 0.0722 * b;

function ratio(a: number, b: number): number {
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/** the ripple's pink, this post's own reference point */
const PINK = linearToOklch(
  hexToRgb(INK).map((v) => linear(v / 255)) as [number, number, number],
);

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

/**
 * The ratio on a scale from 1 to 8, with the two floors marked and a needle
 * at the current value. The floor labels take the status tone while they are
 * failed, which is the one place hue means something on this site.
 */
function Scale({ value }: { value: number }) {
  const W = 100;
  const x = (v: number) =>
    ((clamp(v, SCALE.min, SCALE.max) - SCALE.min) / (SCALE.max - SCALE.min)) *
    W;
  return (
    <div className="flex flex-col gap-1">
      {/* the text floor is labelled above the axis and the graphic floor
          below it, since the two sit 1.5 units apart and one row of labels
          collides at the column's width */}
      <div className="relative h-4 font-mono text-meta tabular-nums">
        <span
          className={cn(
            "absolute -translate-x-1/2 whitespace-nowrap",
            value >= FLOOR.text ? "text-text-muted" : "text-danger",
          )}
          style={{ left: `${x(FLOOR.text)}%` }}
        >
          4.5 text
        </span>
      </div>
      <svg
        aria-hidden="true"
        viewBox={`0 0 ${W} 16`}
        preserveAspectRatio="none"
        className="h-4 w-full"
      >
        <line
          x1={0}
          x2={W}
          y1={12}
          y2={12}
          className="stroke-stroke-strong"
          vectorEffect="non-scaling-stroke"
        />
        {[1, 2, 3, 4, 5, 6, 7, 8].map((v) => (
          <line
            key={v}
            x1={x(v)}
            x2={x(v)}
            y1={9}
            y2={12}
            className="stroke-stroke-strong"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {[FLOOR.graphic, FLOOR.text].map((v) => (
          <line
            key={v}
            x1={x(v)}
            x2={x(v)}
            y1={0}
            y2={16}
            className="stroke-text-secondary"
            strokeDasharray="2 2"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <line
          x1={x(value)}
          x2={x(value)}
          y1={0}
          y2={16}
          className="stroke-text-primary transition-[x1,x2] duration-75"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="relative h-4 font-mono text-meta tabular-nums">
        <span
          className={cn(
            "absolute -translate-x-1/2 whitespace-nowrap",
            value >= FLOOR.graphic ? "text-text-muted" : "text-danger",
          )}
          style={{ left: `${x(FLOOR.graphic)}%` }}
        >
          3.0 graphic
        </span>
      </div>
    </div>
  );
}

export function ContrastDemo() {
  const [l, setL] = useState(PINK.l);
  const [h, setH] = useState(PINK.h);
  const [ground, setGround] = useState<Ground>("fill");
  const [grounds, setGrounds] = useState<Record<Ground, string> | null>(null);
  const swatch = useRef<HTMLDivElement>(null);
  const grab = useRef<{
    id: number;
    x: number;
    y: number;
    l: number;
    h: number;
  } | null>(null);

  useEffect(() => {
    setGrounds({
      bg: token("bg"),
      fill: token("fill"),
      "fill-active": token("fill-active"),
    });
  }, []);

  const ink = useMemo(() => oklchToLinear(l, CHROMA, h), [l, h]);
  const css = `rgb(${ink.map((v) => Math.round(gamma(v) * 255)).join(" ")})`;
  const groundHex = grounds?.[ground] ?? "#ffffff";
  const groundLinear = hexToRgb(groundHex).map((v) => linear(v / 255)) as [
    number,
    number,
    number,
  ];
  const r = ratio(luminance(ink), luminance(groundLinear));

  /*
   * The swatch is the control. Up and down is lightness, left and right is
   * hue, measured from where the drag began so the colour cannot jump to the
   * pointer. The board keeps the pointer, so a hand that runs off the swatch
   * is still driving it.
   */
  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    grab.current = { id: e.pointerId, x: e.clientX, y: e.clientY, l, h };
  };
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = grab.current;
    const el = swatch.current;
    if (!g || !el || e.pointerId !== g.id) return;
    const rect = el.getBoundingClientRect();
    setL(
      clamp(g.l - ((e.clientY - g.y) / rect.height) * REACH.l, L.min, L.max),
    );
    setH(
      (((g.h + ((e.clientX - g.x) / rect.width) * REACH.h) % 360) + 360) % 360,
    );
  };
  const up = () => {
    grab.current = null;
  };
  const keys = (e: React.KeyboardEvent) => {
    const fine = e.shiftKey ? 0.2 : 1;
    if (e.key === "ArrowUp") setL((v) => clamp(v + 0.02 * fine, L.min, L.max));
    else if (e.key === "ArrowDown")
      setL((v) => clamp(v - 0.02 * fine, L.min, L.max));
    else if (e.key === "ArrowRight") setH((v) => (v + 6 * fine) % 360);
    else if (e.key === "ArrowLeft") setH((v) => (v - 6 * fine + 360) % 360);
    else return;
    e.preventDefault();
  };

  return (
    <Frame
      label="drag the swatch"
      readouts={
        <>
          <Readout label="L" value={<span>{l.toFixed(2)}</span>} />
          <Readout label="H" value={<span>{Math.round(h)}</span>} />
          <Readout label="ratio" value={<span>{r.toFixed(2)}:1</span>} />
        </>
      }
      controls={
        <>
          <Cycle
            value={ground}
            options={GROUNDS}
            onChange={setGround}
            label="ground"
          />
          <Pill
            onClick={() => {
              setL(PINK.l);
              setH(PINK.h);
            }}
          >
            the ripple's pink
          </Pill>
        </>
      }
    >
      <div className="mx-auto flex w-full max-w-96 flex-col gap-5">
        <div
          ref={swatch}
          role="slider"
          tabIndex={0}
          aria-label="colour. Up and down for lightness, left and right for hue"
          aria-valuemin={SCALE.min}
          aria-valuemax={21}
          aria-valuenow={Number(r.toFixed(2))}
          aria-valuetext={`lightness ${l.toFixed(2)}, hue ${Math.round(h)}, contrast ${r.toFixed(2)} to 1`}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onKeyDown={keys}
          className="flex h-24 cursor-grab touch-none items-center justify-center gap-8 rounded-lg ring-1 ring-stroke ring-inset active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2"
          style={{ backgroundColor: groundHex }}
        >
          <HeartIcon
            aria-hidden="true"
            weight="fill"
            className="size-6"
            style={{ color: css }}
          />
          <span
            className="text-body font-medium tabular-nums"
            style={{ color: css }}
          >
            128 likes
          </span>
          <span
            aria-hidden="true"
            className="size-6 rounded-full"
            style={{ backgroundColor: css }}
          />
        </div>
        <Scale value={r} />
      </div>
    </Frame>
  );
}
