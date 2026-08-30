"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";
import type { Settings } from "./rain";

/**
 * The panel under the stage.
 *
 * **This is a parameter panel, not a mode selector.** The site's answer to a
 * mode is one control whose label is its current value, which `book-opening`
 * documents at length, and it holds here too: the transport below is one pill
 * that says whether the rain is running. Six continuous numbers are a different
 * problem. Each of them has a range you want to feel your way along rather than
 * a state you want to name, and there is nothing to swap between, so each gets a
 * lane and its own live readout.
 *
 * The readouts are mono and `tabular-nums` for the reason every other readout on
 * the site is: they are variables rather than copy, and a proportional digit
 * makes a lane twitch sideways while you are dragging it.
 */
interface Knob {
  key: keyof Settings;
  label: string;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
}

const times = (value: number) => `${value.toFixed(2)}×`;

export const KNOBS: readonly Knob[] = [
  {
    key: "rate",
    label: "rate",
    min: 0.4,
    max: 16,
    step: 0.2,
    format: (value) => `${value.toFixed(1)}/s`,
  },
  { key: "fall", label: "fall", min: 0.3, max: 2.4, step: 0.05, format: times },
  { key: "size", label: "size", min: 0.5, max: 2.2, step: 0.05, format: times },
  {
    key: "splash",
    label: "splash",
    min: 0.3,
    max: 2.2,
    step: 0.05,
    format: times,
  },
  {
    /*
     * `spray` and not `specks`, which is what it was called and what the readout
     * in the bar counts. One word cannot be both how many pieces a splash throws
     * and how many are in the air right now.
     */
    key: "spray",
    label: "spray",
    min: 6,
    max: 200,
    step: 1,
    format: (value) => value.toFixed(0),
  },
  {
    key: "fade",
    label: "fade",
    min: 0,
    max: 1,
    step: 0.02,
    /* the one lane with an off position, and it needs to say so */
    format: (value) => (value === 0 ? "off" : value.toFixed(2)),
  },
];

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
function Lane({
  knob,
  value,
  onChange,
}: {
  knob: Knob;
  value: number;
  onChange: (value: number) => void;
}) {
  const id = useId();
  const filled = (value - knob.min) / (knob.max - knob.min);

  return (
    <div className="flex flex-col gap-2">
      {/*
       * **The number outranks its label, and it used to be the other way
       * round.** The label is a fixed word and the number is the thing under
       * the hand, so the number takes `text-primary` at 15.4:1 and the label
       * sits at `text-secondary`'s 5.28. It also separates the two kinds of
       * number in this strip: what you set is primary, what the piece reports
       * stays `text-muted` in the row below.
       *
       * The label does not go all the way down to `text-muted`. At 2.86:1 it is
       * a caption tone, and this is the accessible name of a control.
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
          className="pointer-events-none absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-fill-active"
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
          onChange={(event) => onChange(Number(event.target.value))}
          className={cn(
            // `rounded-full` is for the focus ring alone. The input paints
            // nothing, but without a radius the ring is a hard rectangle around
            // a fully rounded track, and the only square corner in the piece.
            "absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-full bg-transparent transition-all duration-200",
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
 * Six lanes in two rows, three across once the container has the width.
 *
 * **The gutters are wide for a reason and not to taste.** A lane is a label, a
 * number and a track, so three of them across a 540px column put nine things on
 * one line, and at this project's scale, where a step is 3.2px, the tidy-looking
 * gaps are the ones that let a readout sit closer to the next lane's label than
 * to its own track. The column gutter is what says which number belongs to which
 * word, and the row gutter is what stops two rows of lanes reading as one block
 * of six.
 *
 * **The lanes are not grouped, and the panel is closed by default instead.**
 * Naming two groups was the other way to stop six identical lanes reading as a
 * wall, and it worked, at the price of a strip taller than the thing it
 * controls. A disclosure costs nothing at rest.
 */
export function Panel({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (key: keyof Settings, value: number) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-5 @md:grid-cols-3">
      {KNOBS.map((knob) => (
        <Lane
          key={knob.key}
          knob={knob}
          value={settings[knob.key]}
          onChange={(value) => onChange(knob.key, value)}
        />
      ))}
    </div>
  );
}

/**
 * The transport's buttons, in two weights.
 *
 * **The transport leads and the housekeeping follows.** All three used to be
 * the same pill, so the control that runs the whole piece looked like the one
 * that restores six defaults. `lead` is the filled dark pill the signature
 * player's transport uses, which is the site's existing answer to "this is the
 * primary control of a demo", and the other two drop to a quiet fill beside it.
 *
 * **The quiet pill carries its hover on the text, not on the fill.** `bg-fill`
 * to `bg-fill-hover` is 1.04:1, which is a step that exists in the token table
 * and not on the screen. The light greys are compressed enough that no pair of
 * them reads at this size, so the tone does the work: `text-secondary` to
 * `text-primary` is 5.28 to 15.4, the same hover `InlineLink` uses. The
 * background step stays under it, in the documented order, supporting rather
 * than carrying.
 *
 * **`tune` is a quiet pill and not a lead one**, even though it is the way into
 * six of the nine controls. Two filled pills in one bar is two answers to the
 * question of what the primary control is, and the transport is the one that
 * runs the piece.
 *
 * **Neither clear nor reset asks first.** The shared rule is for a record with
 * something to lose. Clearing a canvas the rain refills in a few seconds is the
 * cheap-to-reverse case the same rule exempts, and a confirm dialog over a toy
 * is the kind of chrome that makes it stop being one.
 */
export function Pill({
  onClick,
  label,
  lead = false,
  expanded,
  controls,
  children,
}: {
  onClick: () => void;
  /**
   * Spelled out where the visible label is a morphing word. `torph` swaps the
   * text a glyph at a time, so what a reader is handed mid-swap is whatever
   * half of two words is on screen. Where the label is a plain word this stays
   * off, since a second name for the same button is a way for the two to drift.
   */
  label?: string;
  /** the one control the demo is about, rather than one that tidies up after it */
  lead?: boolean;
  /** set on a trigger that opens something, which is what holds its hover */
  expanded?: boolean;
  controls?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-expanded={expanded}
      aria-controls={controls}
      onClick={onClick}
      className={cn(
        "flex h-7 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-meta transition-colors duration-200",
        lead
          ? "bg-text-primary text-bg hover:bg-text-primary/85 active:bg-text-primary/70"
          : cn(
              "bg-fill text-text-secondary hover:bg-fill-hover hover:text-text-primary active:bg-fill-active",
              /*
               * A trigger that lets go while the thing it opened is still open
               * is the site's own bug. `aria-expanded:` only matches a button
               * carrying the attribute, so this is inert on the three pills
               * that open nothing.
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
