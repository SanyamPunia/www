/**
 * The burst: a ring, a shower of confetti and a heart, as one function of a
 * clock from 0 to 1.
 *
 * Pure apart from the canvas context it is handed, the split `halftone-ripple`
 * makes with `ripple.ts` and `foil-card` with `foil.ts`.
 *
 * **Everything is drawn about (0, 0), and that is what makes the experiment
 * possible.** The live canvas translates to the heart and paints a frame, and
 * the sprite strip translates to each tile's centre and paints the same frame
 * from the same call. A flipbook baked by different code would look like the
 * live version rather than being it, and the comparison this lab is about would
 * say nothing.
 */

/** a turn */
const TAU = Math.PI * 2;

/**
 * The heart, in a 24 unit box centred on (12, 12).
 *
 * One string, two renderers. The button's resting heart is an SVG `path` in the
 * DOM, so CSS owns the hover and the fill and nothing runs a loop for them, and
 * the burst's heart is this same data in a `Path2D` on the canvas. They have to
 * be one shape: the canvas heart lands at scale 1 and the DOM heart takes over
 * from underneath it, so two different hearts would pop at the end of every
 * press.
 */
export const HEART_PATH =
  "M12 21.1C12 21.1 2.2 14.6 2.2 8.5C2.2 5.2 4.7 3 7.5 3C9.8 3 11.3 4.6 12 6.2C12.7 4.6 14.2 3 16.5 3C19.3 3 21.8 5.2 21.8 8.5C21.8 14.6 12 21.1 12 21.1Z";

/**
 * The box one frame of the burst is drawn into, in CSS px, at the one scale the
 * sheet is baked at. A narrow stage blits the same sheet smaller rather than
 * baking a second one, which is what `background-size` does for the real thing.
 */
export const TILE = 170;

/**
 * The heart's own width at rest, in CSS px, at that same scale. The DOM copy is
 * sized by `--heart` off the stage, and the caller divides the two to get the
 * factor everything here is drawn through, so the drawn heart and the CSS one
 * cannot disagree about how big a heart is.
 */
export const HEART_W = 40;

/**
 * The ring's two hues.
 *
 * Both clear a graphic's 3:1 floor on `bg` and neither does so with room to
 * spare: `#ef4f9a` is 3.36:1 and `#ae6fe0` is 3.41. The ring is the burst's
 * whole form, so it carries the meaning and has to clear the floor, and the
 * first pass sat at 4.46 and 4.71, which on a white page is a saturated donut
 * where the reference draws a light one.
 *
 * Twitter's own ring lightens as it expands, which is right on a dark ground
 * and backwards on a light one, so what travels here is the hue and not the
 * lightness.
 *
 * Scoped to this experiment, not tokens, and nothing else may reach for them.
 */
const RING_HOT = [239, 79, 154] as const;
const RING_COOL = [174, 111, 224] as const;

/** how far the ring's outer edge reaches, in CSS px */
const RING_R = 42;

/** the share of the clock the ring is alive for */
const RING_LIFE = 0.52;

/**
 * When the hole opens, as a share of the ring's own life.
 *
 * **The ring is one stroked circle, not a disc with a smaller disc masked out
 * of it.** `r` grows while `lineWidth` shrinks, so the inner edge at `r - w/2`
 * and the outer at `r + w/2` travel at different rates from one shape. That
 * single stroke is the seed dot, the solid disc, the hole punching through and
 * the annulus thinning away, in that order, and there is no second radius to
 * keep in step with the first.
 *
 * The inner edge is the outer edge times this ramp, so at the end of the ring's
 * life the two meet exactly, the width is zero and the ring is gone without
 * anything having to say so.
 */
const HOLE_AT = 0.28;

/** when the heart starts arriving, and how long it takes, as shares of the clock */
const HEART_IN = 0.3;
const HEART_RUN = 0.34;

/**
 * The confetti's hues, 2.29:1 to 2.99 on `bg`, in this order: 2.77, 2.30, 2.29,
 * 2.99, 2.33 and 2.44.
 *
 * **Deliberately under the 3:1 a graphic needs, because confetti is not one.**
 * The first pass deepened every hue until it cleared that floor, which put the
 * set at 3.41 to 5.18 and drew a shower of hard saturated discs where the
 * reference throws pastel. The floor is for a graphic that carries meaning, and
 * these carry none: the heart says the state and the ring is the burst's form,
 * and both of those clear it.
 */
const CONFETTI = [
  "#5b9df5",
  "#4cbf88",
  "#40bcc1",
  "#ad7ef0",
  "#eb9739",
  "#f87fa8",
] as const;

