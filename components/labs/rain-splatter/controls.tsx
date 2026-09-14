"use client";

import { type Knob, Lane } from "@/components/lab/controls";
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
type Key = keyof Settings;

const times = (value: number) => `${value.toFixed(2)}×`;

export const KNOBS: readonly Knob<Key>[] = [
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
