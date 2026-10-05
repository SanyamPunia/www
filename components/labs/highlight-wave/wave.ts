import { alpha } from "./notes";

/*
 * The two things a mark draws, and the wave that changes them. DOM work and no
 * React: the bars are written straight into each paragraph's layer and the wave
 * is WAAPI on the character spans, so marking a run of text renders once.
 */

/** ms between one character's wave and the next */
export const STAGGER = 16;
/** ms one character takes to swell, glow and settle */
export const CHAR = 560;
/** how far behind the glow's peak the bar's leading edge runs, as a share of `CHAR` */
const TRAIL = 0.3;

/** a bar overhangs its text by this much either side, px */
const PAD_X = 2;

export interface Paint {
  ink: string;
  wash: string;
}

export const CLEAR = "rgb(0 0 0 / 0)";

/** a run, in paragraph offsets, that wore another mark's colour before this one */
export interface Under {
  start: number;
  end: number;
  paint: Paint;
}

/**
 * A mark's fragments merged to one box per line. Chrome hands back a box per
 * word as well as per line, since each word is its own `nowrap` span, and
 * drawing those as they come paints a darker sliver wherever two padded boxes
 * overlap at a space.
 */
function lines(rects: DOMRectList): DOMRect[] {
  const out: DOMRect[] = [];
  for (const r of rects) {
    if (r.width < 1) continue;
    const row = out.find((o) => Math.abs(o.top - r.top) < 2);
    if (!row) {
      out.push(DOMRect.fromRect(r));
      continue;
    }
    const left = Math.min(row.left, r.left);
    row.width = Math.max(row.right, r.right) - left;
    row.x = left;
  }
  return out;
}

/**
 * Every bar in a paragraph, rebuilt from its marks' line fragments.
 *
 * A mark is an inline span, so `getClientRects` hands back one box per line it
 * runs across, and each box is the font's own content area rather than the line
 * box: glyph height and a little, which is what a highlighter covers. Drawing
 * them in a layer under the text rather than as a background on the span is what
 * lets each line round its own ends and lets the wave sweep one line at a time.
 */
export function drawBars(para: HTMLElement, layer: HTMLElement): void {
  const origin = para.getBoundingClientRect();
  const bars: HTMLElement[] = [];
  for (const mark of para.querySelectorAll<HTMLElement>("[data-hl]")) {
    for (const r of lines(mark.getClientRects())) {
      const bar = document.createElement("span");
      bar.dataset.bar = mark.dataset.hl;
      bar.className = "absolute rounded-[0.22em]";
      bar.style.left = `${r.left - origin.left - PAD_X}px`;
      bar.style.top = `${r.top - origin.top}px`;
      bar.style.width = `${r.width + PAD_X * 2}px`;
      bar.style.height = `${r.height}px`;
      bar.style.backgroundColor = mark.dataset.wash ?? CLEAR;
      bars.push(bar);
    }
  }
  layer.replaceChildren(...bars);
}

/**
 * A tight core and a wide bloom. Every keyframe carries both layers, since a
 * shadow list only interpolates against a list of the same length.
 */
const halo = (glow: string, a: number, spread: number) =>
  `0 0 ${0.18 * spread}em ${alpha(glow, a)}, 0 0 ${0.7 * spread}em ${alpha(glow, a * 0.7)}`;

/**
 * One character's pass: it squashes narrow and tall as the wave lifts it, flares
 * in the swatch's own colour with a glow round it, overshoots on the way down
 * and lands in its new ink. The lift is a share of an em, so the wave is the same
 * shape at every size the text renders at.
 */
function swell(from: string, to: string, glow: string): Keyframe[] {
  return [
    {
      offset: 0,
      color: from,
      transform: "translateY(0) scale(1, 1)",
      textShadow: halo(glow, 0, 0),
      easing: "cubic-bezier(0.3, 0, 0.2, 1)",
    },
    {
      offset: 0.2,
      color: glow,
      transform: "translateY(-0.06em) scale(0.92, 1.08)",
      textShadow: halo(glow, 0.9, 1),
      easing: "cubic-bezier(0.4, 0, 0.2, 1)",
    },
    {
      offset: 0.5,
      color: glow,
      transform: "translateY(0.015em) scale(1.02, 0.985)",
      textShadow: halo(glow, 0.5, 0.6),
      easing: "cubic-bezier(0.2, 0, 0, 1)",
    },
    {
      offset: 1,
      color: to,
      transform: "translateY(0) scale(1, 1)",
      textShadow: halo(glow, 0, 0),
    },
  ];
}