/**
 * Seven pairs, which is the reference's own count.
 *
 * **The size is the reference's proportion, and the first build was double
 * it.** Measured off the stills a dot is about 0.147 of the heart's width. At
 * a 5.6 base against a 46px heart mine ran 0.21 to 0.36 of it, which is the
 * whole reason the shower read as heavy rather than light. These run 0.12 to
 * 0.21.
 *
 * The reach is the reference's proportion too, and the first build overshot it.
 * Measured off the stills, the furthest dot sits about 1.35 ring diameters out.
 * At 62 against a 42 ring that was 1.69, which threw the confetti clear of the
 * picture and made the burst's envelope 28px taller than it had to be, all of
 * it white space the stage then had to carry at rest.
 *
 * Each pair is an inner dot and an outer one at slightly different angles, so
 * what leaves the ring is two loose clusters rather than one wheel of equals.
 * One ring of evenly spaced dots reads as a starburst and never as confetti.
 */
const PAIRS = 7;

/** where a dot's own clock sits inside the burst's */
const DOT_IN = 0.26;

/**
 * The radius a dot is born at, in CSS px.
 *
 * Confetti thrown by a ring leaves the ring, so it starts at the rim rather
 * than at the centre. Launched from zero the dots spend the first third of
 * their life inside the annulus, which draws them as specks caught in a donut
 * rather than as a shower coming off one: the ring's outer edge is already past
 * 33 by the time the first dot is born, so anything under that is behind it.
 */
const DOT_FROM = 24;

interface Dot {
  angle: number;
  /** how far it gets, in CSS px */
  reach: number;
  /** its widest, in CSS px */
  size: number;
  /** a share of the clock, added to `DOT_IN` */
  start: number;
  /** a share of the clock */
  life: number;
  hue: string;
}

/**
 * One deterministic number in [0, 1) from an integer.
 *
 * An integer hash rather than `Math.sin(x) * 43758.5453`, which `stem-picker`
 * documents measuring and finding degenerate on small integer inputs: it handed
 * five of nine stems the same tilt. Nothing here rolls at runtime either, since
 * a burst that scattered differently on every press would make the flipbook and
 * the live version impossible to compare.
 */
