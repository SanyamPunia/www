/*
 * The ruler along the foot of the field being scrubbed. It runs in value
 * space: a tick is a fixed amount of value, so the ruler slides under the
 * needle exactly as fast as the number changes. Shift makes it race, Alt and a
 * hand drifting down make it crawl and spread out, and it stops dead while a
 * detent holds the value even though the hand is still moving.
 */

import { type Detent, STICK } from "./scrub";

export interface Ink {
  tick: string;
  needle: string;
}

/** Read once per scrub, since a canvas cannot take a `var()`. */
export function readInk(): Ink {
  const cs = getComputedStyle(document.documentElement);
  return {
    tick: cs.getPropertyValue("--color-text-muted").trim() || "#9b9b9b",
    needle: cs.getPropertyValue("--color-text-primary").trim() || "#1a1a1a",
  };
}

/** About this many px of hand between two ticks, before rounding. */
const SPACING = 6;

/**
 * A tick on a 1, 2 or 5 step, with a long tick on the next round value above
 * it, so the long ticks land on round values and the ruler reads like a ruler
 * rather than a comb.
 */
function scale(gain: number): { tick: number; major: number } {
  const raw = gain * SPACING;
  const p = 10 ** Math.floor(Math.log10(raw));
  const f = raw / p;
  if (f < 1.5) return { tick: p, major: 10 * p };
  if (f < 3.5) return { tick: 2 * p, major: 10 * p };
  if (f < 7.5) return { tick: 5 * p, major: 50 * p };
  return { tick: 10 * p, major: 100 * p };
}

export interface RulerState {
  /** the value under the needle */
  value: number;
  /** the unrounded value, which x-ray marks against the needle */
  raw: number;
  /** where the scrub began, which is where Escape goes back to */
  start: number;
  gain: number;
  min: number;
  max: number;
  detents: readonly Detent[];
  /** how far the needle has been pushed past a limit, px */
  band: number;
  /** travel a detent still has to absorb, px, or 0 */
  hold: number;
  xray: boolean;
}

export function paintRuler(
  canvas: HTMLCanvasElement,
  s: RulerState,
  ink: Ink,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = canvas.width / Math.max(1, canvas.clientWidth);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, w, h);

  const { tick, major } = scale(s.gain);
  const mid = w / 2;
  const at = (v: number) => mid + (v - s.value) / s.gain;
  const reach = (mid + 8) * s.gain;
  const first = Math.floor((s.value - reach) / tick);
  const last = Math.ceil((s.value + reach) / tick);
  const eps = tick * 1e-6;
  const foot = h;

  ctx.fillStyle = ink.tick;
  for (let k = first; k <= last; k++) {
    const t = k * tick;
    if (t < s.min - eps || t > s.max + eps) continue;
    const x = Math.round(at(t)) + 0.5;
    const big = Math.abs(t / major - Math.round(t / major)) < 1e-6;
    const edge = Math.abs(t - s.min) < eps || Math.abs(t - s.max) < eps;
    const len = edge ? 8 : big ? 4.5 : 2.5;
    ctx.globalAlpha = edge ? 1 : big ? 0.9 : 0.5;
    ctx.fillRect(x - 0.5, foot - len, 1, len);
  }

  // a detent is a dot above the ticks, so the reader can see one coming
  ctx.globalAlpha = 1;
  for (const d of s.detents) {
    if (d.at < s.min || d.at > s.max) continue;
    const x = at(d.at);
    if (x < -4 || x > w + 4) continue;
    ctx.beginPath();
    ctx.arc(x, 1.5, 1.25, 0, Math.PI * 2);
    ctx.fill();
  }

  // where the scrub began, as a ring beside the detents' dots: the distance
  // back to it is what Escape would undo
  const sx = at(s.start);
  if (sx > -6 && sx < w + 6) {
    ctx.strokeStyle = ink.needle;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(sx, 2, 1.6, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (s.xray) {
    // the unrounded value, which the needle rounds onto the grid
    const rx = at(s.raw);
    ctx.fillStyle = ink.needle;
    ctx.globalAlpha = 0.45;
    ctx.fillRect(Math.round(rx), 0, 1, 3);
    // a detent's window: the bracket is the whole hold and the fill is what
    // the hand has spent of it
    if (s.hold > 0) {
      const used = STICK - s.hold;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(mid - STICK, foot - 1, STICK * 2, 1);
      ctx.globalAlpha = 0.9;
      ctx.fillRect(mid - used, foot - 1.5, used * 2, 1.5);
    }
  }

  // the needle is the hand, so a push past a limit carries it past the end
  ctx.globalAlpha = 1;
  ctx.fillStyle = ink.needle;
  ctx.fillRect(Math.round(mid + s.band) - 0.5, 0, 1.5, h);

  // fade both ends, so the ruler reads as a window onto a longer scale
  ctx.globalCompositeOperation = "destination-in";
  const fade = ctx.createLinearGradient(0, 0, w, 0);
  fade.addColorStop(0, "rgba(0,0,0,0)");
  fade.addColorStop(0.2, "rgba(0,0,0,1)");
  fade.addColorStop(0.8, "rgba(0,0,0,1)");
  fade.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "source-over";
}

/** Backing store at the device's ratio, set once per scrub. */
export function fitCanvas(canvas: HTMLCanvasElement): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.round(canvas.clientWidth * dpr);
  const h = Math.round(canvas.clientHeight * dpr);
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
}
