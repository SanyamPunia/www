/*
 * The passage, its layout, and the atlas the grains are cut from.
 *
 * Layout is done here and not by the browser, since the canvas has to draw the
 * same lines the page is laid out with. Each piece is wrapped with the 2D
 * context's own `measureText`, and the DOM copy renders those lines as given.
 */

import { clamp01 } from "@/lib/lerp";

/** one sentence, cut where the scroll should breathe */
export const PASSAGE = [
  "Every line you read",
  "turns to dust",
  "the moment you scroll past it.",
  "Scroll back up",
  "and it remembers its shape.",
] as const;

/** a line's centre, as a share of the stage's height, where it stops being crisp */
const LEAVE_AT = 0.32;
/** and where it is crisp again on the way up from the foot */
const ARRIVE_AT = 0.76;
/** where a line that is arriving is still fully scattered: just under the foot */
const SCATTERED_AT = 1.1;

export interface Piece {
  lines: string[];
  /** top of the piece in the scroll content, css px */
  top: number;
  height: number;
  /** top of the piece's lines in the atlas, device px */
  atlasTop: number;
  first: number;
  count: number;
}

export interface Passage {
  pieces: Piece[];
  font: number;
  leading: number;
  pad: number;
  contentHeight: number;
  atlas: HTMLCanvasElement;
  cells: Float32Array;
  cell: number;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    // measured lowercased, since that is how the site displays it
    if (line && ctx.measureText(next.toLocaleLowerCase()).width > max) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** the font string for a size, so the canvas and the measure agree */
export function fontFor(size: number, family: string): string {
  return `600 ${size}px ${family}`;
}

export function typeFor(w: number): { font: number; pad: number } {
  return {
    font: Math.round(Math.min(58, Math.max(24, w * 0.068))),
    pad: Math.round(Math.max(20, w * 0.08)),
  };
}

/**
 * Lays the passage out for a stage, draws it to an atlas at device pixels, and
 * cuts the atlas into cells, keeping only the ones with ink in them.
 */
export function buildPassage(
  w: number,
  h: number,
  dpr: number,
  family: string,
): Passage | null {
  const { font, pad } = typeFor(w);
  const leading = Math.round(font * 1.08);
  const tracking = -0.035 * font;
  const atlas = document.createElement("canvas");
  const ctx = atlas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  const setFont = (scale: number) => {
    ctx.font = fontFor(font * scale, family);
    // letterSpacing is not in every engine yet, and a passage without it is
    // only a little looser
    if ("letterSpacing" in ctx) ctx.letterSpacing = `${tracking * scale}px`;
  };
  setFont(1);
  const max = w - pad * 2;
  const wrapped = PASSAGE.map((text) => wrap(ctx, text, max));

  // the first piece's middle starts on the crisp band, and every next one sits
  // a short gap under the last, so about two are on the stage at once
  const gap = Math.round(h * 0.14);
  const room = Math.round(font * 0.3);
  const pieces: Piece[] = [];
  let y = 0;
  let atlasY = 0;
  for (const lines of wrapped) {
    const height = lines.length * leading;
    const top = pieces.length === 0 ? Math.round(h * 0.5 - height / 2) : y;
    pieces.push({
      lines,
      top,
      height,
      atlasTop: Math.round((atlasY + room) * dpr),
      first: 0,
      count: 0,
    });
    y = top + height + gap;
    atlasY += height + room * 2;
  }
  const last = pieces[pieces.length - 1];
  // room for the last piece's middle to reach the head, so it leaves too
  const contentHeight = Math.round(last.top + last.height / 2 + h);

  atlas.width = Math.round(w * dpr);
  atlas.height = Math.ceil(atlasY * dpr);
  setFont(dpr);
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "middle";
  for (const p of pieces) {
    p.lines.forEach((line, i) => {
      ctx.fillText(
        line.toLocaleLowerCase(),
        pad * dpr,
        p.atlasTop + (i + 0.5) * leading * dpr,
      );
    });
  }

  // a cell is about two css pixels, a whole number of device pixels so a grain
  // at rest covers its cell exactly
  const cell = Math.max(2, Math.round(2 * dpr));
  const { width: aw, height: ah } = atlas;
  const data = ctx.getImageData(0, 0, aw, ah).data;
  const out: number[] = [];
  let seed = 1;
  for (const p of pieces) {
    p.first = out.length / 4;
    let widest = 1;
    for (const line of p.lines) {
      widest = Math.max(
        widest,
        ctx.measureText(line.toLocaleLowerCase()).width,
      );
    }
    const y0 = Math.max(0, p.atlasTop - Math.round(room * dpr));
    const y1 = Math.min(ah, p.atlasTop + Math.round((p.height + room) * dpr));
    for (let cy = y0; cy < y1; cy += cell) {
      for (let cx = 0; cx < aw; cx += cell) {
        if (!inked(data, aw, ah, cx, cy, cell)) continue;
        seed = (seed * 16807) % 2147483647;
        out.push(
          cx,
          cy,
          clamp01((cx - pad * dpr) / widest),
          (seed % 10000) / 10000,
        );
      }
    }
    p.count = out.length / 4 - p.first;
  }

  return {
    pieces,
    font,
    leading,
    pad,
    contentHeight,
    atlas,
    cells: new Float32Array(out),
    cell,
  };
}

function inked(
  data: Uint8ClampedArray,
  aw: number,
  ah: number,
  x: number,
  y: number,
  cell: number,
): boolean {
  const xe = Math.min(aw, x + cell);
  const ye = Math.min(ah, y + cell);
  for (let j = y; j < ye; j++) {
    for (let i = x; i < xe; i++) {
      if (data[(j * aw + i) * 4 + 3] > 3) return true;
    }
  }
  return false;
}

/**
 * A piece's trip for its place on the stage: below 0 while it is still
 * arriving from the foot, 0 in the crisp band, above 0 as it leaves at the head.
 */
export function tripFor(centre: number, h: number): number {
  const leave = clamp01((LEAVE_AT * h - centre) / (LEAVE_AT * h));
  if (leave > 0) return leave;
  return -clamp01((centre - ARRIVE_AT * h) / ((SCATTERED_AT - ARRIVE_AT) * h));
}
