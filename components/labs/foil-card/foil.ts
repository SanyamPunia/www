/*
 * The foil, and the arithmetic that says what colour each of its dots is.
 *
 * Nothing in here is a palette. A dot-matrix hologram is a grid of microscopic
 * diffraction gratings stamped into foil, one per dot, each with its own groove
 * pitch and groove direction, and the colour that leaves a dot is whichever
 * wavelength its grating happens to send to the eye at the angle the card is
 * being held at. So every colour on this card is an angle rather than an ink,
 * and tipping the card sweeps the spectrum across the grid.
 *
 * Pure apart from `mask`, which needs a canvas to make a tile out of. The
 * painter writes into a buffer the caller blits, which is the split
 * `halftone-ripple` makes with `ripple.ts`.
 */

/** The visible band, in nanometres. */
const VIOLET = 380;
const RED = 780;

/**
 * How many diffraction orders a dot is asked for.
 *
 * A grating does not send one wavelength, it sends the series: the answer
 * divided by one, by two, by three, each weaker than the last. Asking for the
 * first alone leaves most of the card bare, since a dot lights only while its
 * own pitch times the angle lands inside one octave. Three orders widen that
 * window from 380 to 780 nanometres to 380 to 2340, and none of it is a
 * licence taken: a real grating really does send all three, and it really
 * does send them weaker in turn.
 *
 * Measured on the card with the light at its middle: 2011 of 6300 dots carry
 * colour on the first order alone and 3156 with three, which is the
 * difference between a scatter and a foil. The quiet disc under the pointer
 * is unchanged at 15px, since the innermost order is the first one either
 * way.
 */
const ORDERS = 3;

/**
 * Groove pitch, in nanometres, and it is a real range: dot-matrix foils are
 * stamped at roughly 300 to 2500 lines a millimetre.
 *
 * **The width of that range is what makes the foil scatter rather than band.**
 * At one angle every dot solves the grating equation for a different
 * wavelength, so only the dots whose pitch lands the answer inside the visible
 * band light at all, and which dots those are moves as the card turns. A
 * narrow range is one smooth rainbow sliding about, and this is confetti with
 * rainbow structure under it, which is what a real foil looks like.
 *
 * **Spread across the range in the log rather than evenly, so that the share
 * of dots which can answer is the same at every angle.** The answer is the
 * pitch times the angle, so a linear spread hands a small angle a different
 * share of the range than a large one and the card comes out bright at one
 * radius and washed at another. A log spread makes that share one number, the
 * visible octave over the range's own, which here is 0.719 over 2.110 or 34%.
 *
 * What the range's top end sets instead is the specular point: a dot can only
 * answer an angle its own pitch can reach, so the smallest angle anything on
 * the card can answer belongs to the coarsest grating on it. Measured with the
 * light at the card's middle, the nearest lit dot is 15px away, and that quiet
 * disc under the pointer is what a foil has where the mirror direction is.
 */
const PITCH = { lo: 400, hi: 3300 };

/**
 * How much of a dot's pitch is its own rather than its neighbourhood's.
 *
 * At 0 the foil is a smooth field and lights in solid patches, which reads as
 * a stain. At 1 it is static. Two thirds of the way over, neighbouring dots
 * span most of the range while a slow drift still biases whole regions, which
 * is the scatter with structure under it that a stamped foil has.
 */
const GRIT = 0.66;

/** How many times over the pitch range covers itself, for the spread above. */
const OCTAVES = PITCH.hi / PITCH.lo;

/**
 * How coarse the two fields are, in lattice cells across the card.
 *
 * The pitch and the groove direction both come from a smooth field plus a
 * per-dot jitter. The field is what gives the foil regions that turn together,
 * so tipping the card moves recognisable shapes across it. The jitter is what
 * stops two neighbours ever being quite the same grating, which is the sparkle.
 * Pure jitter is television static, and a pure field is a gradient.
 */
const PITCH_LATTICE = 4.5;
const GROOVE_LATTICE = 3;
const GROOVE_JITTER = 1.1;

/**
 * The stamp, in card pixels: how far apart the dots sit and how much of that
 * each one fills.
 *
 * Four and two, so a dot is a quarter of the area it stands in. The gaps are
 * what make the foil read as a grid of separate dots rather than as a wash,
 * and they are punched by a pattern rather than painted, so what shows through
 * one is the card's own paper.
 */
export const STAMP = { cell: 4, dot: 2 } as const;

/** The paper's own tooth, as the alpha a dot carries with no light on it. */
const TOOTH = { lo: 0.05, hi: 0.14 };

