"use client";

import {
  ArrowsLeftRightIcon,
  CursorClickIcon,
  MinusIcon,
} from "@phosphor-icons/react";
import type { ComponentProps, ReactNode } from "react";
import { TextMorph } from "torph/react";
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
 * The parts every demo in this post is built from: the frame with its task
 * line, the site's own pill as a button, a readout in mono, and a control that
 * shows its current value and swaps on press.
 *
 * Colocated because only this post uses them. If a second post wants the same
 * task-line frame it moves to `components/blogs/`.
 */

/**
 * The stage every demo sits on.
 *
 * The `Demo` frame's hairline box, white, in three fixed rows. The gesture in
 * two to four words in the top left corner, the subject centred, the demo's
 * controls in the bottom right. Both outer rows hold the same height whether or
 * not they have anything in them, so the subject sits at the same place on
 * every stage and the stages line up down the post.
 *
 * No task sentence and no caption. Earlier versions carried a sentence above
 * the box, a paragraph under it, then header and footer bands, then a dot grid
 * as a material. All of it read as chrome around the thing. The prose above
 * the stage makes the argument. The stage shows the thing and reports the
 * number.
 */
export function Frame({
  label,
  controls,
  readouts,
  children,
  className,
}: {
  /** the gesture, in a few words: "press and hold" */
  label: string;
  /** the demo's own buttons, bottom right */
  controls?: ReactNode;
  /** what the demo reports about itself, bottom left, mirroring the controls */
  readouts?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section data-frame="" className="my-8">
      <div
        /* `select-none`: every gesture here is a press or a drag across type,
           and a drag that misses its target would otherwise paint a selection
           and a pair of carets over the stage */
        /* `shadow-stage` is what lifts it off the page. The ring stays, since
           a shadow this faint does not draw an edge on white and the top of a
           lifted box has no shadow at all. */
        className="grid min-h-72 select-none grid-rows-[auto_1fr_auto] rounded-lg bg-bg shadow-stage ring-1 ring-stroke ring-inset"
      >
        <div className="flex min-h-11 items-center px-3">
          <p className="inline-flex items-center gap-1.5 px-1.5 font-mono text-meta text-text-muted">
            <CursorClickIcon aria-hidden="true" className="size-3.5 shrink-0" />
            {label}
          </p>
        </div>
        {/* a column, so a child that wants the stage's width gets it and a
            child that centres itself still can. `justify-center` is the
            vertical centring. */}
        <div
          className={cn("flex flex-col justify-center px-6 py-2", className)}
        >
          {children}
        </div>
        {/* readouts left, controls right. Every stage reports in the same
            corner and is driven from the opposite one, so the eye learns the
            two places once. */}
        <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 pb-2">
          <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 px-1.5">
            {readouts}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {controls}
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * The site's pill. Rest, hover and press are the three fill steps, the step
 * in is instant and the step back is timed, and nothing scales.
 */
export const PILL =
  "inline-flex h-9 cursor-pointer select-none items-center justify-center gap-2 whitespace-nowrap rounded-full bg-fill px-4 text-action font-medium text-text-primary transition-colors duration-200 hover:bg-fill-hover active:bg-fill-active active:duration-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export function Pill({ className, ...props }: ComponentProps<"button">) {
  return <button type="button" {...props} className={cn(PILL, className)} />;
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
  return <div className="grid gap-6 sm:grid-cols-2">{children}</div>;
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
