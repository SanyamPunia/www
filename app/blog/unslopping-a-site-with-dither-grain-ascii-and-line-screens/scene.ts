/**
 * The one picture all four treatments draw: a ringed planet lit from wherever
 * the pointer is, on a white page.
 *
 * `tone` answers how much ink a point gets, from 0 for bare paper to 1 for
 * solid ink. Every treatment samples it and only differs in the marks it
 * spends that ink on, so the four figures cannot disagree about the planet.
 *
 * Coordinates are scene units centred on the planet, with y pointing down the
 * screen. The planet's radius is `R`.
 */

export const R = 0.5;

/** The ring is a flat ellipse turned by `TILT`, `FLAT` as tall as it is wide. */
const TILT = -0.38;
const COS = Math.cos(TILT);
const SIN = Math.sin(TILT);
const FLAT = 0.3;
const INNER = 1.32 * R;
const OUTER = 2 * R;
/** the dark division in the ring, which every treatment has to resolve */
const GAP_IN = 1.62 * R;
const GAP_OUT = 1.69 * R;

export interface Light {
  x: number;
  y: number;
  z: number;
  /** the half vector between the light and the eye, for the highlight */
  hx: number;
  hy: number;
  hz: number;
}

/** A light sitting at `(dx, dy)` from the planet's centre, a little in front. */
export function lightAt(dx: number, dy: number): Light {
  const len = Math.hypot(dx, dy, 0.9);
  const x = dx / len;
  const y = dy / len;
  const z = 0.9 / len;
  const hl = Math.hypot(x, y, z + 1);
  return { x, y, z, hx: x / hl, hy: y / hl, hz: (z + 1) / hl };
}

function planet(x: number, y: number, r2: number, l: Light): number {
  const z = Math.sqrt(R * R - r2);
  const nx = x / R;
  const ny = y / R;
  const nz = z / R;
  const diffuse = Math.max(0, nx * l.x + ny * l.y + nz * l.z);
  const spec = Math.max(0, nx * l.hx + ny * l.hy + nz * l.hz) ** 28;
  // latitude bands, measured across the ring's own axis so they follow its tilt
  const band = Math.sin((-nx * SIN + ny * COS) * 9) * 0.05;
  const lit = Math.min(1, 0.04 + 0.96 * diffuse + 0.6 * spec);
  // the limb darkens, so the lit edge never melts into the page
  const limb = (1 - nz) * 0.14;
  return Math.min(1, Math.max(0.07, 0.1 + 0.84 * (1 - lit) + band + limb));
}

function ring(q: number): number {
  const fade = Math.min(1, (OUTER - q) / (0.08 * R), (q - INNER) / (0.08 * R));
  return (0.3 + 0.16 * (0.5 + 0.5 * Math.sin((q / R) * 31))) * fade;
}

function halo(r2: number): number {
  const d = Math.sqrt(r2) - R;
  return 0.2 * Math.exp(-((d / 0.16) ** 2)) + 0.035 * Math.exp(-r2 / 0.5);
}

export function tone(x: number, y: number, l: Light): number {
  const rx = x * COS + y * SIN;
  const ry = -x * SIN + y * COS;
  const q = Math.hypot(rx, ry / FLAT);
  const onRing = q > INNER && q < OUTER && !(q > GAP_IN && q < GAP_OUT);
  const r2 = x * x + y * y;
  // the near half of the ring crosses in front of the planet
  if (onRing && ry > 0) return ring(q);
  if (r2 < R * R) return planet(x, y, r2, l);
  if (onRing) return ring(q);
  return halo(r2);
}
