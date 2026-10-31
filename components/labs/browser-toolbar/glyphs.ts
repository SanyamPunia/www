/**
 * The toolbar's icons as path data, each a function of `flat`, how far a press
 * has flattened it, from 0 at rest to 1 held down. Pure, so the same call draws
 * the resting icon and every frame of a press.
 *
 * A press changes the geometry rather than scaling the icon, which is why these
 * are not from the site's set: its icons are solid and have no parts to move.
 * All of them are drawn on the set's 24 unit grid.
 */

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** `dir` is -1 for back, whose tip points left, and 1 for forward */
export function chevron(dir: -1 | 1, flat: number): string {
  const depth = lerp(7.6, 4.9, flat);
  const reach = lerp(7.8, 8.25, flat);
  const tip = 12 + (dir * depth) / 2;
  const foot = 12 - (dir * depth) / 2;
  return `M${foot} ${12 - reach}L${tip} 12L${foot} ${12 + reach}`;
}

/** Five points, centred on the box so the fill can grow from the middle */
export const STAR = (() => {
  const points: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 8.6 : 3.9;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    points.push(`${12 + r * Math.cos(a)} ${12 + r * Math.sin(a)}`);
  }
  return `M${points.join("L")}Z`;
})();

/**
 * The share arrow is rigid: a press only sinks it toward the tray. The head is
 * narrow enough that its round caps pass between the tray's two ends.
 */
export function shareArrow(flat: number): string {
  const y = 2.2 * flat;
  return `M12 ${14.5 + y}V${3.5 + y}M8.6 ${6.9 + y}L12 ${3.5 + y}L15.4 ${6.9 + y}`;
}

export const SHARE_TRAY =
  "M6.5 10.5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2";

/** Where the sidebar icon's divider sits, minimised and extended */
const PANE_SHUT = 7.2;
const PANE_OPEN = 10.6;

/** `open` runs past 0 and 1 on a spring, and under a press */
export function sidebarPane(open: number): { fill: string; line: string } {
  const x = lerp(PANE_SHUT, PANE_OPEN, open);
  return {
    fill: `M${x} 5H7a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3H${x}Z`,
    line: `M${x} 6V18`,
  };
}

export const WINDOW_RECT = { x: 4, y: 5, width: 16, height: 14, rx: 3 };

type Point = readonly [number, number];

/** A polyline as `count` points evenly spaced along its length */
function resample(line: readonly Point[], count: number): Point[] {
  const lengths = [0];
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = line[i - 1];
    const [bx, by] = line[i];
    lengths.push(lengths[i - 1] + Math.hypot(bx - ax, by - ay));
  }
  const total = lengths[lengths.length - 1];
  const out: Point[] = [];
  let at = 1;
  for (let i = 0; i < count; i++) {
    const want = (total * i) / (count - 1);
    while (at < line.length - 1 && lengths[at] < want) at++;
    const span = lengths[at] - lengths[at - 1];
    const t = span === 0 ? 0 : (want - lengths[at - 1]) / span;
    out.push([
      lerp(line[at - 1][0], line[at][0], t),
      lerp(line[at - 1][1], line[at][1], t),
    ]);
  }
  return out;
}

const STROKE_POINTS = 44;
const ARC_SWEEP = 313.5;

/** The ring, clockwise from three o'clock, then its short run into the head */
const ARC: Point[] = [
  ...Array.from({ length: 80 }, (_, i): Point => {
    const a = (((i / 79) * ARC_SWEEP) / 180) * Math.PI;
    return [12 + 8 * Math.cos(a), 12 + 8 * Math.sin(a)];
  }),
  [20, 8.6],
];
const HEAD: Point[] = [
  [20, 3.8],
  [20, 8.6],
  [15.2, 8.6],
];

/**
 * Reload and the stop are one drawing: the ring uncurls into one stroke of the
 * X and the arrowhead opens into the other, point for point, so nothing has to
 * be swapped. 0 is reload and 1 is the stop.
 */
const RING_TO_STROKE = [
  resample(ARC, STROKE_POINTS),
  resample(
    [
      [17.5, 17.5],
      [6.5, 6.5],
    ],
    STROKE_POINTS,
  ),
] as const;
const HEAD_TO_STROKE = [
  resample(HEAD, STROKE_POINTS),
  resample(
    [
      [17.5, 6.5],
      [6.5, 17.5],
    ],
    STROKE_POINTS,
  ),
] as const;

function between([from, to]: readonly [Point[], Point[]], t: number): string {
  const points = from.map(
    ([x, y], i) => `${lerp(x, to[i][0], t)} ${lerp(y, to[i][1], t)}`,
  );
  return `M${points.join("L")}`;
}

export function reloadMorph(t: number): readonly [string, string] {
  return [between(RING_TO_STROKE, t), between(HEAD_TO_STROKE, t)];
}