function hash(n: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const DOTS: Dot[] = Array.from({ length: PAIRS * 2 }, (_, i) => {
  const pair = i >> 1;
  const outer = (i & 1) === 1;
  /* the first pair leaves straight up, which is where the reference's does */
  const base = (pair / PAIRS) * TAU - TAU / 4;

  return {
    angle: base + (outer ? -0.14 : 0.11) + (hash(i) - 0.5) * 0.12,
    reach: (outer ? 54 : 38) + hash(i + 71) * 7,
    size: (outer ? 2.4 : 3.2) + hash(i + 149) * 0.9,
    start: hash(i + 211) * 0.07,
    life: 0.5 + hash(i + 307) * 0.16,
    hue: CONFETTI[(pair * 2 + (outer ? 1 : 0)) % CONFETTI.length],
  };
});

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** quadratic out, which is what the reference's ring grows on */
function easeOut(v: number): number {
  const u = 1 - v;
  return 1 - u * u;
}

/**
 * Overshoot and settle. A heart that arrives at exactly its own size has been
 * placed, and one that goes past it and comes back has landed.
 */
function backOut(v: number, s = 1.5): number {
  const u = v - 1;
  return 1 + (s + 1) * u * u * u + s * u * u;
}

/** a straight mix of two sRGB triples, which is safe for two hues this close */
function mix(a: readonly number[], b: readonly number[], v: number): string {
  const r = Math.round(a[0] + (b[0] - a[0]) * v);
  const g = Math.round(a[1] + (b[1] - a[1]) * v);
  const bl = Math.round(a[2] + (b[2] - a[2]) * v);
  return `rgb(${r} ${g} ${bl})`;
}

let heart: Path2D | null = null;

/** built on first use rather than at module scope, since `Path2D` is the DOM's */
function heartPath(): Path2D {
  if (!heart) heart = new Path2D(HEART_PATH);
  return heart;
}

/**
 * The heart, filled in `ink`, at `scale` of its resting width, about (0, 0).
 *
 * **It is stroked as well as filled, and that is what makes the handover
 * exact.** The DOM heart carries `stroke-width: 2` in the same 24 unit box, so
 * its ink runs one unit past the path on every side, and a fill alone comes out
 * 1.67px narrower at full size. The two are the same path and the same colour,
 * so the only way the swap at the end of a burst could be seen was the heart
 * growing a pixel and a half as the canvas let go of it.
 *
 * The width is written in the 24 unit space and the scale is applied first, so
 * it tracks the heart exactly as the SVG's own does.
 */
function fillHeart(
  ctx: CanvasRenderingContext2D,
  scale: number,
  ink: string,
): void {
  const k = (HEART_W / 24) * scale;
  ctx.save();
  ctx.scale(k, k);
  ctx.translate(-12, -12);
  const path = heartPath();
  ctx.fillStyle = ink;
  ctx.fill(path);
  ctx.strokeStyle = ink;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.stroke(path);
  ctx.restore();
}

/** the confetti at `t`, which is the one part of the burst reduced motion keeps */
function confetti(ctx: CanvasRenderingContext2D, t: number): void {
  for (const dot of DOTS) {
    const d = clamp01((t - DOT_IN - dot.start) / dot.life);
    if (d <= 0 || d >= 1) continue;

    /* it grows quickly, holds, and is gone well before it stops travelling */
    const grow = clamp01(d / 0.2);
    const fade = 1 - clamp01((d - 0.45) / 0.55) ** 1.4;
    const size = dot.size * grow * fade;
    if (size < 0.15) continue;

    const r = DOT_FROM + (dot.reach - DOT_FROM) * easeOut(d);
    ctx.beginPath();
    ctx.arc(Math.cos(dot.angle) * r, Math.sin(dot.angle) * r, size, 0, TAU);
    ctx.fillStyle = dot.hue;
    ctx.fill();
  }
}

/**
 * One frame of the burst, about (0, 0). `t` runs 0 to 1.
 *
 * `ink` is the heart's, which the caller reads off its own state rather than
 * this file restating it.
 */
export function paint(
  ctx: CanvasRenderingContext2D,
  t: number,
  ink: string,
): void {
  const u = t / RING_LIFE;
  if (u < 1) {
    const outer = RING_R * easeOut(u);
    /*
     * The hole is a share of the outer edge, so at `u` of 1 the two are equal,
     * the width is zero and the ring has closed on itself. The power opens it
     * quickly and then eases it into meeting the edge it is chasing.
     */
    const inner = outer * clamp01((u - HOLE_AT) / (1 - HOLE_AT)) ** 0.72;
    const w = outer - inner;
    if (w > 0.2) {
      ctx.beginPath();
      ctx.arc(0, 0, (outer + inner) / 2, 0, TAU);
      ctx.lineWidth = w;
      /* the hue shift is over by the time the hole opens, which is what leaves
         a magenta disc and a violet ring rather than one gradient of a shape */
      ctx.strokeStyle = mix(RING_HOT, RING_COOL, easeOut(clamp01(u / 0.45)));
      ctx.stroke();
    }
  }

  confetti(ctx, t);

  const scale = backOut(clamp01((t - HEART_IN) / HEART_RUN));
  if (scale > 0) fillHeart(ctx, scale, ink);
}

/**
 * The burst with nothing travelling, for reduced motion: the confetti at its
 * widest, fading where it stands. `halftone-ripple`'s call, and the heart is
 * left out because the DOM's own arrives at full size on the press rather than
 * being handed over to.
 */
export function paintStill(ctx: CanvasRenderingContext2D, fade: number): void {
  ctx.save();
  ctx.globalAlpha = 1 - clamp01(fade);
  confetti(ctx, 0.55);
  ctx.restore();
}

/**
 * The sprite sheet: `frames` tiles in one row, each `TILE` square.
 *
 * This is the whole of what Twitter ships. The frames are sampled across the
 * closed interval, so tile 0 is an empty stage and the last tile is the settled
 * heart, which is the one that has to be right: it is what stays on screen when
 * the run ends and the DOM heart takes over from it.
 */
export function bake(
  frames: number,
  dpr: number,
  ink: string,
): HTMLCanvasElement {
  const strip = document.createElement("canvas");
  strip.width = Math.round(frames * TILE * dpr);
  strip.height = Math.round(TILE * dpr);

  const ctx = strip.getContext("2d");
  if (!ctx) return strip;
  ctx.scale(dpr, dpr);

  for (let i = 0; i < frames; i++) {
    ctx.save();
    ctx.translate(i * TILE + TILE / 2, TILE / 2);
    paint(ctx, i / (frames - 1), ink);
    ctx.restore();
  }

  return strip;
}

/**
 * Which tile a flipbook is showing at `progress`.
 *
 * This is CSS `steps(frames - 1)` written out, and the off-by-one is the whole
 * of it: 29 images have 28 steps between them. Tiles 0 to n-2 each hold for
 * `run / (frames - 1)`, and the last one lands at the end and stays, which is
 * what an `animation-fill-mode` of `forwards` buys the real thing.
 */
export function tileAt(progress: number, frames: number): number {
  const steps = frames - 1;
  return Math.min(steps, Math.floor(clamp01(progress) * steps));
}