/**
 * The most of itself a lit dot gives to its diffracted colour.
 *
 * Half, so a lit dot is half its own wavelength and half the paper under it.
 * At 0.92 every dot near the pointer was a pixel of pure spectrum and a card
 * full of them was painful to look at, which is not what a foil does either:
 * a dot is small and diffracts a fraction of the light that lands on it, so
 * what it sends back is a tint.
 */
const GLOW_ALPHA = 0.5;

/**
 * How fast the irradiance falls away from the light, as the exponent on the
 * cosine of incidence.
 *
 * A point light over a plane already falls off on its own, and at this height
 * that alone lights the whole card evenly enough to read as a wash. The
 * exponent is what turns it back into a bloom around the pointer, and at 2 it
 * was still carrying real colour into all four corners.
 */
const FALLOFF = 3;

/**
 * A press wave, and the two things it does to the foil it crosses.
 *
 * A wave in a sheet is a ridge, and a ridge both stretches the sheet over its
 * crest and tips it on the way up and down. So the crest widens the grooves
 * under it, which sends a longer wavelength, and the flanks turn the dots
 * they run through, which sends the answer somewhere else again. Both fall
 * out of one profile: the stretch is the ridge's height and the turn is its
 * slope.
 */
const WAVE = {
  /** card pixels a second */
  speed: 520,
  /**
   * The crest's own width, in card pixels.
   *
   * A card is stiff, and a bending wave in a stiff plate has a long
   * wavelength. At 34 the ridge was a ripple in water: it crossed the card
   * and almost nothing saw it go, since a band that narrow only ever
   * disturbs a couple of rows of dots at a time. At 84 it is about a third of
   * the card's height, which is what a sheet of board flexing actually looks
   * like and is wide enough that the wave reads as an event rather than as a
   * seam travelling.
   */
  width: 84,
  /** how far a crest stretches a groove, as a share of its pitch */
  strain: 0.45,
  /** how hard a flank turns the dots on it */
  slope: 0.55,
  /**
   * How much of the light a flank catches or loses by facing it.
   *
   * Without this the wave can only ever be seen where the light already is,
   * and the light is a tight bloom around the pointer, so the far half of the
   * card never showed it at all. A ridge tips the surface, and a tipped
   * surface takes more light on the side facing the lamp and less on the side
   * turned away, which is how you see a wave cross a sheet from any distance.
   */
  shade: 0.5,
  /** seconds, and long enough at this speed to cross the whole card */
  life: 1,
  /**
   * Reduced motion gets the same ridge as a disc that fades where it stands,
   * `halftone-ripple`'s call: the ring is the travel and the stretch is what
   * the press did.
   */
  stillWidth: 150,
};

export interface Ripple {
  /** card pixels from the pivot, y up */
  x: number;
  y: number;
  born: number;
}

export interface Field {
  cols: number;
  rows: number;
  /** each dot's groove normal, the in-plane direction the pitch is measured along */
  cos: Float32Array;
  sin: Float32Array;
  /** each dot's groove pitch, nanometres */
  pitch: Float32Array;
  /** each dot's resting alpha */
  tooth: Float32Array;
  /** one pixel per dot, blitted up by the caller */
  buffer: ImageData;
}

export interface View {
  /** the card's tilt, in radians, `rotateX` then `rotateY` as CSS composes them */
  rx: number;
  ry: number;
  /** the light's offset from the pivot, card pixels, y up and z toward the eye */
  lx: number;
  ly: number;
  lz: number;
  /** 0 with nothing lighting the card, 1 under a pointer, more under a press */
  lit: number;
  /** how far apart the dots sit, card pixels */
  cell: number;
  /** where the pivot sits inside the card, card pixels from its top left */
  ox: number;
  oy: number;
}

/**
 * An integer hash, and not `Math.sin(x) * 43758.5453`, which is a shader trick
 * that degenerates on small integer inputs. `stem-picker` documents printing
 * that one and finding five of nine values identical.
 */
function hash(x: number, y: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Value noise on a unit lattice, smoothstepped between corners. */
function noise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const u = x - xi;
  const v = y - yi;
  const su = u * u * (3 - 2 * u);
  const sv = v * v * (3 - 2 * v);

  const a = hash(xi + seed, yi);
  const b = hash(xi + 1 + seed, yi);
  const c = hash(xi + seed, yi + 1);
  const d = hash(xi + 1 + seed, yi + 1);

  return (a * (1 - su) + b * su) * (1 - sv) + (c * (1 - su) + d * su) * sv;
}

