"use client";

import type { ComponentProps, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { TextMorph } from "torph/react";
import {
  ArrowsLeftRightIcon,
  CursorClickIcon,
  MinusIcon,
} from "@/components/icons";
import { cn } from "@/lib/utils";

/**
 * How a label or a readout changes on a stage, through `torph`. The book
 * opening lab's numbers: 200ms on the pill's own ease. What a press does to a
 * value is correct it, and morphing the characters is what that looks like
 * where a swap reads as a different label arriving. `torph` reads
 * `prefers-reduced-motion` itself and renders no wrapper under it.
 */
export const MORPH = {
  duration: 200,
  ease: "cubic-bezier(0.32, 0.72, 0, 1)",
} as const;

/** Text that morphs when it changes. For a value that steps, never one that ticks per frame. */
export function Morph({ children }: { children: string }) {
  return (
    <TextMorph duration={MORPH.duration} ease={MORPH.ease}>
      {children}
    </TextMorph>
  );
}

/*
 * The parts every demo in this post is built from. Depth comes from three
 * surfaces: a lit stage, objects raised off it, and slots recessed into it.
 * Shading is black and white at low alpha, the rule `document-pocket` sets.
 *
 * Colocated because only this post uses them.
 */

/** an object standing on the stage: an edge, a contact line, a cast and an ambient shadow */
export const RAISED =
  "bg-bg shadow-[0_0_0_1px_rgb(0_0_0/0.05),0_1px_2px_rgb(0_0_0/0.08),0_6px_14px_-4px_rgb(0_0_0/0.12),0_18px_32px_-14px_rgb(0_0_0/0.14)]";
/** the same object pushed down, so the cast closes and the edge stays */
export const PRESSED =
  "shadow-[0_0_0_1px_rgb(0_0_0/0.07),0_1px_1px_rgb(0_0_0/0.08)]";
/** a slot cut into the stage, lit from above so its top edge is the dark one */
export const WELL =
  "bg-fill-hover shadow-[inset_0_1px_2px_rgb(0_0_0/0.12),inset_0_0_0_1px_rgb(0_0_0/0.03),0_1px_0_rgb(255_255_255/0.8)]";
/** a ball lit from the upper left, sitting in a slot */
export const KNOB =
  "bg-[radial-gradient(circle_at_35%_28%,var(--color-text-muted),var(--color-text-primary)_62%)] shadow-[0_1px_2px_rgb(0_0_0/0.3),0_3px_6px_-1px_rgb(0_0_0/0.25)]";

/**
 * The stage every demo sits on. A row at its foot says what to do, then what
 * happened: `hint` until the reader touches the stage and `after` is set.
 * Anything marked with `Ping` stops pulsing at the same moment.
 */
export function Frame({
  hint,
  after,
  still = false,
  controls,
  children,
  className,
}: {
  /** what to do, as one short instruction */
  hint: string;
  /** what the reader just saw, once they have touched the stage */
  after?: string | null;
  /** a stage with nothing to press, so the hint carries no cursor */
  still?: boolean;
  /** the demo's own buttons, right of the hint */
  controls?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const root = useRef<HTMLElement>(null);
  const [touched, setTouched] = useState(false);

  /* bound to the node, since the section is a region and not a control */
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const touch = () => setTouched(true);
    el.addEventListener("pointerdown", touch, true);
    el.addEventListener("keydown", touch, true);
    return () => {
      el.removeEventListener("pointerdown", touch, true);
      el.removeEventListener("keydown", touch, true);
    };
  }, []);

  const told = touched && after ? after : null;

  return (
    <section
      ref={root}
      data-frame=""
      data-touched={touched || undefined}
      className="group/frame relative left-1/2 my-12 w-[min(100vw-2rem,46rem)] -translate-x-1/2"
    >
      <div
        /* `select-none`: every gesture here is a press or a drag across type,
           and a drag that misses its target would otherwise paint a selection
           and a pair of carets over the stage */
        /* lit from the top, the call `flip-clock` makes for its table, so the
           objects have a ground to cast on */
        className="flex select-none flex-col rounded-lg bg-[radial-gradient(120%_100%_at_50%_0%,var(--color-bg),var(--color-surface)_45%,var(--color-fill))] shadow-stage ring-1 ring-stroke ring-inset"
      >
        {/* a column, so a child that wants the stage's width gets it and a
            child that centres itself still can */}
        <div
          className={cn(
            "flex min-h-76 flex-col justify-center px-6 py-10 sm:min-h-100 sm:px-14 sm:py-14",
            className,
          )}
        >
          {children}
        </div>
        {/* flat on purpose: a raised tray stacked its shadows on the stage's own
            at the foot of every demo */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-stroke border-t py-2.5 pr-3 pl-4">
          <p className="flex min-h-9 min-w-0 flex-1 basis-40 items-center gap-2 text-meta text-text-secondary">
            {still ? null : (
              <CursorClickIcon
                aria-hidden="true"
                className={cn(
                  "size-3.5 shrink-0 transition-opacity duration-200",
                  told ? "opacity-0" : "opacity-100",
                )}
              />
            )}
            {/* both lines share one cell, so the row holds its height */}
            <span aria-live="polite" className="grid min-w-0">
              <span
                className={cn(
                  "transition-opacity duration-200 [grid-area:1/1]",
                  told ? "opacity-0" : "opacity-100",
                )}
              >
                {hint}
              </span>
              <span
                className={cn(
                  "text-text-primary transition-opacity duration-200 [grid-area:1/1]",
                  told ? "opacity-100" : "opacity-0",
                )}
              >
                {told ?? ""}
              </span>
            </span>
          </p>
          {controls ? (
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              {controls}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/**
 * A ring that breathes out from the place to start, until the reader touches
 * the stage. It takes its parent's radius, so it follows the control's own
 * shape. A dot in the corner read as a notification badge. The parent is
 * `relative`, and `--ping` is how far the ring travels.
 */
export function Ping({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 rounded-[inherit] shadow-[0_0_0_2px_color-mix(in_srgb,var(--color-text-primary)_20%,transparent)] motion-safe:animate-[start-here_2.2s_ease-out_infinite] group-data-touched/frame:hidden",
        className,
      )}
    />
  );
}

/** A share of something, as a bar in a slot. */
export function Meter({ value }: { value: number | null }) {
  return (
    <div className={cn("h-2 w-40 overflow-hidden rounded-full", WELL)}>
      <div
        className="h-full origin-left rounded-full bg-text-primary transition-transform duration-300 ease-out"
        style={{ transform: `scaleX(${value ?? 0})` }}
      />
    </div>
  );
}

/**
 * The site's pill. Rest, hover and press are the three fill steps, the step
 * in is instant and the step back is timed, and nothing scales.
 *
 * `pb-[0.16em]` centres the label on its x-height. A flex row centres the line
 * box, which is built for capitals, and this type is lowercase, so the letters
 * sat 0.08em low: 1px at this size, which "move" shows plainly.
 */
export const PILL =
  "relative inline-flex h-9 cursor-pointer select-none items-center justify-center gap-2 whitespace-nowrap rounded-full bg-fill px-4 pb-[0.16em] text-action font-medium text-text-primary transition-colors duration-200 hover:bg-fill-hover active:bg-fill-active active:duration-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export function Pill({
  className,
  lead = false,
  ...props
}: ComponentProps<"button"> & {
  /** the one control a stage is driven by, dark so it reads first */
  lead?: boolean;
}) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        PILL,
        lead &&
          "bg-text-primary text-bg hover:bg-text-primary/85 active:bg-text-primary/75",
        className,
      )}
    />
  );
}

