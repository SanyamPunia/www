/**
 * The strings, pure and DOM-free. A string's whole state is a list of mode
 * amplitudes, and the drawing, the sound and the harmonic bars all read the
 * same list, so none of them can disagree with another.
 *
 * A plucked string starts as a triangle: straight from the nut to the point
 * the finger let go, and straight from there to the bridge. Its Fourier sine
 * series is
 *
 *   b_n = 2A sin(n pi p) / (n^2 pi^2 p (1 - p))
 *
 * where A is how far it was pulled and p is where along the string. Mode n
 * then rings on its own at its own frequency and dies at its own rate. That
 * series is the reason where you pluck sets the tone: sin(n pi p) is zero for
 * every n that puts a node at p, so a pluck at the middle has no even
 * harmonics, a pluck at a third has no third, sixth or ninth, and a pluck near
 * the bridge keeps them all and sounds bright.
 */

/** modes per string: past this they are under any pixel and any ear */
export const MODES = 24;

export interface Course {
  /** the note, with its octave, which is data and keeps its casing */
  note: string;
  /** the fundamental in Hz */
  hz: number;
  /** how long the fundamental rings, the 1/e time in seconds */
  tau: number;
  /** stiffness, which pulls partial n sharp by sqrt(1 + B n^2) */
  stiffness: number;
}

/**
 * Open G, low to high, tuned in just intonation off G rather than in equal
 * temperament. The D strings are a pure 3:2 above or below the G strings and
 * the B a pure 5:4, so the strummed chord does not beat, and every string's
 * partials land on another string's partials closely enough for the second
 * string to ring in sympathy. In equal temperament the fifth is 0.11% narrow,
 * which at 294Hz is 0.34Hz, wider than a ringing mode's own bandwidth, and the
 * sympathy all but goes. The plain top strings are stiffer for their size than
 * the wound bottom ones, so they carry more of it.
 */
const G = 98;
export const STRINGS: readonly Course[] = [
  { note: "D2", hz: (G * 3) / 4, tau: 3.4, stiffness: 0.00004 },
  { note: "G2", hz: G, tau: 3.2, stiffness: 0.00005 },
  { note: "D3", hz: (G * 3) / 2, tau: 2.9, stiffness: 0.00007 },
  { note: "G3", hz: G * 2, tau: 2.6, stiffness: 0.00011 },
  { note: "B3", hz: (G * 5) / 2, tau: 2.3, stiffness: 0.00022 },
  { note: "D4", hz: G * 3, tau: 2.1, stiffness: 0.00016 },
];

/**
 * Losses that grow with the square of frequency, air and the string's own
 * internal friction, on top of each string's base decay. So the high modes go
 * first, which is what rounds the kink off a plucked string within a second
 * and leaves the fundamental ringing on its own.
 */
const LOSS = 1.6e-6;

/** the frequency of mode n, 1-based, with the stiffness stretch */
export function partial(course: Course, n: number): number {
  return n * course.hz * Math.sqrt(1 + course.stiffness * n * n);
}

/** the 1/e decay time of mode n in seconds */
export function decay(course: Course, n: number): number {
  const f = partial(course, n);
  return 1 / (1 / course.tau + LOSS * f * f);
}

/**
 * The mode amplitudes of a pluck, index 0 being mode 1, in whatever unit
 * `amp` is in.
 *
 * `width` is the contact's own width as a share of the string. A pluck is not
 * a point: the string bends round a pick's edge or a fingertip, which is the
 * triangle convolved with a box of that width, and a convolution is a product
 * of the two series. A box's series is sinc(n pi w / 2), so a wide fingertip
 * rolls the high modes off and a pick's edge leaves them alone. That is the
 * whole difference between a thumb and a plectrum.
 */
export function pluckModes(p: number, amp: number, width: number): number[] {
  const out: number[] = [];
  const denom = Math.PI * Math.PI * p * (1 - p);
  for (let n = 1; n <= MODES; n++) {
    const triangle = (2 * amp * Math.sin(n * Math.PI * p)) / (n * n * denom);
    const x = (n * Math.PI * width) / 2;
    const soft = x < 1e-6 ? 1 : Math.sin(x) / x;
    out.push(triangle * soft);
  }
  return out;
}

/**
 * How much a pluck on `src` makes `dst` ring, per mode of `dst`.
 *
 * Both strings stand on the same bridge, and a string pushing on the bridge
 * drives every other string through it. A mode of the far string answers in
 * proportion to how close the driving frequency is to its own, on a Lorentzian
 * as wide as its own bandwidth, 1 / (pi tau) Hz. The driving force goes with
 * the source mode's velocity, which is n times its displacement. `gain` is
 * how much of it crosses the bridge.
 */
export function couple(
  src: Course,
  modes: readonly number[],
  dst: Course,
  gain: number,
): number[] {
  const out: number[] = [];
  for (let m = 1; m <= MODES; m++) {
    const f = partial(dst, m);
    const band = 1 / (Math.PI * decay(dst, m));
    let sum = 0;
    for (let n = 1; n <= MODES; n++) {
      const d = (2 * (partial(src, n) - f)) / band;
      if (Math.abs(d) > 40) continue;
      sum += ((n / m) * modes[n - 1]) / (1 + d * d);
    }
    out.push(sum * gain);
  }
  return out;
}

/**
 * The strength of each mode as you would hear it, which is its velocity: n
 * times its displacement. Displacement falls as 1/n^2 and velocity as 1/n, so
 * the bars show a gentler slope than the shape on screen does, and this is the
 * slope an ear gets.
 */
export function loudness(modes: readonly number[]): number[] {
  return modes.map((b, i) => Math.abs(b) * (i + 1));
}

/** a pluck point as the simple fraction it is near, or as a decimal */
export function fraction(p: number): string {
  for (let d = 2; d <= 7; d++) {
    for (let n = 1; n < d; n++) {
      if (Math.abs(p - n / d) < 0.012 && gcd(n, d) === 1) return `${n}/${d}`;
    }
  }
  return p.toFixed(2);
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}
