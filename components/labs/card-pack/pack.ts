/*
 * The pack's geometry and the tear, pure and DOM-free. Every length is in the
 * pack's own pixels, origin at its top left.
 */

/** the pack's face */
export const W = 250;
export const H = 344;

/** where the perforation runs, under the top crimp */
export const TEAR = 46;

/** the sealed bands at the top and bottom, where the foil is pressed shut */
export const CRIMP = 18;

/** how far the perforation wanders off its line either way */
const JAG = 3;

/** how many teeth the tear line has across the pack */
const TEETH = 26;

/** a card */
export const CW = 176;
export const CH = 252;
/** a trading card's corner: 3mm on a 63mm card */
export const CR = 9;

export type Point = readonly [number, number];
export type Side = "left" | "right";

/** mulberry32, so a pack's tear line and its cards come out the same per id */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The tear line, left to right. The two ends sit on the line itself, so the
 * pack's outline stays straight at the edges where the tear starts.
 */
export function jagOf(seed: number): Point[] {
  const r = rng(seed * 7919 + 1);
  const points: Point[] = [];
  for (let i = 0; i <= TEETH; i++) {
    const x = (i / TEETH) * W;
    const edge = i === 0 || i === TEETH;
    points.push([x, edge ? TEAR : TEAR + (r() * 2 - 1) * JAG]);
  }
  return points;
}

/** the tear line's height at `x` */
export function yAt(jag: readonly Point[], x: number): number {
  const step = W / (jag.length - 1);
  const i = Math.min(jag.length - 2, Math.max(0, Math.floor(x / step)));
  const [x0, y0] = jag[i];
  const [x1, y1] = jag[i + 1];
  const t = (x - x0) / (x1 - x0);
  return y0 + (y1 - y0) * t;
}

/** where the tear has reached, from the edge it started at */
export function frontOf(side: Side, p: number): number {
  return side === "left" ? p * W : W - p * W;
}

const px = (points: readonly Point[]) =>
  `polygon(${points.map(([x, y]) => `${x.toFixed(2)}px ${y.toFixed(2)}px`).join(", ")})`;

/** the pitch and depth of the teeth a heat seal presses into the edge */
const SERRATION = 5;
const TOOTH = 2.2;

/**
 * The serrated edge at height `y`, from `a` to `b`. The teeth point outward,
 * up at the top and down at the bottom, so `dir` is -1 or 1.
 */
function serrate(a: number, b: number, y: number, dir: 1 | -1): Point[] {
  const points: Point[] = [[a, y]];
  for (let x = Math.ceil(a / SERRATION) * SERRATION; x < b; x += SERRATION) {
    const out = Math.round(x / SERRATION) % 2 === 1;
    points.push([x, out ? y + dir * TOOTH : y]);
  }
  points.push([b, y]);
  return points;
}

/**
 * How far a filled pack's side draws in at height `y`. The seals are pressed
 * flat at full width, and between them the fill takes up material, so the
 * sides bow inward toward the middle. That curve is most of what makes the
 * outline read as a pillow and not a card.
 */
const SIDE = 5;
const SIDE_STEPS = 24;

export function sideInset(y: number): number {
  const t = Math.min(1, Math.max(0, (y - CRIMP) / (H - CRIMP * 2)));
  return SIDE * Math.sin(Math.PI * t);
}

/** one side of the body, top to bottom, at the inset it draws in by */
function sidePoints(right: boolean): Point[] {
  const points: Point[] = [];
  for (let i = 0; i <= SIDE_STEPS; i++) {
    const y = TEAR + ((H - CRIMP - TEAR) * i) / SIDE_STEPS;
    const inset = sideInset(y);
    points.push([right ? W - inset : inset, y]);
  }
  return points;
}

/** everything under the tear line, with the sides drawn in */
export function bodyClip(jag: readonly Point[]): string {
  const top = jag.map(
    ([x, y], i): Point =>
      i === 0
        ? [sideInset(y), y]
        : i === jag.length - 1
          ? [W - sideInset(y), y]
          : [x, y],
  );
  return px([
    ...top,
    ...sidePoints(true).slice(1),
    ...serrate(0, W, H - TOOTH, 1).reverse(),
    ...sidePoints(false).reverse().slice(0, -1),
  ]);
}