/**
 * The visible spectrum, one entry a nanometre, built once at module load.
 *
 * Bruton's piecewise fit, with its intensity taper at the two ends, which is
 * not decoration either: deep violet and deep red really are dim, because the
 * eye has almost no response left out there. A dot diffracting 700nm is a
 * quiet dot.
 */
const SPECTRUM = buildSpectrum();

function buildSpectrum(): Uint8Array {
  const table = new Uint8Array((RED - VIOLET + 1) * 3);

  for (let nm = VIOLET; nm <= RED; nm++) {
    let r = 0;
    let g = 0;
    let b = 0;

    if (nm < 440) {
      r = -(nm - 440) / 60;
      b = 1;
    } else if (nm < 490) {
      g = (nm - 440) / 50;
      b = 1;
    } else if (nm < 510) {
      g = 1;
      b = -(nm - 510) / 20;
    } else if (nm < 580) {
      r = (nm - 510) / 70;
      g = 1;
    } else if (nm < 645) {
      r = 1;
      g = -(nm - 645) / 65;
    } else {
      r = 1;
    }

    let fade = 1;
    if (nm < 420) fade = 0.3 + (0.7 * (nm - VIOLET)) / 40;
    else if (nm > 700) fade = 0.3 + (0.7 * (RED - nm)) / 80;

    const i = (nm - VIOLET) * 3;
    table[i] = 255 * (r * fade) ** 0.8;
    table[i + 1] = 255 * (g * fade) ** 0.8;
    table[i + 2] = 255 * (b * fade) ** 0.8;
  }

  return table;
}

export function makeField(cols: number, rows: number): Field {
  const n = cols * rows;
  const field: Field = {
    cols,
    rows,
    cos: new Float32Array(n),
    sin: new Float32Array(n),
    pitch: new Float32Array(n),
    tooth: new Float32Array(n),
    buffer: new ImageData(cols, rows),
  };

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      const u = x / cols;
      const v = y / rows;

      const bearing =
        noise(u * GROOVE_LATTICE, v * GROOVE_LATTICE, 1) * Math.PI +
        (hash(x + 7, y * 31 + 3) - 0.5) * GROOVE_JITTER;
      field.cos[i] = Math.cos(bearing);
      field.sin[i] = Math.sin(bearing);

      const drift = noise(u * PITCH_LATTICE, v * PITCH_LATTICE, 17);
      const grit = hash(x * 3 + 1, y + 91);
      field.pitch[i] = PITCH.lo * OCTAVES ** (drift * (1 - GRIT) + grit * GRIT);

      field.tooth[i] =
        TOOTH.lo + (TOOTH.hi - TOOTH.lo) * hash(x + 101, y + 211);
    }
  }

  return field;
}

/**
 * One tile of the stamp, as a canvas to make a `CanvasPattern` from.
 *
 * The buffer holds one pixel a dot and blits up to solid cells, so the gaps
 * between the dots are punched afterwards with this rather than baked in. That
 * keeps them transparent, so what shows through a gap is the card's own paper
 * rather than a second copy of its colour.
 */
export function mask(cell: number, dot: number): HTMLCanvasElement {
  const tile = document.createElement("canvas");
  tile.width = cell;
  tile.height = cell;
  const ctx = tile.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, dot, dot);
  }
  return tile;
}

/**
 * Write one frame of the foil into the field's buffer. Returns whether
 * anything is still moving.
 */
