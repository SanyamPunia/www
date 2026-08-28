/*
 * What is in the drawer.
 *
 * One flat ordered list, dividers included, because that is what a card index
 * is: the tabs are in one sequence and a divider is a card like any other. Every
 * other number the demo prints is derived from this in `stack.ts` rather than
 * written twice, so a record's own filing number, the count on each divider and
 * the count on the case cannot disagree with the list they describe.
 *
 * A note is at most 26 characters, and that is a measurement rather than a
 * style. It is the caption under a record's own trace, on one line at every
 * width: the panel it sits in is a fixed height, and at the narrowest column it
 * leaves the note about 30 characters. See `motifs.tsx` for the traces.
 */

/**
 * The records, as a tuple, so `motifs.tsx` can be typed against it: a record
 * without a trace is then a compile error rather than an empty box. The same
 * call `lib/labs.ts` makes with `IMPLEMENTED_LABS`.
 */
export const RECORD_IDS = [
  "alder-line",
  "brackish-flats",
  "holloway",
  "kettle-pond",
  "salt-marsh",
  "weather-mast",
] as const;

export type RecordId = (typeof RECORD_IDS)[number];

export type Entry =
  | { kind: "divider"; id: string; label: string }
  | {
      kind: "record";
      id: RecordId;
      label: string;
      note: string;
      place: string;
      length: string;
    };

/** the archive's own name, printed on the case at the foot of the pile */
export const DRAWER = "Field recordings";

export const ARCHIVE: Entry[] = [
  { kind: "divider", id: "a-h", label: "a–h" },
  {
    kind: "record",
    id: "alder-line",
    label: "Alder line",
    note: "Hedge, then a train.",
    place: "Kent",
    length: "04:12",
  },
  {
    kind: "record",
    id: "brackish-flats",
    label: "Brackish flats",
    note: "Mud clicks, then gulls.",
    place: "Blakeney",
    length: "06:38",
  },
  {
    kind: "record",
    id: "holloway",
    label: "Holloway",
    note: "Rain on beech, all of it.",
    place: "Devon",
    length: "03:55",
  },
  { kind: "divider", id: "k-w", label: "k–w" },
  {
    kind: "record",
    id: "kettle-pond",
    label: "Kettle pond",
    note: "Ice giving way at dawn.",
    place: "Cairngorm",
    length: "05:20",
  },
  {
    kind: "record",
    id: "salt-marsh",
    label: "Salt marsh",
    note: "Wind, and a bell east.",
    place: "Essex",
    length: "07:04",
  },
  {
    kind: "record",
    id: "weather-mast",
    label: "Weather mast",
    note: "Guy wires, a fourth apart.",
    place: "Orkney",
    length: "02:47",
  },
];
