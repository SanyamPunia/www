/**
 * Abacus: ten beads on one rod in a frame. Where the pointer sits along the rod
 * is the split: the beads to its left pack against the left post and the rest
 * against the right, so one position always gives one arrangement. They move on
 * the 700ms lift curve, the front of each moving group first. At rest three beads sit
 * left, six right, and one is mid-push between them with the bright stroke. The
 * slider is the stagger, in ms.
 *
 * The pattern: one of many. Tweens staggered from the front of each moving
 * group, beads that cannot pass each other, and a hit test against the rod,
 * which never moves.
 */
import { HL, type Pt } from "./kernel";

const { Cam, clamp, disposer, facing, fit, hull, mk, open, pointer, poly } = HL;
const { prism, proj, put, register, rings, solid, tdone, tset, tval, tween } = HL;

const N = 10, L = 150, H = 30, R = 9, T = 9, HOLE = 0.45, SIDES = 28;
/** where bead i sits when k beads are counted to the left */
const slot = (i: number, k: number) => (i < k ? i * T + T / 2 : L - (N - 1 - i) * T - T / 2);
const REST = Array.from({ length: N }, (_, i) => (i === 3 ? slot(3, 4) + 16 : slot(i, 3)));

export function mount(
  { stage, svg, read }: { stage: HTMLElement; svg: SVGSVGElement; read: { textContent: string | null } },
  value: number,
) {
  const bag = disposer(), C = Cam(45, 0.5, 2.1);
  fit(C, [[-12, -10, 0], [L + 12, 10, 0], [-12, 10, 0], [L + 12, -10, 0], [0, 0, H + R + 2], [L, 0, H + R + 2]], 200, 166);
  const P = proj(C), front = facing(C);
  let stag = value;

  /** a ring of points round the rod's axis, at x along it */
  const around = (x: number, r: number): Pt[] =>
    Array.from({ length: SIDES }, (_, k) => {
      const a = (k / SIDES) * Math.PI * 2;
      return P(x, r * Math.cos(a), H + r * Math.sin(a));
    });

  const g = mk("g", {}, svg);
  // the base, then the far post, the rod, the beads, and the near post last
  const [br, bi] = rings(-12, -10, L + 12, 10, 5, 1.6);
  put(solid(g), prism(P, front, br, bi, 0, 6));
  const post = (x: number) => {
    const [pr, pi] = rings(x - 3, -3, x + 3, 3, 2.6, 0.8);
    put(solid(g), prism(P, front, pr, pi, 6, H + 7));
  };
  post(-6);
  mk("path", { class: "sil", d: poly(hull([...around(-3, 1.3), ...around(L + 3, 1.3)])) }, g);

  const beads = REST.map((x) => {
    const grp = mk("g", {}, g);
    return {
      tw: tween(x),
      sil: mk("path", { class: "sil" }, grp),
      face: mk("path", { class: "nf lo" }, grp),
      drawn: Number.NaN,
    };
  });
  post(L + 6);

  /** a bicone: its outline round three rings, and the face toward the eye as the crease */
  function drawBead(i: number, x: number) {
    const b = beads[i];
    if (x === b.drawn) return;
    b.drawn = x;
    const near = around(x + T / 2, R * HOLE);
    b.sil.setAttribute("d", poly(hull([...around(x - T / 2, R * HOLE), ...around(x, R), ...near])));
    b.face.setAttribute("d", `${open(near)}Z`);
  }

  const B = register(stage, (_dt, now) => {
    const xs = beads.map((b) => tval(b.tw, now));
    // beads cannot pass on a rod: each keeps a bead's width from its neighbours
    for (let i = 1; i < N; i++) xs[i] = Math.max(xs[i], xs[i - 1] + T);
    for (let i = N - 2; i >= 0; i--) xs[i] = Math.min(xs[i], xs[i + 1] - T);
    xs.forEach((x, i) => { drawBead(i, x); });
    return beads.some((b) => !tdone(b.tw, now));
  });
  bag.add(B.unregister);

  // the rod's two ends on screen: the pointer is read against this line, which never moves
  const A = P(0, 0, H), Z = P(L, 0, H), dx = Z[0] - A[0], dy = Z[1] - A[1];
  const along = ([x, y]: Pt) => (((x - A[0]) * dx + (y - A[1]) * dy) / (dx * dx + dy * dy)) * L;

  let split = -2;
  /** k beads counted to the left, or -1 for rest */
  function count(k: number) {
    if (k === split) return;
    const now = performance.now(), to = beads.map((_, i) => (k < 0 ? REST[i] : slot(i, k)));
    const dir = beads.map((b, i) => Math.sign(to[i] - tval(b.tw, now)));
    // the bead at the front of each moving group leaves first, so none drives into one still waiting
    const first = dir.indexOf(-1), last = dir.lastIndexOf(1);
    split = k;
    beads.forEach((b, i) => {
      tset(b.tw, to[i], now, dir[i] < 0 ? (i - first) * stag : dir[i] > 0 ? (last - i) * stag : 0);
      b.sil.classList.toggle("hi", k < 0 ? i === 3 : i === k - 1);
    });
    read.textContent = k < 0 ? "rest" : `count ${k}`;
    B.wake();
  }
  count(-1);

  bag.add(pointer(stage, {
    move: (p) => count(clamp(Math.round((along(p) / L) * N), 0, N)),
    leave: () => count(-1),
  }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v: number) => { stag = v; },
    destroy: bag.dispose,
  };
}

export const FIGURE = {
  name: "abacus",
  means: "An abacus: where the pointer sits along the rod splits the beads, the ones to its left counted.",
  rules: [1, 2, 5, 8],
  range: [0, 35, 80],
};
