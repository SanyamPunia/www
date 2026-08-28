import type { ReactNode } from "react";
import type { RecordId } from "./records";

/*
 * A trace per record, and a hue per record.
 *
 * ── the hues ─────────────────────────────────────────────────────────────────
 *
 * **This is the exception four other experiments already take**, and for their
 * reason rather than for vibrance: six cards are built from the same few parts
 * and the colour is what tells them apart, so it carries meaning rather than
 * decorating. The values are not tokens, they live here beside the data they
 * belong to, and nothing else on the site may reach for them. `document-pocket`
 * documents the same split at length.
 *
 * **The hue is the folder, not the type, and that is the second version.** The
 * first put a `mark` on each record's tab label and a wash behind its trace and
 * left every folder white, which spends the colour on two small things and asks
 * the type to carry it. A drawer of coloured folders is what a real filing set
 * looks like, it is a far bigger expression of the same information, and it hands
 * the labels back to `text-primary` where they read at 14:1 rather than at 5.
 *
 * Three values each. `paper` is the folder itself, `edge` its own crease and
 * hairline, and `mark` the one saturated thing on it, which is the trace. The
 * panel a trace sits in is white, since a sheet inside a coloured folder is what
 * a folder holds.
 *
 * **Bright, and the whole point is chroma rather than value.** Five sets came
 * before this one and every one of them was too quiet, so the note worth keeping
 * is what quiet was made of rather than the list of what each looked like: a wash
 * at chroma 0.02 was fog, nine elements inside 12% lightness of each other; a
 * generated set at one lightness and one chroma with the hues spaced evenly round
 * the wheel is a system and not a palette, and even spacing is exactly what makes
 * six colours read as an assortment; and an archival stock of sage, manila and
 * dust blue is a lovely palette for a page that is not this one, where six greyed
 * papers on a grey table read as dust.
 *
 * These are file folder colours: green, amber, sky, aqua, violet and coral, each
 * pushed to where its own hue is clean rather than to a shared chroma, since blue
 * runs out of gamut long before yellow does and matching them flattens the yellow.
 * `text-primary` still lands at 9.8 to 13.2 on every one of them, so nothing here
 * trades legibility for it.
 *
 * Measured: every paper is 1.32 to 1.78 on white and 1.20 to 1.62 on the `fill`
 * ground, `text-primary` on one is 9.8 to 13.2, every edge is 1.30 to 1.59 on its
 * own paper, and every mark is 5.0 to 7.0 on the white sheet, which is the floor
 * for the divider legend that prints in it.
 *
 * **`STOCK` is the dividers' own grey, and it is the one neutral here that is not
 * a token.** `fill-active` is the darkest fill the site has at 1.32 on white, and
 * it left the two dividers lighter than every folder around them, reading as gaps
 * in the pile rather than as cards. This is the same recipe at zero chroma, so it
 * lands at the folders' own weight. It is scoped to this experiment exactly as the
 * hues are.
 *
 * Ordered so no two neighbours in the pile sit near each other in hue.
 *
 * ── the traces ───────────────────────────────────────────────────────────────
 *
 * Each one draws what its note says, in one drawing language: a time axis 200
 * units long by 28 tall, hairlines, and the quiet half of the trace at 45%. They are the
 * reason a record card is worth opening, since three lines of type in a box is
 * not.
 *
 * **The viewBox stretches and the strokes do not.** `preserveAspectRatio="none"`
 * lets a trace fill a panel from 166px to 345px wide, which is right for a time
 * axis and wrong for a hairline, so every shape carries `vector-effect:
 * non-scaling-stroke` and keeps its own weight at any width. It is set in CSS
 * rather than per shape, since the attribute does not inherit.
 *
 * Nothing here is random at runtime. `wobble` is a hash, so a trace is the same
 * drawing on every render and in every session.
 */

export const TONE: Record<
  RecordId,
  { paper: string; edge: string; mark: string }
> = {
  "alder-line": { paper: "#9ae6a0", edge: "#5fcc6d", mark: "#15803d" },
  "brackish-flats": { paper: "#ffdd7a", edge: "#f0bf3d", mark: "#b45309" },
  holloway: { paper: "#9fd3ff", edge: "#5eb0f7", mark: "#1d4ed8" },
  "kettle-pond": { paper: "#8fe7dc", edge: "#4fcfc0", mark: "#0f766e" },
  "salt-marsh": { paper: "#cfb6ff", edge: "#a986f5", mark: "#7e22ce" },
  "weather-mast": { paper: "#ffb4a2", edge: "#f78a6f", mark: "#c2410c" },
};

/**
 * The dividers' card stock: white paper on the site's own hairline.
 *
 * **Grey was left over from the version where every folder was white**, and among
 * six bright ones it read as the one card that had not been updated. White is the
 * unpainted stock a real index divider is cut from, it is the ground the group's
 * hue dots need to read against, and it puts the two dividers in the same family
 * as the sheets inside the folders rather than in the case's.
 */
export const STOCK = { paper: "#ffffff", edge: "#dcdcdc" };

const W = 200;
const H = 28;
const MID = H / 2;

