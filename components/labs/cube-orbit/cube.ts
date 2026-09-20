/**
 * The cube as a permutation of its 54 facelets, and what repeating a sequence
 * of turns does to it. Pure and DOM-free, the split `document-pocket` makes
 * with `poses.ts`.
 *
 * **Nothing here is a table of turns copied from somewhere.** Every permutation
 * is derived from one rotation of one cubie, so the six faces cannot disagree
 * with each other and a sign error shows up as a cube that never comes home
 * rather than as a drawing that is quietly wrong. The check is that the orders
 * come out right: a quarter turn is 4, `R U` is 105, and `R U2 D' B D'` is
 * 1260, which is the longest any sequence of turns can take.
 */

/** Facelets are numbered U, R, F, D, L, B, nine each, row-major from outside. */
export const FACES = ["U", "R", "F", "D", "L", "B"] as const;

/**
 * A real cube's colours, which are the object rather than a palette: six shapes
 * built from the same square need colour to tell them apart, so it carries
 * meaning here and does not decorate. That is the exception `stamp-collection`
 * takes for a printed stamp, and this has the same claim. The values are scoped
 * to this experiment, they are not tokens, and nothing else may reach for them.
 *
 * `edge` is the rim every dot on the dial carries. A cube's white sticker is
 * the site's own page colour, so on a light stage it is nothing at all without
 * one, and giving every dot the same rim rather than a tint of its own hue is
 * what keeps white from reading as the odd one out.
 */
export const COLOURS = [
  "#f2f2ef", // U white
  "#cf3327", // R red
  "#2e9b52", // F green
  "#f3cb2c", // D yellow
  "#ec7622", // L orange
  "#2a6ed2", // B blue
] as const;

type Vec = [number, number, number];

/**
 * Each face's own frame, seen from outside: which way is up in the drawing and
 * which way is right, plus the axis its outward normal lies on.
 *
 * `right` cross `up` is the outward normal for all six, which is the one check
 * that says a frame is not mirrored. Get one wrong and the cube still turns,
 * it just turns into its own reflection.
 */
const FRAME: {
  axis: 0 | 1 | 2;
  sign: 1 | -1;
  up: Vec;
  right: Vec;
}[] = [
  { axis: 1, sign: 1, up: [0, 0, -1], right: [1, 0, 0] }, // U, row 0 toward B
  { axis: 0, sign: 1, up: [0, 1, 0], right: [0, 0, -1] }, // R
  { axis: 2, sign: 1, up: [0, 1, 0], right: [1, 0, 0] }, // F
  { axis: 1, sign: -1, up: [0, 0, 1], right: [1, 0, 0] }, // D, row 0 toward F
  { axis: 0, sign: -1, up: [0, 1, 0], right: [0, 0, 1] }, // L
  { axis: 2, sign: -1, up: [0, 1, 0], right: [-1, 0, 0] }, // B
];

const scale = (v: Vec, k: number): Vec => [v[0] * k, v[1] * k, v[2] * k];
const add = (a: Vec, b: Vec, c: Vec): Vec => [
  a[0] + b[0] + c[0],
  a[1] + b[1] + c[1],
  a[2] + b[2] + c[2],
];

/** Where a facelet is: its cubie's place, and the way it faces. */
interface Slot {
  p: Vec;
  n: Vec;
}

const SLOTS: Slot[] = [];
for (const frame of FRAME) {
  const n: Vec = [0, 0, 0];
  n[frame.axis] = frame.sign;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      SLOTS.push({
        p: add(scale(frame.up, 1 - row), scale(frame.right, col - 1), n),
        n,
      });
    }
  }
}

const key = (p: Vec, n: Vec) => `${p.join()}|${n.join()}`;
const SLOT_AT = new Map(SLOTS.map((slot, i) => [key(slot.p, slot.n), i]));

/** A quarter turn about the positive axis, right-handed, `q` times. */
function spin(v: Vec, axis: number, q: number): Vec {
  const r = v.slice() as Vec;
  const i = ((axis + 1) % 3) as 0 | 1 | 2;
  const j = ((axis + 2) % 3) as 0 | 1 | 2;
  for (let k = 0; k < ((q % 4) + 4) % 4; k++) {
    const t = r[i];
    r[i] = -r[j];
    r[j] = t;
  }
  return r;
}

/**
 * Where every facelet goes when face `f` is turned `n` quarter turns clockwise,
 * as `to[i] = j`.
 *
 * Clockwise seen from outside a face is a negative turn about that face's own
 * axis when the face is on the positive side of it, which is what `-sign` says.
 */
