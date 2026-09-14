"use client";

import { type Knob, Lane } from "@/components/lab/controls";
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

export function Panel({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (key: keyof Settings, value: number) => void;
}) {
  return (
    <div className="grid w-full grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-1 sm:gap-y-5">
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