/**
 * Runs the wave across one mark, from `from` to `to`, and returns how long it
 * lasts in ms.
 *
 * Every character holds `from` until its turn comes, through `fill: backwards`,
 * so the new colour arrives at the wave's front and nowhere ahead of it. A bar
 * sweeps `to` in over `from` on a gradient twice its own width, starting when
 * its line's first character is past its peak and running at the same speed the
 * characters do, so the bar trails the glow along every line in reading order.
 *
 * `hold` keeps the last frame, for a mark that is about to be removed: the
 * characters stay in the paragraph's tone and the bars stay clear until the
 * render that drops them.
 */
export function playWave(
  para: HTMLElement,
  layer: HTMLElement,
  id: number,
  from: Paint,
  to: Paint,
  glow: string,
  hold = false,
  under: readonly Under[] = [],
): number {
  const mark = para.querySelector<HTMLElement>(`[data-hl="${id}"]`);
  if (!mark) return 0;
  const chars = [...mark.querySelectorAll<HTMLElement>("[data-ch]")];
  const fill = hold ? "both" : "backwards";

  for (const c of chars) for (const a of c.getAnimations()) a.cancel();
  const was = chars.map((c) => {
    const at = Number(c.dataset.at);
    return under.find((u) => at >= u.start && at < u.end) ?? null;
  });
  chars.forEach((c, i) => {
    c.animate(swell(was[i]?.paint.ink ?? from.ink, to.ink, glow), {
      duration: CHAR,
      delay: i * STAGGER,
      fill,
    });
  });

  // which characters sit on which line, read off their centres
  const rects = chars.map((c) => c.getBoundingClientRect());
  const mids = rects.map((r) => r.top + r.height / 2);
  const origin = layer.getBoundingClientRect();

  for (const bar of layer.querySelectorAll<HTMLElement>(`[data-bar="${id}"]`)) {
    const r = bar.getBoundingClientRect();
    let first = -1;
    let count = 0;
    mids.forEach((y, i) => {
      if (y < r.top || y > r.bottom) return;
      if (first < 0) first = i;
      count++;
    });
    if (first < 0) continue;

    const delay = first * STAGGER + CHAR * TRAIL;
    const duration = Math.max(count * STAGGER, 120);

    /*
     * A mark this one was laid over keeps its bar until the front reaches it.
     * The sweep's front is the gradient's midpoint, which crosses the bar
     * linearly, so each old piece is cut from the left at exactly that speed and
     * the new wash takes its place rather than the old one blinking out first.
     */
    for (const u of under) {
      let x0 = Number.POSITIVE_INFINITY;
      let x1 = Number.NEGATIVE_INFINITY;
      for (let i = first; i < first + count; i++) {
        if (was[i] !== u) continue;
        x0 = Math.min(x0, rects[i].left);
        x1 = Math.max(x1, rects[i].right);
      }
      if (!Number.isFinite(x0)) continue;
      const a = Math.max(x0 - PAD_X, r.left);
      const b = Math.min(x1 + PAD_X, r.right);
      const old = document.createElement("span");
      old.className = "absolute rounded-[0.22em]";
      old.style.left = `${a - origin.left}px`;
      old.style.top = bar.style.top;
      old.style.width = `${b - a}px`;
      old.style.height = bar.style.height;
      old.style.backgroundColor = u.paint.wash;
      layer.insertBefore(old, bar);
      const cutAway = old.animate(
        [{ clipPath: "inset(0 0 0 0)" }, { clipPath: "inset(0 0 0 100%)" }],
        {
          duration: Math.max(((b - a) / r.width) * duration, 1),
          delay: delay + ((a - r.left) / r.width) * duration,
          fill: "both",
        },
      );
      cutAway.onfinish = () => old.remove();
    }

    bar.style.backgroundColor = CLEAR;
    bar.style.backgroundImage = `linear-gradient(90deg, ${to.wash} 0 45%, ${from.wash} 55% 100%)`;
    bar.style.backgroundSize = "200% 100%";
    const sweep = bar.animate(
      [{ backgroundPosition: "100% 0" }, { backgroundPosition: "0% 0" }],
      { duration, delay, fill },
    );
    if (!hold) {
      sweep.onfinish = () => {
        bar.style.backgroundImage = "";
        bar.style.backgroundColor = to.wash;
      };
    }
  }

  return (chars.length - 1) * STAGGER + CHAR;
}