/**
 * How much higher the back panel's torn edge sits than the front's, as seen.
 * The strip takes both layers off along the same line, and the pack is laid
 * back a little, so the back's edge shows just above the front's.
 */
export const BACK_RISE = 10;

/**
 * The mouth of an opened pack: the inside face of the back panel, from its
 * torn edge down behind the front. Nothing of the pack is above it, which is
 * what an open pack looks like.
 */
export function mouthClip(jag: readonly Point[]): string {
  // held inside the body's drawn-in sides, which it otherwise poked out past
  // below the tear line as a grey sliver on each side
  const inside = ([x, y]: Point): Point => {
    const inset = sideInset(y) + 0.5;
    return [Math.min(W - inset, Math.max(inset, x)), y];
  };
  return px([
    ...jag.map(([x, y]) => inside([x, y - BACK_RISE])),
    ...jag.map(([x, y]) => inside([x, y + 48])).reverse(),
  ]);
}

/** the back panel's torn edge, for the light along it */
export function mouthEdge(jag: readonly Point[]): string {
  return `M${jag.map(([x, y]) => `${x.toFixed(2)} ${(y - BACK_RISE).toFixed(2)}`).join("L")}`;
}

/** a side of the body as an SVG path, for the light along its edge */
export function sidePath(right: boolean): string {
  return `M${sidePoints(right)
    .map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`)
    .join("L")}`;
}

/**
 * The strip above the tear line between `a` and `b`. Empty when the two meet,
 * which is the torn piece before a tear starts and the held piece after it
 * ends.
 */
export function capClip(jag: readonly Point[], a: number, b: number): string {
  if (b - a < 0.01) return "polygon(0px 0px, 0px 0px, 0px 0px)";
  const inside = jag.filter(([x]) => x > a && x < b).reverse();
  return px([
    ...serrate(a, b, TOOTH, -1),
    [b, yAt(jag, b)],
    ...inside,
    [a, yAt(jag, a)],
  ]);
}

/** the torn piece and the piece still holding, as [from, to] spans */
export function spans(
  side: Side,
  p: number,
): { torn: [number, number]; held: [number, number] } {
  const f = frontOf(side, p);
  return side === "left"
    ? { torn: [0, f], held: [f, W] }
    : { torn: [f, W], held: [0, f] };
}

/** the tear line from `a` to `b` as an SVG path, for the torn and the perforated parts */
export function linePath(jag: readonly Point[], a: number, b: number): string {
  if (b - a < 0.5) return "";
  const inside = jag.filter(([x]) => x > a && x < b);
  const points: Point[] = [[a, yAt(jag, a)], ...inside, [b, yAt(jag, b)]];
  return `M${points.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join("L")}`;
}

/**
 * How far the torn piece turns up, in degrees, while it is held. A strip that
 * has only just started tearing barely lifts, and lifting the hand lifts it
 * further, up to the point where it would fold back over the pack.
 */
export function liftOf(p: number, rise: number): number {
  return Math.min(48, 6 + p * 22 + Math.max(0, rise) * 0.35);
}

/** past this a let-go finishes the tear on its own */
export const FINISH = 0.78;

/**
 * Where each card sits in the fan, centred on the stage. The middle card is
 * nearest and the outer ones turn in toward it and sit further back, so the
 * fan has depth rather than lying flat on the stage.
 */
export function fanOf(
  i: number,
  n: number,
  width: number,
): {
  x: number;
  y: number;
  z: number;
  rotate: number;
  rotateX: number;
  rotateY: number;
} {
  const k = i - (n - 1) / 2;
  const spread = Math.max(56, Math.min(118, (width - CW - 64) / (n - 1)));
  return {
    x: k * spread,
    y: 6 + k * k * 9,
    z: -Math.abs(k) * 52,
    rotate: k * 6,
    rotateX: 6,
    rotateY: -k * 14,
  };
}