/** a deterministic wobble in 0..1, so a trace is drawn the same way every time */
function wobble(i: number, seed: number): number {
  const x = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function line(points: [number, number][]): string {
  return points
    .map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`)
    .join("");
}

function Trace({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="h-7 w-full [&_*]:[vector-effect:non-scaling-stroke]"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

/** wind through a hedge, and a train that arrives and passes */
function AlderLine() {
  return (
    <Trace>
      {Array.from({ length: 46 }, (_, i) => {
        const t = i / 45;
        const train = Math.exp(-((t - 0.58) ** 2) / 0.012);
        const h = (0.16 + wobble(i, 1) * 0.14 + train * 0.78) * (MID - 1.5);
        const x = 2 + t * (W - 4);
        return (
          <line
            key={x}
            x1={x}
            y1={MID - h}
            x2={x}
            y2={MID + h}
            opacity={train > 0.25 ? 1 : 0.45}
          />
        );
      })}
    </Trace>
  );
}

/** low tide: the mud clicking for a while, and then two gulls over it */
function BrackishFlats() {
  const base = H - 5;
  return (
    <Trace>
      <line x1={2} y1={base} x2={W - 2} y2={base} opacity={0.45} />
      {Array.from({ length: 34 }, (_, i) => {
        const x = 4 + wobble(i, 3) * 6 + i * 3.4;
        const h = 3 + wobble(i, 5) * 9;
        return (
          <line key={x} x1={x} y1={base} x2={x} y2={base - h} opacity={0.45} />
        );
      })}
      <path d={`M${W * 0.63} 14C${W * 0.68} 4 ${W * 0.73} 4 ${W * 0.78} 14`} />
      <path d={`M${W * 0.78} 20C${W * 0.83} 9 ${W * 0.88} 9 ${W * 0.93} 20`} />
    </Trace>
  );
}

/** rain on beech, twelve feet below the field: vertical, and all of it at once */
function Holloway() {
  return (
    <Trace>
      {Array.from({ length: 52 }, (_, i) => {
        const x = 3 + i * 3.8 + wobble(i, 7) * 2;
        const top = 2 + wobble(i, 11) * 16;
        return (
          <line
            key={x}
            x1={x}
            y1={top}
            x2={x}
            y2={top + 6 + wobble(i, 13) * 8}
            opacity={0.45}
          />
        );
      })}
      <line x1={2} y1={H - 3} x2={W - 2} y2={H - 3} />
    </Trace>
  );
}

/** ice giving way: flat, one crack, then the water under it settling */
function KettlePond() {
  const shiver = Array.from({ length: 26 }, (_, i): [number, number] => {
    const x = W * 0.46 + i * ((W * 0.52) / 25);
    const decay = Math.exp(-i / 9);
    return [x, MID + (wobble(i, 17) - 0.5) * 13 * decay];
  });
  return (
    <Trace>
      <path
        d={line([
          [2, MID],
          [W * 0.4, MID],
        ])}
        opacity={0.45}
      />
      <path
        d={line([
          [W * 0.4, MID],
          [W * 0.42, 4],
          [W * 0.44, H - 4],
          [W * 0.46, MID],
        ])}
      />
      <path d={line(shiver)} opacity={0.45} />
    </Trace>
  );
}

/** wind with nothing to catch on, and one bell east of it */
function SaltMarsh() {
  const swell = Array.from({ length: 80 }, (_, i): [number, number] => {
    const x = 2 + (i * (W - 4)) / 79;
    return [x, MID + Math.sin(i / 7) * 3 + Math.sin(i / 2.3) * 1.4];
  });
  const ring = Array.from({ length: 40 }, (_, i): [number, number] => {
    const x = W * 0.68 + i * ((W * 0.3) / 39);
    return [x, MID + Math.sin(i / 1.1) * 11 * Math.exp(-i / 11)];
  });
  return (
    <Trace>
      <path d={line(swell)} opacity={0.45} />
      <line x1={W * 0.68} y1={MID - 12} x2={W * 0.68} y2={MID + 12} />
      <path d={line(ring)} />
    </Trace>
  );
}

/** two guy wires humming a fourth apart, which is three against four */
function WeatherMast() {
  const wave = (cycles: number, amp: number) =>
    line(
      Array.from({ length: 100 }, (_, i): [number, number] => {
        const x = 2 + (i * (W - 4)) / 99;
        return [x, MID + Math.sin((i / 99) * cycles * Math.PI * 2) * amp];
      }),
    );
  return (
    <Trace>
      <path d={wave(3, 10)} opacity={0.45} />
      <path d={wave(4, 6)} />
    </Trace>
  );
}

/**
 * A group's tape, as one wave shared out by length.
 *
 * The same bars a record's trace is drawn with, run across the whole group, with
 * each stretch in the colour of the file it belongs to and as wide as that file is
 * long. A divider then shows what a record shows, which is the point: every card
 * in this drawer opens onto a wave.
 */
export function GroupWave({
  files,
}: {
  files: { id: RecordId; seconds: number }[];
}) {
  const total = files.reduce((sum, file) => sum + file.seconds, 0);
  let run = 0;
  const spans = files.map((file) => {
    const from = run / total;
    run += file.seconds;
    return { id: file.id, from, to: run / total };
  });

  return (
    <Trace>
      {Array.from({ length: 46 }, (_, i) => {
        const t = i / 45;
        const span = spans.find((s) => t <= s.to) ?? spans[spans.length - 1];
        const h = (0.3 + wobble(i, 23) * 0.62) * (MID - 1.5);
        const x = 2 + t * (W - 4);
        return (
          <line
            key={x}
            x1={x}
            y1={MID - h}
            x2={x}
            y2={MID + h}
            stroke={span ? TONE[span.id].mark : "currentColor"}
          />
        );
      })}
    </Trace>
  );
}

/**
 * Typed against the record list, so a record without a trace is a compile error
 * rather than an empty box.
 */
export const MOTIF: Record<RecordId, () => ReactNode> = {
  "alder-line": AlderLine,
  "brackish-flats": BrackishFlats,
  holloway: Holloway,
  "kettle-pond": KettlePond,
  "salt-marsh": SaltMarsh,
  "weather-mast": WeatherMast,
};