export function paint(
  field: Field,
  view: View,
  ripples: readonly Ripple[],
  now: number,
  still: boolean,
  ink: readonly [number, number, number],
): boolean {
  const { cols, rows, cos, sin, pitch, tooth } = field;
  const data = field.buffer.data;
  const [tr, tg, tb] = ink;

  /*
   * The two directions, rotated out of the page and into the card's own frame.
   * CSS composes `rotateX(a) rotateY(b)` as Rx·Ry, so going the other way is
   * Ry(-b)·Rx(-a), and both vectors take it once a frame rather than per dot.
   */
  const ca = Math.cos(view.rx);
  const sa = Math.sin(view.rx);
  const cb = Math.cos(view.ry);
  const sb = Math.sin(view.ry);

  /* the eye, which is world (0, 0, 1) since the perspective is shallow */
  const vx = -sb * ca;
  const vy = -sa;

  const y1 = ca * view.ly - sa * view.lz;
  const z1 = sa * view.ly + ca * view.lz;
  const lx = cb * view.lx - sb * z1;
  const ly = y1;
  const lz = sb * view.lx + cb * z1;

  /* the live waves, culled once rather than per dot */
  const live: number[] = [];
  for (const r of ripples) {
    const age = (now - r.born) / 1000;
    if (age < 0 || age > WAVE.life) continue;
    const fade = 1 - age / WAVE.life;
    /* linear rather than squared, or the crest is spent before it is halfway
       across and the far side of the card never sees one go past */
    live.push(
      r.x,
      r.y,
      still ? 0 : WAVE.speed * age,
      fade,
      still ? WAVE.stillWidth : WAVE.width,
    );
  }

  const cell = view.cell;
  const lit = view.lit;
  const dark = lit <= 0.002 && live.length === 0;

  for (let row = 0; row < rows; row++) {
    /* card pixels from the pivot, y up */
    const py = view.oy - (row + 0.5) * cell;

    for (let col = 0; col < cols; col++) {
      const i = row * cols + col;
      const o = i * 4;

      if (dark) {
        data[o] = tr;
        data[o + 1] = tg;
        data[o + 2] = tb;
        data[o + 3] = tooth[i] * 255;
        continue;
      }

      const px = (col + 0.5) * cell - view.ox;

      /*
       * The ridge a press left, as how far it stretches this dot's grooves
       * and which way its flank has tipped them.
       *
       * The slope is accumulated as a vector rather than projected per
       * ripple, since the two things it drives want two different
       * projections: against the dot's grooves it decides the wavelength, and
       * against the direction of the light it decides how much of that light
       * the dot catches.
       */
      let strain = 0;
      let slopeX = 0;
      let slopeY = 0;
      for (let k = 0; k < live.length; k += 5) {
        const dx = px - live[k];
        const dy = py - live[k + 1];
        const r = Math.sqrt(dx * dx + dy * dy) || 1e-6;
        const off = (r - live[k + 2]) / live[k + 4];
        const ridge = live[k + 3] * Math.exp(-off * off);
        strain += WAVE.strain * ridge;
        /* the gaussian's own derivative, along the radius it runs out on */
        const grad = ridge * -2 * off;
        slopeX += (grad * dx) / r;
        slopeY += (grad * dy) / r;
      }

      /* the direction from the dot to the light */
      const ax = lx - px;
      const ay = ly - py;
      const r2 = ax * ax + ay * ay + lz * lz;
      const inv = 1 / Math.sqrt(r2);
      /* the incidence cosine, on whatever the ridge has done to the surface */
      const nz =
        lz * inv - WAVE.shade * (slopeX * ax * inv + slopeY * ay * inv);

      let glow = 0;
      let red = 0;
      let green = 0;
      let blue = 0;

      if (nz > 0) {
        /*
         * The half vector, which is what specular shading already asks for:
         * the zeroth order leaves along the mirror direction, where its
         * in-plane part is nothing, and the first order needs that part to
         * equal one wavelength over the pitch. So the whole grating equation
         * here is a dot product against the dot's own groove normal.
         */
        const hx = ax * inv + vx;
        const hy = ay * inv + vy;
        const s =
          hx * cos[i] +
          hy * sin[i] +
          WAVE.slope * (slopeX * cos[i] + slopeY * sin[i]);

        const answer = pitch[i] * (1 + strain) * Math.abs(s);

        /* every order the dot can answer with, each weaker than the last */
        let power = 0;
        for (let m = 1; m <= ORDERS; m++) {
          const nm = answer / m;
          if (nm < VIOLET) break;
          if (nm > RED) continue;
          const share = 1 / m;
          const k = ((nm - VIOLET) | 0) * 3;
          red += SPECTRUM[k] * share;
          green += SPECTRUM[k + 1] * share;
          blue += SPECTRUM[k + 2] * share;
          power += share;
        }

        if (power > 0) {
          red /= power;
          green /= power;
          blue /= power;
          glow = lit * nz ** FALLOFF * Math.min(1, power);
        }
      }

      if (glow > 0.004) {
        const alpha = Math.min(1, tooth[i] + glow * GLOW_ALPHA);
        /* how much of the dot is diffracted light rather than paper */
        const mix = Math.min(1, (glow * GLOW_ALPHA) / alpha);

        data[o] = tr + (red - tr) * mix;
        data[o + 1] = tg + (green - tg) * mix;
        data[o + 2] = tb + (blue - tb) * mix;
        data[o + 3] = alpha * 255;
      } else {
        data[o] = tr;
        data[o + 1] = tg;
        data[o + 2] = tb;
        data[o + 3] = tooth[i] * 255;
      }
    }
  }

  return !dark;
}
