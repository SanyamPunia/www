"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * The parameter controls a demo hands its reader: one lane per number, and the
 * pills that sit beside them.
 *
 * Promoted here when `pixel-reveal` became the second caller. It lives in
 * `components/lab/` rather than `components/ui/` because it is lab chrome and
 * not a site primitive: nothing outside an experiment has a use for it.
 *
 * **These are parameter panels, not mode selectors.** The site's answer to a
 * mode is one control whose label is its current value, which `book-opening`
 * documents at length. A continuous number is a different problem. It has a
 * range you want to feel your way along rather than a state you want to name,
 * and there is nothing to swap between, so each gets a lane and a live readout.
 *
 * The readouts are mono and `tabular-nums` for the reason every other readout on
 * the site is: they are variables rather than copy, and a proportional digit
 * makes a lane twitch sideways while you are dragging it.
 */

export interface Knob<K extends string> {
  key: K;
  label: string;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
}

export const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2";

/**
 * One lane: a label, a live value, and a range over a track it does not paint.
 *
 * Same build as the signature player's scrubber. The range lies over the lane at
 * full size, paints nothing but its thumb, and everything under it is inert, so
 * the keyboard, the step and the drag behaviour are all the native ones and only
 * the look is ours.
 *
 * The fill is a `scaleX` inside a clipping track rather than a width, so a drag
 * moves a transform instead of relaying out the lane on every frame of it.
 */
export function Lane<K extends string>({
  knob,
  value,
  onChange,
  disabled = false,
}: {
  knob: Knob<K>;
  value: number;
  onChange: (value: number) => void;
  /** set while the demo is busy, so a knob that cannot take effect says so */
  disabled?: boolean;
}) {
  const id = useId();
  const filled = (value - knob.min) / (knob.max - knob.min);

  return (
    <div
      className={cn(
        "flex flex-col gap-2 transition-opacity duration-200",
        disabled && "opacity-50",
      )}
    >
      {/*
       * **The number outranks its label.** The label is a fixed word and the
       * number is the thing under the hand, so the number takes `text-primary`
       * at 15.4:1 and the label sits at `text-secondary`'s 5.28. It also
       * separates the two kinds of number in a strip: what you set is primary,
       * what the piece reports about itself stays muted.
       *
       * The label does not go all the way down to `text-muted`. At 2.86:1 that
       * is a caption tone, and this is the accessible name of a control.
       */}
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-meta text-text-secondary">
          {knob.label}
        </label>
        <span className="font-mono text-meta text-text-primary tabular-nums">
          {knob.format(value)}
        </span>
      </div>

      <div className="relative h-5">
        <div
          aria-hidden="true"
          className="-translate-y-1/2 pointer-events-none absolute inset-x-0 top-1/2 h-1 overflow-hidden rounded-full bg-fill-active"
        >
          <div
            style={{ transform: `scaleX(${filled})` }}
            className="h-full origin-left bg-text-muted"
          />
        </div>

        <input
          id={id}
          type="range"
          min={knob.min}
          max={knob.max}
          step={knob.step}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value))}
          className={cn(
            // `rounded-full` is for the focus ring alone. The input paints
            // nothing, but without a radius the ring is a hard rectangle around
            // a fully rounded track, and the only square corner in the piece.
            "absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-full bg-transparent transition-all duration-200",
            "disabled:cursor-not-allowed",
            "[&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-text-primary",
            "[&::-moz-range-track]:bg-transparent",
            "[&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-text-primary",
            FOCUS,
          )}
        />
      </div>
    </div>
  );
}

/**
 * A demo's buttons, in two weights.
 *
 * **The primary control leads and the housekeeping follows.** `lead` is the
 * filled dark pill the signature player's transport uses, which is the site's
 * existing answer to "this is the primary control of a demo", and everything
 * beside it drops to a quiet fill.
 *
 * **The quiet pill carries its hover on the text, not on the fill.** `bg-fill`
 * to `bg-fill-hover` is 1.04:1, a step that exists in the token table and not on
 * the screen. The light greys are compressed enough that no pair of them reads
 * at this size, so the tone does the work: `text-secondary` to `text-primary` is
 * 5.28 to 15.4, the same hover `InlineLink` uses. The background step stays
 * under it, supporting rather than carrying.
 */
export function Pill({
  onClick,
  label,
  lead = false,
  icon = false,
  disabled = false,
  expanded,
  controls,
  children,
  ...rest
}: {
  onClick: () => void;
  /**
   * Spelled out wherever the button has no plain word of its own to be named
   * by: an icon-only control, and one whose visible label is morphing, since
   * `torph` swaps the text a glyph at a time and what a reader is handed
   * mid-swap is whatever half of two words is on screen. Where the label is a
   * plain word this stays off, since a second name for the same button is a way
   * for the two to drift.
   */
  label?: string;
  /** the one control the demo is about, rather than one that tidies up after it */
  lead?: boolean;
  /** square, for a control whose glyph is the whole of it */
  icon?: boolean;
  disabled?: boolean;
  /** set on a trigger that opens something, which is what holds its hover */
  expanded?: boolean;
  controls?: string;
  children: React.ReactNode;
} & Omit<React.ComponentProps<"button">, "onClick" | "children">) {
  return (
    /*
     * The rest of the props are spread, and that is what lets a `Tooltip` wrap
     * one of these. Radix's trigger is `asChild`, so it clones the child and
     * hands it the ref and the handlers that open the tooltip, and a component
     * that drops them is a trigger that never fires. `mdx-components.tsx`
     * spreads for the same reason.
     */
    <button
      {...rest}
      type="button"
      aria-label={label}
      aria-expanded={expanded}
      aria-controls={controls}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-7 cursor-pointer items-center rounded-full text-meta transition-colors duration-200",
        /*
         * A square for a glyph, since a pill's horizontal padding round a 11px
         * icon draws a lozenge with a dot in the middle of it. The signature
         * player's transport makes the same split between a control sized for
         * a glyph and one sized for a word.
         */
        icon ? "w-7 justify-center" : "gap-1.5 px-2.5",
        "disabled:cursor-not-allowed disabled:opacity-50",
        lead
          ? "bg-text-primary text-bg hover:bg-text-primary/85 active:bg-text-primary/70"
          : cn(
              "bg-fill text-text-secondary hover:bg-fill-hover hover:text-text-primary active:bg-fill-active",
              /*
               * A trigger that lets go while the thing it opened is still open
               * is the site's own bug. `aria-expanded:` only matches a button
               * carrying the attribute, so this is inert on a pill that opens
               * nothing.
               */
              "aria-expanded:bg-fill-hover aria-expanded:text-text-primary",
            ),
        FOCUS,
      )}
    >
      {children}
    </button>
  );
}
