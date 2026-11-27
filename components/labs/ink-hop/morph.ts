/*
 * Shape morphing between two closed paths, done by hand so no plugin is needed.
 *
 * Each path is sampled into the same number of points at equal arc length,
 * turned to run the same way round, and then the target is rotated in index
 * so its points start where the source's do. A morph is then a straight lerp
 * of point pairs, and the pairing is what keeps it from twisting.
 */

/** enough points that the polygon reads as the curve at 25px */
const N = 160;

export type Points = Float32Array;

const cache = new Map<string, Points>();

export function sample(d: string): Points {
  const hit = cache.get(d);
  if (hit) return hit;
  // attached while measuring, since Firefox measures a detached path as 0
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.style.cssText = "position:absolute;width:0;height:0;visibility:hidden";
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", d);
  svg.appendChild(path);
  document.body.appendChild(svg);
  const total = path.getTotalLength();
  const pts = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) {
    const p = path.getPointAtLength((i / N) * total);
    pts[i * 2] = p.x;
    pts[i * 2 + 1] = p.y;
  }
  svg.remove();
  if (area(pts) < 0) reverse(pts);
  cache.set(d, pts);
  return pts;
}

function area(pts: Points): number {
  let a = 0;
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    a += pts[i * 2] * pts[j * 2 + 1] - pts[j * 2] * pts[i * 2 + 1];
  }
  return a / 2;
}

function reverse(pts: Points) {
  for (let i = 0, j = N - 1; i < j; i++, j--) {
    const x = pts[i * 2];
    const y = pts[i * 2 + 1];
    pts[i * 2] = pts[j * 2];
    pts[i * 2 + 1] = pts[j * 2 + 1];
    pts[j * 2] = x;
    pts[j * 2 + 1] = y;
  }
}

/** `to`, re-indexed so its points pair with `from`'s at the least total travel */
export function align(from: Points, to: Points): Points {
  let best = 0;
  let bestCost = Number.POSITIVE_INFINITY;
  for (let k = 0; k < N; k++) {
    let cost = 0;
    for (let i = 0; i < N; i++) {
      const j = ((i + k) % N) * 2;
      const dx = from[i * 2] - to[j];
      const dy = from[i * 2 + 1] - to[j + 1];
      cost += dx * dx + dy * dy;
      if (cost >= bestCost) break;
    }
    if (cost < bestCost) {
      bestCost = cost;
      best = k;
    }
  }
  const out = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) {
    const j = ((i + best) % N) * 2;
    out[i * 2] = to[j];
    out[i * 2 + 1] = to[j + 1];
  }
  return out;
}

export function lerp(a: Points, b: Points, t: number, out: Points): Points {
  for (let i = 0; i < N * 2; i++) out[i] = a[i] + (b[i] - a[i]) * t;
  return out;
}

export function blank(): Points {
  return new Float32Array(N * 2);
}

export function toPath(pts: Points): string {
  let d = `M${pts[0].toFixed(2)} ${pts[1].toFixed(2)}`;
  for (let i = 1; i < N; i++) {
    d += `L${pts[i * 2].toFixed(2)} ${pts[i * 2 + 1].toFixed(2)}`;
  }
  return `${d}Z`;
}
