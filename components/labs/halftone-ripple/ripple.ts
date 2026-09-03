/*
 * The ripple, as a field sampled on a grid of dots.
 *
 * Pure maths on a 2D context, no React and no DOM beyond the canvas it is
 * handed. A press adds a `Ripple` and every frame asks the same question of
 * every dot in the grid: how far is it from each crest, and how big does that
 * make it.
 */

export interface Ripple {
  /** where it was pressed, in canvas CSS pixels */
  x: number;
  y: number;
  /** `performance.now()` at the press */
  born: number;
  /** the fill for every dot this ripple raises */
  ink: string;
}

/**
 * The dot grid's pitch in CSS pixels. Coarse enough that the dots read as
 * dots rather than as a texture, which is the whole look, and fine enough that
 * a 44px button holds eleven rows of them.
 */
export const PITCH = 4;

/** a dot's widest diameter, as a share of the pitch */
const DOT = 0.72;

/**
 * How many sizes a dot can be. The field is continuous and the dots are not,
 * which is what makes this a halftone rather than a blur: a dot steps through
 * six sizes as the crest passes rather than sliding through every one, so a
 * frozen frame shows rings of one size and the motion reads as a screen print
 * being run rather than as a glow spreading.
 */
const LEVELS = 6;

/** a full ripple, press to nothing left */
export const LIFE = 1000;

/**
 * The reduced motion ripple is a flash rather than a travel: the field appears
 * at once around the press and fades, and this is how long it takes.
 */
export const STILL_LIFE = 360;

/**
 * The band around the crest that raises dots, at the press and at the end of
 * the travel. It widens as it goes, which is dispersion, and it is what stops
 * the late ripple from thinning to a single ring of dots.
 */
const BAND = { start: 18, end: 44 };

/** the trailing half of the band is longer than the leading half */
const TAIL = 1.7;

/**
 * The dots are not quite solid. Ink at full strength under the digits made the
 * count hard to read for the frame or two the crest sat on it, and a print on
 * grey paper sits a little into the paper anyway.
 */
const ALPHA = 0.82;

const TAU = Math.PI * 2;

/** how far along the travel the crest is at `p`, as a share of the reach */
function crest(p: number): number {
  return 1 - (1 - p) ** 2;
}

/** how much of its height the ripple has left at `p` */
function envelope(p: number): number {
  return (1 - p) ** 1.1;
}

/** the dot's size at `k` bands from the crest, a soft bump */
function bump(k: number): number {
  return Math.exp(-k * k * 3.2);
}

/**
 * Paint one frame. Clears the canvas, drops the ripples that have finished
 * and draws every dot the rest still raise. Returns whether anything is left
 * to draw, so the caller can stop asking for frames.
 *
 * `w` and `h` are the canvas's CSS size. The context is expected to carry the
 * device pixel ratio as its transform, so everything here is in CSS pixels.
 */
export function paint(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  ripples: Ripple[],
  now: number,
  still: boolean,
): boolean {
  ctx.clearRect(0, 0, w, h);

  const life = still ? STILL_LIFE : LIFE;
  for (let i = ripples.length - 1; i >= 0; i--) {
    if (now - ripples[i].born >= life) ripples.splice(i, 1);
  }
  if (ripples.length === 0) return false;

  /*
   * The farthest a crest has to go is the far corner, and it travels a little
   * past it so the last dots at the edge are lifted by the tail rather than by
   * the crest stopping on them.
   */
  const reach = Math.hypot(w, h) * 0.92;

  const waves = ripples.map((r) => {
    const p = (now - r.born) / life;
    if (still) {
      /*
       * A flash: the crest stays on the press with a wide band, so the field is
       * one soft disc around the finger that fades where it is.
       */
      return {
        x: r.x,
        y: r.y,
        radius: 0,
        band: reach * 0.42,
        height: envelope(p),
        ink: r.ink,
      };
    }
    return {
      x: r.x,
      y: r.y,
      radius: reach * crest(p),
      band: BAND.start + (BAND.end - BAND.start) * p,
      height: envelope(p),
      ink: r.ink,
    };
  });

  /* centre the grid, so the pattern is symmetric in the pill */
  const cols = Math.ceil(w / PITCH) + 1;
  const rows = Math.ceil(h / PITCH) + 1;
  const x0 = (w - (cols - 1) * PITCH) / 2;
  const y0 = (h - (rows - 1) * PITCH) / 2;

  const paths = new Map<string, Path2D>();
  const maxRadius = (PITCH * DOT) / 2;

  for (let row = 0; row < rows; row++) {
    const y = y0 + row * PITCH;
    for (let col = 0; col < cols; col++) {
      const x = x0 + col * PITCH;

      /*
       * Ripples add, so two crests crossing lift a dot further, and the dot
       * takes the ink of whichever is lifting it most.
       */
      let amp = 0;
      let lead = 0;
      let ink = waves[0].ink;
      for (const wave of waves) {
        const d = Math.hypot(x - wave.x, y - wave.y) - wave.radius;
        const k = d / (d < 0 ? wave.band * TAIL : wave.band);
        const a = bump(k) * wave.height;
        amp += a;
        if (a > lead) {
          lead = a;
          ink = wave.ink;
        }
      }

      const level = Math.round(Math.min(amp, 1) * LEVELS) / LEVELS;
      if (level === 0) continue;

      /*
       * Radius on the square root, since what the eye reads off a halftone is
       * the ink's area and area goes with the square of the radius. On a
       * straight line the small end of the field is nearly empty.
       */
      const radius = maxRadius * Math.sqrt(level);

      let path = paths.get(ink);
      if (!path) {
        path = new Path2D();
        paths.set(ink, path);
      }
      path.moveTo(x + radius, y);
      path.arc(x, y, radius, 0, TAU);
    }
  }

  ctx.globalAlpha = ALPHA;
  for (const [ink, path] of paths) {
    ctx.fillStyle = ink;
    ctx.fill(path);
  }
  ctx.globalAlpha = 1;

  return true;
}