function faceTurn(f: number, n: number): Int32Array {
  const frame = FRAME[f];
  const q = -frame.sign * n;
  const to: Int32Array = new Int32Array(54);
  SLOTS.forEach((slot, i) => {
    if (slot.p[frame.axis] !== frame.sign) {
      to[i] = i;
      return;
    }
    const at = SLOT_AT.get(
      key(spin(slot.p, frame.axis, q), spin(slot.n, frame.axis, q)),
    );
    // every rotated facelet lands on another facelet, so this cannot miss
    to[i] = at ?? i;
  });
  return to;
}

const MOVES = new Map<string, Int32Array>();
for (let f = 0; f < 6; f++) {
  for (const [suffix, n] of [
    ["", 1],
    ["'", -1],
    ["2", 2],
  ] as const) {
    MOVES.set(FACES[f] + suffix, faceTurn(f, n));
  }
}

/** Annotated, so every permutation here is one type and `reduce` can fold them. */
const IDENTITY: Int32Array = Int32Array.from({ length: 54 }, (_, i) => i);

/** Do `a`, then `b`. */
function compose(a: Int32Array, b: Int32Array): Int32Array {
  const out: Int32Array = new Int32Array(54);
  for (let i = 0; i < 54; i++) out[i] = b[a[i]];
  return out;
}

/** "R U R' U'" as one permutation of the 54 facelets. */
export function permutationOf(sequence: string): Int32Array {
  return sequence
    .trim()
    .split(/\s+/)
    .reduce((acc, name) => {
      const move = MOVES.get(name);
      if (!move) throw new Error(`cube-orbit: no such turn ${name}`);
      return compose(acc, move);
    }, IDENTITY);
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
const lcm = (a: number, b: number) => (a / gcd(a, b)) * b;

/**
 * The permutation's cycles, longest first, fixed points dropped.
 *
 * This is the whole of the dial: one ring per cycle, and a ring turning by one
 * notch is that cycle being applied once. A cycle of length L is home again
 * every L repetitions, so the cube is home when every ring is, which is the
 * least common multiple of their lengths.
 */
export function cyclesOf(perm: Int32Array): number[][] {
  const seen = new Uint8Array(54);
  const out: number[][] = [];
  for (let i = 0; i < 54; i++) {
    if (seen[i]) continue;
    const cycle: number[] = [];
    let j = i;
    while (!seen[j]) {
      seen[j] = 1;
      cycle.push(j);
      j = perm[j];
    }
    if (cycle.length > 1) out.push(cycle);
  }
  return out.sort((a, b) => b.length - a.length);
}

/** How many repetitions bring the cube home, which is the order of the turn. */
export const orderOf = (cycles: number[][]): number =>
  cycles.reduce((n, cycle) => lcm(n, cycle.length), 1);

/**
 * Every arrangement the sequence passes through, solved first.
 *
 * Walked once when the sequence changes rather than per frame, so scrubbing the
 * dial is a lookup. The longest orbit any sequence of turns has is 1260, so the
 * whole table is at most 68KB.
 */
export function orbitOf(perm: Int32Array, order: number): Uint8Array[] {
  const out: Uint8Array[] = [
    Uint8Array.from({ length: 54 }, (_, i) => (i / 9) | 0),
  ];
  for (let k = 1; k < order; k++) {
    const prev = out[k - 1];
    const next = new Uint8Array(54);
    for (let i = 0; i < 54; i++) next[perm[i]] = prev[i];
    out.push(next);
  }
  return out;
}

/**
 * How much of the cube is already back together at each repetition of the lap.
 *
 * A cycle of length L puts its own stickers back every L repetitions, so the
 * count at step k is the total length of the cycles whose length divides k.
 * Every other sticker is somewhere else.
 *
 * **This is the only thing in the demo that says a lap is not featureless.**
 * Under `R U` the cube is a third of the way back together at 21 and at 42,
 * and under a single quarter turn nothing at all comes back until the end,
 * which is worth being able to see before walking it.
 */
export function returnsOf(cycles: number[][], order: number): Uint16Array {
  const home = new Uint16Array(order);
  for (const cycle of cycles) {
    for (let k = cycle.length; k < order; k += cycle.length) {
      home[k] += cycle.length;
    }
  }
  return home;
}

/**
 * The sequences on offer, in the order their answers grow.
 *
 * Four, and each is picked for a reason. A single quarter turn is five
 * four-cycles and comes home in four, which is the claim at its smallest. The
 * sexy move is the one sequence most people have already typed a hundred times.
 * `R U` is two turns and 105 repetitions, which is the surprise. And
 * `R U2 D' B D'` is 1260, the longest any sequence of turns can take, since
 * 1260 is the largest order in the cube group.
 *
 * They are also all under seven cycles, which is what keeps the dial to six
 * rings and every ring far enough from its neighbour to read.
 */
export const SEQUENCES = ["R", "R U R' U'", "R U", "R U2 D' B D'"] as const;

/** `R'` is written with a real prime on screen, never a typewriter apostrophe. */
export const prime = (sequence: string) => sequence.replace(/'/g, "′");
