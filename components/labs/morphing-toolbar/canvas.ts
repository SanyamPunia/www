/*
 * What is drawn on the board, as plain data, and how to paint it and hit it.
 *
 * An object is a pen stroke, a shape or a run of text, in stage pixels. The
 * board keeps a list of them and paints the whole list on a 2D canvas whenever
 * it changes, so undo is a copy of the list and nothing here is retained
 * between paints. Every function takes the context it draws on, so this file
 * knows nothing about React.
 */

export type ShapeKind = "rect" | "ellipse" | "line" | "arrow";

export interface Point {
  x: number;
  y: number;
}

export type Obj =
  | { type: "pen"; color: string; w: number; pts: Point[] }
  | {
      type: ShapeKind;
      color: string;
      fill: boolean;
      w: number;
      x0: number;
      y0: number;
      x1: number;
      y1: number;
    }
  | {
      type: "text";
      color: string;
      x: number;
      y: number;
      text: string;
      size: number;
      weight: number;
      width: number;
    };

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** a line of text is 1.25 of its size tall */
export const lineHeight = (size: number) => size * 1.25;

export const fontOf = (size: number, weight: number, family: string) =>
  `${weight} ${size}px ${family}`;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function draw(
  ctx: CanvasRenderingContext2D,
  o: Obj,
  ink: (c: string) => string,
  family: string,
) {
  const c = ink(o.color);
  ctx.strokeStyle = c;
  ctx.fillStyle = c;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (o.type === "pen") {
    ctx.lineWidth = o.w;
    const p = o.pts;
    const first = p[0];
    if (!first) return;
    if (p.length < 3) {
      ctx.beginPath();
      ctx.arc(first.x, first.y, o.w / 2, 0, Math.PI * 2);
      ctx.fill();
      if (p.length < 2) return;
    }
    // a quadratic through every midpoint, so a stroke made of short pointer
    // samples reads as one smooth line rather than a polyline
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < p.length - 1; i++) {
      const a = p[i];
      const b = p[i + 1];
      if (!a || !b) continue;
      ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
    }
    const end = p[p.length - 1];
    if (end) ctx.lineTo(end.x, end.y);
    ctx.stroke();
    return;
  }
  if (o.type === "text") {
    ctx.font = fontOf(o.size, o.weight, family);
    ctx.textBaseline = "top";
    const lh = lineHeight(o.size);
    o.text.split("\n").forEach((line, i) => {
      ctx.fillText(line, o.x, o.y + i * lh + (lh - o.size) / 2);
    });
    return;
  }
  ctx.lineWidth = o.w;
  const x = Math.min(o.x0, o.x1);
  const y = Math.min(o.y0, o.y1);
  const w = Math.abs(o.x1 - o.x0);
  const h = Math.abs(o.y1 - o.y0);
  ctx.beginPath();
  if (o.type === "rect") {
    ctx.roundRect(x, y, w, h, Math.min(8, w / 2, h / 2));
  } else if (o.type === "ellipse") {
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  } else {
    ctx.moveTo(o.x0, o.y0);
    ctx.lineTo(o.x1, o.y1);
    if (o.type === "arrow") {
      const ang = Math.atan2(o.y1 - o.y0, o.x1 - o.x0);
      const len = Math.min(16, Math.hypot(w, h) * 0.45);
      for (const s of [-1, 1]) {
        ctx.moveTo(o.x1, o.y1);
        ctx.lineTo(
          o.x1 - len * Math.cos(ang + s * 0.5),
          o.y1 - len * Math.sin(ang + s * 0.5),
        );
      }
    }
    ctx.stroke();
    return;
  }
  if (o.fill) ctx.fill();
  else ctx.stroke();
}

export function bbox(o: Obj): Box {
  if (o.type === "pen") {
    let x0 = Number.POSITIVE_INFINITY;
    let y0 = Number.POSITIVE_INFINITY;
    let x1 = Number.NEGATIVE_INFINITY;
    let y1 = Number.NEGATIVE_INFINITY;
    for (const p of o.pts) {
      x0 = Math.min(x0, p.x);
      y0 = Math.min(y0, p.y);
      x1 = Math.max(x1, p.x);
      y1 = Math.max(y1, p.y);
    }
    const r = o.w / 2;
    return { x: x0 - r, y: y0 - r, w: x1 - x0 + o.w, h: y1 - y0 + o.w };
  }
  if (o.type === "text") {
    return {
      x: o.x,
      y: o.y,
      w: o.width,
      h: o.text.split("\n").length * lineHeight(o.size),
    };
  }
  const r = o.w / 2;
  return {
    x: Math.min(o.x0, o.x1) - r,
    y: Math.min(o.y0, o.y1) - r,
    w: Math.abs(o.x1 - o.x0) + o.w,
    h: Math.abs(o.y1 - o.y0) + o.w,
  };
}

function distSeg(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = dx * dx + dy * dy;
  const t = l ? clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / l, 0, 1) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

export function inBox(p: Point, b: Box, pad: number) {
  return (
    p.x >= b.x - pad &&
    p.x <= b.x + b.w + pad &&
    p.y >= b.y - pad &&
    p.y <= b.y + b.h + pad
  );
}

/** whether a circle of radius `r` at `p` touches the object's ink */
export function hits(o: Obj, p: Point, r: number) {
  if (o.type === "pen") {
    const rr = r + o.w / 2;
    const first = o.pts[0];
    if (o.pts.length === 1 && first) {
      return Math.hypot(p.x - first.x, p.y - first.y) < rr;
    }
    for (let i = 1; i < o.pts.length; i++) {
      const a = o.pts[i - 1];
      const b = o.pts[i];
      if (a && b && distSeg(p, a, b) < rr) return true;
    }
    return false;
  }
  if (o.type === "line" || o.type === "arrow") {
    return distSeg(p, { x: o.x0, y: o.y0 }, { x: o.x1, y: o.y1 }) < r + o.w;
  }
  return inBox(p, bbox(o), r);
}

/** the topmost object under a point, with a little slack for thin lines */
export function hitTest(objects: readonly Obj[], p: Point) {
  for (let i = objects.length - 1; i >= 0; i--) {
    const o = objects[i];
    if (!o) continue;
    const thin = o.type === "pen" || o.type === "line" || o.type === "arrow";
    if (thin ? hits(o, p, 8) : inBox(p, bbox(o), 6)) return o;
  }
  return null;
}

export function move(o: Obj, dx: number, dy: number) {
  if (o.type === "pen") {
    for (const p of o.pts) {
      p.x += dx;
      p.y += dy;
    }
  } else if (o.type === "text") {
    o.x += dx;
    o.y += dy;
  } else {
    o.x0 += dx;
    o.x1 += dx;
    o.y0 += dy;
    o.y1 += dy;
  }
}

/** Shift squares a box and snaps a line to the nearest 45 degrees */
export function constrain(o: Extract<Obj, { x0: number }>, shift: boolean) {
  if (!shift) return;
  const dx = o.x1 - o.x0;
  const dy = o.y1 - o.y0;
  if (o.type === "rect" || o.type === "ellipse") {
    const s = Math.max(Math.abs(dx), Math.abs(dy));
    o.x1 = o.x0 + Math.sign(dx || 1) * s;
    o.y1 = o.y0 + Math.sign(dy || 1) * s;
  } else {
    const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
    const len = Math.hypot(dx, dy);
    o.x1 = o.x0 + Math.cos(ang) * len;
    o.y1 = o.y0 + Math.sin(ang) * len;
  }
}

export const cloneAll = (objects: readonly Obj[]): Obj[] =>
  JSON.parse(JSON.stringify(objects)) as Obj[];