/**
 * A control whose label is its current value. Pressing it swaps to the next
 * one. The site's answer to a mode selector: two pressed pills each say their
 * own state and spend a row doing it. The arrows are what say a press changes
 * something, and the `aria-label` says the same for a reader with no glyph.
 */
export function Cycle<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T;
  options: readonly T[];
  onChange: (next: T) => void;
  /** what the value is, for the accessible name: "wrap mode" */
  label: string;
  className?: string;
}) {
  const next = options[(options.indexOf(value) + 1) % options.length];
  return (
    <Pill
      aria-label={`${label}: ${value}. Switch to ${next}`}
      onClick={() => onChange(next)}
      className={cn("font-mono", className)}
    >
      <ArrowsLeftRightIcon aria-hidden="true" className="size-3.5 shrink-0" />
      <Morph>{value}</Morph>
    </Pill>
  );
}

/** A number the demo reports about itself. Mono, muted, tabular. */
export function Readout({
  label,
  value,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "inline-flex items-baseline gap-2 font-mono text-meta text-text-muted tabular-nums",
        className,
      )}
    >
      <span>{label}</span>
      <span className="text-text-primary">
        {typeof value === "string" ? <Morph>{value}</Morph> : value}
      </span>
    </p>
  );
}

/** A readout with nothing to report yet. An icon, never a dash. */
export function Empty() {
  return (
    <MinusIcon
      aria-label="not yet measured"
      role="img"
      className="inline-block size-3 text-text-muted"
    />
  );
}

/** A caption under one thing on a stage. Mono, since on this site mono marks a value and a caption names one. */
export function Caption({ children }: { children: ReactNode }) {
  return <p className="font-mono text-meta text-text-muted">{children}</p>;
}

/** The page's own font stack, for a canvas that has to draw the site's type. */
export function bodyFont(size: number, weight = 500): string {
  const family = getComputedStyle(document.body).fontFamily;
  return `${weight} ${size}px ${family}`;
}

/** Two things on one stage, side by side above `sm` and stacked below it. */
export function Pair({ children }: { children: ReactNode }) {
  return <div className="grid gap-12 sm:grid-cols-2 sm:gap-16">{children}</div>;
}

/** The token's value, for a demo that has to compute with a colour. */
export function token(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(`--color-${name}`)
    .trim();
}

/** "#f4f4f5" to [244, 244, 245]. */
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = Number.parseInt(
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h,
    16,
  );
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
