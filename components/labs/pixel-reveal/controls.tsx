"use client";

import { useId } from "react";
import { type Knob, Lane } from "@/components/lab/controls";
import { cn } from "@/lib/utils";
import { PATTERNS } from "./artwork";
import { DEPTH, DRIFT } from "./mosaic";

/**
 * The three numbers worth handing over.
 *
 * Not every constant in `mosaic.ts` is a control. `FLIGHT` and `WAIT` are bound
 * to each other, since a tile that split while still travelling would hand its
 * children a box that is itself moving, and a reader who broke that would only
 * see a glitch. These three change the character and cannot break it.
 */
export interface Settings {
  depth: number;
  run: number;
  drift: number;
}

export const DEFAULTS: Settings = {
  depth: DEPTH.start,
  run: 4.2,
  drift: DRIFT.start,
};

export const KNOBS: readonly Knob<keyof Settings>[] = [
  {
    key: "depth",
    /* the reader thinks in cells across, not in levels of a tree */
    label: "detail",
    min: DEPTH.min,
    max: DEPTH.max,
    step: 1,
    format: (value) => `${1 << value} across`,
  },
  {
    key: "run",
    label: "run",
    min: 1.5,
    max: 9,
    step: 0.1,
    format: (value) => `${value.toFixed(1)}s`,
  },
  {
    /*
     * The one knob with an off position, and it needs to say so. At zero every
     * tile splits on the beat and the picture resolves as a grid stepping
     * through its levels, which is the build this lab replaced. Leaving it
     * reachable is what makes the difference visible rather than asserted.
     */
    key: "drift",
    label: "drift",
    min: DRIFT.min,
    max: DRIFT.max,
    step: 0.02,
    format: (value) => (value === 0 ? "even" : value.toFixed(2)),
  },
];

/**
 * Three across a wide stage, one column on a narrow one, and never two.
 *
 * Two columns leaves the third lane alone beside an empty cell, which is a
 * hollow half whichever way it is dressed, and spanning the odd one across both
 * makes a full-width track under two half ones, which is the same raggedness
 * drawn differently. So three or one, and `rain-splatter` makes the same call
 * for its six.
 *
 * **Three needs the room, which is why it is a container query.** At the
 * column's width a lane gets 137px, where "64 across" and its label come to
 * 106. On a 390px phone the same three would be 104px cells, so the panel
 * stacks and caps itself at the width a lane reads at, since a track as wide as
 * the stage is a progress bar rather than a control.
 */
export function Panel({
  settings,
  onChange,
  disabled = false,
}: {
  settings: Settings;
  onChange: (key: keyof Settings, value: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid w-full max-w-56 gap-5 @md:max-w-none @md:grid-cols-3 @md:gap-x-8">
      {KNOBS.map((knob) => (
        <Lane
          key={knob.key}
          knob={knob}
          value={settings[knob.key]}
          disabled={disabled}
          onChange={(value) => onChange(knob.key, value)}
        />
      ))}
    </div>
  );
}

/**
 * The five pictures, as the pictures.
 *
 * **A swatch is the thing itself, not a name for it.** The site's answer to a
 * discrete choice is one control whose label is its current value, which
 * `book-opening` documents and which the run's own controls follow. That
 * answer is for a value a word can carry. "strata" tells a reader nothing
 * about what they are about to watch resolve, and cycling five of them to find
 * out is four presses of guessing, so the choice is made by looking.
 *
 * **It does not give the run away.** What the demo is about is the order detail
 * arrives in, and a reader who has seen a 42px thumbnail knows the subject and
 * none of that. The board still starts at one flat tile.
 *
 * Real radios, visually hidden inside their labels, which is the build
 * `the-submenu-closes-before-you-get-there` uses for its own single choice: the
 * arrow keys walk the group and the checked state is the browser's rather than
 * ours. A row of buttons carrying `aria-pressed` would say five toggles where
 * there is one setting.
 */
export function PatternStrip({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (slug: string) => void;
  /**
   * Set while a run is in flight. It is a real `<fieldset disabled>`, so the
   * browser takes all five radios out of the tab order and stops answering
   * them, and `group-disabled:` is what carries that to the swatches. Nothing
   * here has to know how many there are.
   */
  disabled?: boolean;
}) {
  const group = useId();

  return (
    <fieldset
      disabled={disabled}
      className="group flex w-full gap-2 transition-opacity duration-200 disabled:opacity-50"
    >
      <legend className="sr-only">Pattern</legend>
      {PATTERNS.map((pattern) => {
        const picked = pattern.slug === value;
        return (
          <label
            key={pattern.slug}
            className={cn(
              "relative flex-1 cursor-pointer overflow-hidden rounded-md transition-all duration-200",
              "group-disabled:cursor-not-allowed",
              /*
               * The ring is the mark and the dim is what makes it read at
               * 42px. A hairline against a 2px ring is a difference a reader
               * has to go looking for when the thing inside each box is a
               * different picture with its own edge.
               */
              picked
                ? "ring-2 ring-text-primary"
                : "opacity-55 ring-1 ring-stroke group-enabled:hover:opacity-100 group-enabled:hover:ring-stroke-strong",
              /*
               * The focus mark is an `outline` and the selection mark is a
               * ring, so the two compose rather than one replacing the other.
               * Both as rings, focusing the picked swatch swapped its black
               * ring for the pale focus one and the strip lost its selection
               * for as long as the keyboard was in it. Same width, colour and
               * offset as the project's focus pattern, drawn on the other
               * property, which is the call `window-shade` makes.
               */
              "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-text-primary/15 has-[:focus-visible]:outline-offset-2",
            )}
          >
            <input
              type="radio"
              name={group}
              value={pattern.slug}
              checked={picked}
              onChange={() => onChange(pattern.slug)}
              className="sr-only"
            />
            {/* biome-ignore lint/performance/noImgElement: a data URI built in
                the browser, which next/image cannot fetch, size or cache */}
            <img
              src={pattern.uri}
              alt=""
              draggable={false}
              className="aspect-square w-full select-none"
            />
            <span className="sr-only">{pattern.name}</span>
          </label>
        );
      })}
    </fieldset>
  );
}
