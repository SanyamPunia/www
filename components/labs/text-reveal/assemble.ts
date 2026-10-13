import { clamp01, lerp } from "@/lib/lerp";
import { ARRIVE, ASSEMBLE, CHARS, hash } from "./patterns";

/**
 * The dots `assemble` draws: the copy's own letters, sampled into points,
 * flown in from a cloud spread over the whole stage.
 *
 * The letters are drawn onto an offscreen canvas at the exact place each
 * character sits in the DOM, and the canvas is read back on a grid. So the
 * dots land on the type the page is about to fade in, and the handover is a
 * crossfade between two drawings of the same glyphs.
 */

/** how many alpha steps a frame batches its dots into */
const BANDS = 6;
/** the opacity of a dot that has not set off yet */
const IDLE = 0.28;

export interface Cloud {
  count: number;
  /** where each dot starts, in stage pixels */
  sx: Float32Array;
  sy: Float32Array;
  /** the point on a letter each dot lands on */
  tx: Float32Array;
  ty: Float32Array;
  /** when it sets off, in seconds */
  delay: Float32Array;
  /** how far it bows off a straight line, as a share of the flight */
  curl: Float32Array;
  /** 0 for the line's plain words, 1 for the phrase it ends on */
  tone: Uint8Array;
  step: number;
}

/**
 * Sample the copy as it is laid out right now. Every rect is read against the
 * stage, so a transform on anything above the stage cancels out.
 */
export function sample(stage: HTMLElement, chars: HTMLElement[]): Cloud | null {
  const first = chars[0];
  if (!first) return null;
  const box = stage.getBoundingClientRect();
  const w = Math.ceil(box.width);
  const h = Math.ceil(box.height);
  if (w < 1 || h < 1) return null;

  const style = getComputedStyle(first);
  const size = Number.parseFloat(style.fontSize);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  // the DOM copy is set with kerning off, so the canvas has to match it
  ctx.fontKerning = "none";
  const metrics = ctx.measureText("Hg");
  const ascent = metrics.fontBoundingBoxAscent;
  const descent = metrics.fontBoundingBoxDescent;

  // plain words in red and the line-ending phrase in green, so one read tells
  // the two tones apart
  let top = Number.POSITIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  let left = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  chars.forEach((el, i) => {
    const meta = CHARS[i];
    if (!meta) return;
    const r = el.getBoundingClientRect();
    const x = r.left - box.left;
    const y = r.top - box.top;
    // an inline-block of one line puts its content area in the middle of its
    // line box, which is CSS half leading
    const base = y + (r.height - (ascent + descent)) / 2 + ascent;
    ctx.fillStyle = meta.hl ? "#00ff00" : "#ff0000";
    // the stylesheet's lowercase does not reach a canvas
    ctx.fillText(meta.ch.toLowerCase(), x, base);
    top = Math.min(top, y);
    bottom = Math.max(bottom, y + r.height);
    left = Math.min(left, x);
    right = Math.max(right, x + r.width);
  });

  const data = ctx.getImageData(0, 0, w, h).data;
  const step = Math.max(1.6, size / 11);
  const xs: number[] = [];
  const ys: number[] = [];
  const tones: number[] = [];
  let k = 0;
  for (let y = top; y < bottom; y += step) {
    for (let x = left; x < right; x += step) {
      k += 1;
      // a little jitter, or the dots read as a screen door rather than as ink
      const px = Math.round(x + (hash(k * 3) - 0.5) * step * 0.6);
      const py = Math.round(y + (hash(k * 3 + 1) - 0.5) * step * 0.6);
      if (px < 0 || py < 0 || px >= w || py >= h) continue;
      const o = (py * w + px) * 4;
      const red = data[o] ?? 0;
      const green = data[o + 1] ?? 0;
      if (red < 110 && green < 110) continue;
      xs.push(px);
      ys.push(py);
      tones.push(green > red ? 1 : 0);
    }
  }

  const count = xs.length;
  const cloud: Cloud = {
    count,
    sx: new Float32Array(count),
    sy: new Float32Array(count),
    tx: Float32Array.from(xs),
    ty: Float32Array.from(ys),
    delay: new Float32Array(count),
    curl: new Float32Array(count),
    tone: Uint8Array.from(tones),
    step,
  };
  const span = Math.max(1, right - left);
  for (let i = 0; i < count; i++) {
    cloud.sx[i] = hash(i * 7 + 11) * w;
    cloud.sy[i] = hash(i * 7 + 12) * h;
    // a sweep from the left of the copy to the right, roughened
    cloud.delay[i] =
      (((cloud.tx[i] ?? 0) - left) / span) * ASSEMBLE.sweep +
      hash(i * 7 + 13) * ASSEMBLE.jitter;
    cloud.curl[i] = (hash(i * 7 + 14) - 0.5) * 0.6;
  }
  return cloud;
}

const outCubic = (x: number) => 1 - (1 - x) ** 3;

/**
 * Draw the cloud at `t`. Dots are batched into one path per tone and alpha
 * band, so a frame is a dozen fills however many dots there are.
 */
export function draw(
  ctx: CanvasRenderingContext2D,
  cloud: Cloud,
  t: number,
  inks: readonly [string, string],
): void {
  const { canvas } = ctx;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const fade = outCubic(clamp01((t - ARRIVE) / ASSEMBLE.fade));
  if (fade >= 1) return;
  const scale = canvas.width / Math.max(1, canvas.clientWidth);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  const paths = Array.from({ length: BANDS * 2 }, () => new Path2D());
  for (let i = 0; i < cloud.count; i++) {
    const sx = cloud.sx[i] ?? 0;
    const sy = cloud.sy[i] ?? 0;
    const tx = cloud.tx[i] ?? 0;
    const ty = cloud.ty[i] ?? 0;
    const k = outCubic(clamp01((t - (cloud.delay[i] ?? 0)) / ASSEMBLE.flight));
    // bowed off the straight line by a share of its own length, so the cloud
    // swirls in rather than converging on rails
    const dx = tx - sx;
    const dy = ty - sy;
    const bow = Math.sin(Math.PI * k) * (cloud.curl[i] ?? 0);
    const x = lerp(sx, tx, k) - dy * bow;
    const y = lerp(sy, ty, k) + dx * bow;
    const alpha = lerp(IDLE, 1, k) * (1 - fade);
    const size = cloud.step * lerp(0.55, 0.85, k);
    const band = Math.min(BANDS - 1, Math.floor(alpha * BANDS));
    paths[(cloud.tone[i] ?? 0) * BANDS + band]?.rect(
      x - size / 2,
      y - size / 2,
      size,
      size,
    );
  }
  paths.forEach((path, p) => {
    ctx.fillStyle = inks[p >= BANDS ? 1 : 0];
    ctx.globalAlpha = ((p % BANDS) + 0.5) / BANDS;
    ctx.fill(path);
  });
  ctx.globalAlpha = 1;
}

export function clear(ctx: CanvasRenderingContext2D): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}
