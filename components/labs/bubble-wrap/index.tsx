"use client";

import { useReducedMotion } from "motion/react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { TextMorph } from "torph/react";
import { ArrowCounterClockwiseIcon } from "@/components/icons";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { drawBox } from "./box";
import {
  armBubbles,
  buzz,
  crinkle,
  hiss,
  pop,
  rustle,
  sigh,
} from "./bubble-sound";
import {
  CELLS,
  createFilm,
  drawFilm,
  type Film,
  TOUCHES,
  uploadBack,
} from "./shader";
import {
  type Bubble,
  type BubbleEvent,
  COLS,
  COUNT,
  type Contact,
  fallen,
  filmHeight,
  type Layout,
  layout,
  left,
  onSheet,
  RISE,
  ROWS,
  sheet,
  shown,
  step,
  toSheet,
  toStage,
  under,
} from "./sheet";

/* ─────────────────────────────────────────────────────────
 * BUBBLE WRAP
 *
 *   press    a fingertip comes down on the film, at PRESS a dome a second
 *   squeeze  the air in less room is at a higher pressure, so the dome bulges
 *   burst    past its film's limit it pops, and the bubbles beside it quiver
 *   drag     a finger held down rolls over the next bubble at depth: a row
 *   dud      one in sixteen has a pinhole, and hisses flat instead
 *   new      the sheet is pulled off the box and a fresh one slid on
 * ───────────────────────────────────────────────────────── */

/** how long a fingertip takes to come from a dome's top to the box, in seconds */
const PRESS = 0.12;
/**
 * A hand let go keeps pressing this long before it lifts, since a thumb does
 * not stop the instant a mouse button comes up. It is what lets a firm click
 * pop a bubble and a light one only squash it.
 */
const FOLLOW = 0.035;
/** a mouse's or a pen's fingertip, as a share of the bubble's radius: a thumb */
const FINGER = 1.6;
/** a finger's own width, clamped to this range of bubble radii */
const TOUCH_MIN = 1.3;
const TOUCH_MAX = 2.2;
/** how fast a lifting finger leaves, in dome heights a second */
const LIFT = 9;
/** the sheet coming off and the new one going on, in seconds */
const OFF = 0.32;
const ON = 0.56;
/** crinkles on crushed film are rate limited, or a drag is a buzz */
const CRINKLE_GAP = 0.08;
/** where the keyboard starts, the middle of the sheet */
const KEY_START = Math.floor(ROWS / 2) * COLS + Math.floor(COLS / 2);

interface Hand {
  contact: Contact;
  down: boolean;
  /** a pen reports pressure, and its depth follows it */
  pen: boolean;
  pressure: number;
  /** where the fingertip started, for a pen's depth */
  z0: number;
  px: number;
  py: number;
  pz: number;
  crinkleAt: number;
  /** when the hand was let go, on the page's clock in seconds */
  upAt: number;
}

interface Slide {
  phase: "off" | "on";
  t0: number;
}

interface Live {
  l: Layout | null;
  bubbles: Bubble[];
  round: number;
  hands: Map<number, Hand>;
  film: Film | null;
  flat: CanvasRenderingContext2D | null;
  box: HTMLCanvasElement | null;
  dpr: number;
  raf: number;
  last: number;
  reduce: boolean;
  focus: number;
  keyed: boolean;
  slide: Slide | null;
  offset: number;
  lift: number;
  ring: [number, number, number];
  count: number;
}

/** the key's own hand, apart from every pointer id */
const KEY = -1;

function rgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0.42, 0.42, 0.42];
  const n = Number.parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** a new layout keeps every bubble's state, only where it sits moves */
function refit(old: Bubble[], l: Layout, round: number): Bubble[] {
  const fresh = sheet(l, round);
  if (old.length !== fresh.length) return fresh;
  return fresh.map((b, i) => ({ ...old[i], x: b.x, y: b.y, a: b.a }));
}

const easeIn = (t: number) => t * t * t;
const easeOut = (t: number) => 1 - (1 - t) ** 3.6;

export default function BubbleWrap() {
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();
  const [count, setCount] = useState(COUNT);
  const [say, setSay] = useState("");

  const live = useRef<Live>({
    l: null,
    bubbles: [],
    round: 0,
    hands: new Map(),
    film: null,
    flat: null,
    box: null,
    dpr: 1,
    raf: 0,
    last: 0,
    reduce: false,
    focus: KEY_START,
    keyed: false,
    slide: null,
    offset: 0,
    lift: 0,
    ring: [0.42, 0.42, 0.42],
    count: COUNT,
  });

  /** every bubble's two texels, the fingers, and one draw */
  const draw = useCallback((now: number) => {
    const s = live.current;
    const l = s.l;
    const c = canvas.current;
    if (!l || !c) return;
    const t = now / 1000;
    for (const b of s.bubbles) {
      const o = (b.row * COLS * 2 + b.col * 2) * 4;
      CELLS[o] = b.x;
      CELLS[o + 1] = b.y;
      CELLS[o + 2] = b.a;
      CELLS[o + 3] = b.seed;
      CELLS[o + 4] = shown(b, t);
      CELLS[o + 5] = fallen(b, t, s.reduce);
      CELLS[o + 6] = b.popped ? 0 : Math.max(0, 1 - b.s);
      CELLS[o + 7] = 0;
    }
    if (s.film) {
      const touches = new Float32Array(TOUCHES * 4);
      let n = 0;
      for (const h of s.hands.values()) {
        if (n >= TOUCHES) break;
        touches.set(
          [h.contact.x, h.contact.y, h.contact.z, h.contact.r],
          n * 4,
        );
        n++;
      }
      const f = s.bubbles[s.focus];
      drawFilm(s.film, {
        width: c.width,
        height: c.height,
        dpr: s.dpr,
        stageW: l.stageW,
        stageH: l.stageH,
        cx: l.cx + s.offset,
        cy: l.cy,
        cos: l.cos,
        sin: l.sin,
        w: l.w,
        h: l.h,
        pitch: l.pitch,
        x0: l.x0,
        y0: l.y0,
        touches,
        count: n,
        focus: [f.x, f.y, f.a + 3.2, s.keyed && !s.slide ? 1 : 0],
        ring: s.ring,
        lift: s.lift,
      });
    } else if (s.flat && s.box) {
      drawFlat(s.flat, s, t);
    }
  }, []);

  const report = useCallback(() => {
    const s = live.current;
    const n = left(s.bubbles);
    if (n !== s.count) {
      s.count = n;
      setCount(n);
    }
    return n;
  }, []);

  const frame = useCallback(
    (now: number) => {
      const s = live.current;
      const l = s.l;
      if (!l) {
        s.raf = 0;
        return;
      }
      const t = now / 1000;
      const dt = Math.min(0.05, Math.max(0, (now - s.last) / 1000));
      s.last = now;

      /* the fingertips: down at a dome a `PRESS`, up at `LIFT` */
      const top = l.radius * RISE;
      for (const [id, h] of s.hands) {
        const c = h.contact;
        h.pz = c.z;
        if (h.down || t - h.upAt < FOLLOW) {
          if (h.pen) {
            const target = h.z0 * (1 - Math.min(1, h.pressure * 1.3));
            c.z += (target - c.z) * (1 - Math.exp(-dt / 0.03));
          } else {
            c.z = Math.max(0, c.z - (top / PRESS) * dt);
          }
        } else {
          c.z += top * LIFT * dt;
          if (c.z > top * 2) s.hands.delete(id);
        }
      }

      const contacts = [...s.hands.values()].map((h) => h.contact);
      const events: BubbleEvent[] = [];
      let moving = step(s.bubbles, contacts, t, s.reduce, events);

      const pan = (b: Bubble) => {
        const [x] = toStage(l, b.x, b.y);
        return ((x + s.offset) / l.stageW) * 1.4 - 0.7;
      };
      for (const e of events) {
        const b = s.bubbles[e.i];
        if (e.kind === "pop") {
          pop(e.strength, pan(b), b.seed);
          buzz(12);
          const n = report();
          setSay(
            n === 0 ? "Popped. That was the last one." : `Popped. ${n} left.`,
          );
        } else if (e.kind === "hiss") {
          hiss(pan(b));
        } else {
          sigh(pan(b));
          buzz(4);
          const n = report();
          setSay(`That one was a dud. ${n} left.`);
        }
      }

      /* film that has already burst crackles when it is crushed again */
      for (const h of s.hands.values()) {
        if (!h.down) continue;
        const c = h.contact;
        const i = under(s.bubbles, c.x, c.y);
        const b = i >= 0 ? s.bubbles[i] : null;
        if (
          b?.popped &&
          t - b.poppedAt > 0.1 &&
          t - h.crinkleAt > CRINKLE_GAP
        ) {
          const moved = Math.hypot(c.x - h.px, c.y - h.py) > 1.2;
          if (moved || c.z < h.pz - 0.2) {
            crinkle(moved ? 0.8 : 1, pan(b));
            h.crinkleAt = t;
          }
        }
        h.px = c.x;
        h.py = c.y;
      }

      /* a sheet coming off to the left and a fresh one going on from the right */
      if (s.slide) {
        const span = l.stageW * 1.06;
        if (s.slide.phase === "off") {
          const k = Math.min(1, (t - s.slide.t0) / OFF);
          s.offset = -span * easeIn(k);
          s.lift = Math.min(1, k * 3);
          if (k >= 1) {
            s.round++;
            s.bubbles = sheet(l, s.round);
            report();
            s.slide = { phase: "on", t0: t };
            rustle();
          }
        } else {
          const k = Math.min(1, (t - s.slide.t0) / ON);
          const e = easeOut(k);
          s.offset = span * (1 - e);
          s.lift = 1 - e;
          if (k >= 1) {
            s.slide = null;
            s.offset = 0;
            s.lift = 0;
            setSay(`A fresh sheet. ${COUNT} bubbles.`);
          }
        }
        moving = true;
      }

      draw(now);
      s.raf = moving || s.hands.size > 0 ? requestAnimationFrame(frame) : 0;
    },
    [draw, report],
  );

  const start = useCallback(() => {
    const s = live.current;
    if (s.raf) return;
    s.last = performance.now();
    s.raf = requestAnimationFrame(frame);
  }, [frame]);

  /** a fingertip landing on the sheet, at the film's own height there */
  const land = useCallback(
    (
      id: number,
      x: number,
      y: number,
      r: number,
      pen: boolean,
      pressure: number,
    ) => {
      const s = live.current;
      const z0 = filmHeight(s.bubbles, x, y) + 0.4;
      s.hands.set(id, {
        contact: { x, y, z: z0, r },
        down: true,
        pen,
        pressure,
        z0,
        px: x,
        py: y,
        pz: z0,
        crinkleAt: 0,
        upAt: 0,
      });
      start();
    },
    [start],
  );

  const release = useCallback(
    (id: number) => {
      const h = live.current.hands.get(id);
      if (!h || !h.down) return;
      h.down = false;
      h.upAt = performance.now() / 1000;
      start();
    },
    [start],
  );

  const fresh = useCallback(() => {
    const s = live.current;
    if (!s.l || s.slide) return;
    armBubbles();
    s.hands.clear();
    rustle();
    if (s.reduce) {
      s.round++;
      s.bubbles = sheet(s.l, s.round);
      report();
      setSay(`A fresh sheet. ${COUNT} bubbles.`);
      draw(performance.now());
      return;
    }
    s.slide = { phase: "off", t0: performance.now() / 1000 };
    start();
  }, [draw, report, start]);

  /* the context, the box, the size, and the gesture */
  useEffect(() => {
    const node = stage.current;
    const c = canvas.current;
    if (!node || !c) return;
    const s = live.current;
    s.ring = rgb(
      getComputedStyle(document.documentElement).getPropertyValue(
        "--color-text-secondary",
      ),
    );

    const init = () => {
      const gl = c.getContext("webgl2", {
        antialias: false,
        alpha: false,
        premultipliedAlpha: false,
      });
      s.film = gl ? createFilm(gl) : null;
      if (!s.film) s.flat = c.getContext("2d");
    };
    init();

    const paint = () => {
      const l = s.l;
      if (!l) return;
      const box = s.box ?? document.createElement("canvas");
      s.box = box;
      box.width = Math.round(l.stageW * s.dpr);
      box.height = Math.round(l.stageH * s.dpr);
      const ctx = box.getContext("2d");
      if (!ctx) return;
      drawBox(ctx, l.stageW, l.stageH, s.dpr);
      if (s.film) uploadBack(s.film, box);
      draw(performance.now());
      c.dataset.ready = "true";
    };

    let rebuild = 0;
    const read = () => {
      const w = node.clientWidth;
      const h = node.clientHeight;
      if (w === 0 || h === 0) return;
      const first = !s.l;
      s.dpr = Math.min(2, window.devicePixelRatio || 1);
      s.l = layout(w, h);
      s.bubbles = first ? sheet(s.l, s.round) : refit(s.bubbles, s.l, s.round);
      /* where each bubble is on the stage, for the preview recorder's presses */
      node.dataset.centres = JSON.stringify(
        s.bubbles.map((b) => toStage(s.l as Layout, b.x, b.y).map(Math.round)),
      );
      c.width = Math.round(w * s.dpr);
      c.height = Math.round(h * s.dpr);
      window.clearTimeout(rebuild);
      if (first) paint();
      else rebuild = window.setTimeout(paint, 140);
      draw(performance.now());
    };
    read();
    const resize = new ResizeObserver(read);
    resize.observe(node);
    /* the print uses the page's own face, so it is drawn again once it loads */
    void document.fonts?.ready.then(() => paint());

    const local = (e: PointerEvent): [number, number] | null => {
      const l = s.l;
      if (!l) return null;
      const rect = node.getBoundingClientRect();
      return toSheet(l, e.clientX - rect.left, e.clientY - rect.top, s.offset);
    };

    const down = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if ((e.target as Element).closest("button")) return;
      armBubbles();
      const l = s.l;
      const at = local(e);
      if (!l || !at || s.slide || !onSheet(l, at[0], at[1])) return;
      e.preventDefault();
      node.setPointerCapture(e.pointerId);
      const touch = e.pointerType === "touch";
      const r = touch
        ? Math.min(TOUCH_MAX, Math.max(TOUCH_MIN, e.width / 2 / l.radius)) *
          l.radius
        : FINGER * l.radius;
      const pen = e.pointerType === "pen" && e.pressure > 0;
      land(e.pointerId, at[0], at[1], r, pen, e.pressure);
    };

    const move = (e: PointerEvent) => {
      const at = local(e);
      if (!at || !s.l) return;
      const h = s.hands.get(e.pointerId);
      if (h?.down) {
        h.contact.x = at[0];
        h.contact.y = at[1];
        if (h.pen) h.pressure = e.pressure;
        return;
      }
      if (s.hands.size === 0) {
        node.style.cursor = onSheet(s.l, at[0], at[1]) ? "pointer" : "";
      }
    };

    const up = (e: PointerEvent) => release(e.pointerId);
    const blur = () => {
      for (const id of s.hands.keys()) release(id);
    };

    node.addEventListener("pointerdown", down);
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerup", up);
    node.addEventListener("pointercancel", up);
    node.addEventListener("lostpointercapture", up);
    window.addEventListener("blur", blur);

    const lost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(s.raf);
      s.raf = 0;
      s.film = null;
    };
    const restored = () => {
      init();
      if (s.film && s.box) uploadBack(s.film, s.box);
      draw(performance.now());
    };
    c.addEventListener("webglcontextlost", lost);
    c.addEventListener("webglcontextrestored", restored);

    return () => {
      window.clearTimeout(rebuild);
      resize.disconnect();
      node.removeEventListener("pointerdown", down);
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", up);
      node.removeEventListener("pointercancel", up);
      node.removeEventListener("lostpointercapture", up);
      window.removeEventListener("blur", blur);
      c.removeEventListener("webglcontextlost", lost);
      c.removeEventListener("webglcontextrestored", restored);
      cancelAnimationFrame(s.raf);
      s.raf = 0;
    };
  }, [draw, land, release]);

  useEffect(() => {
    live.current.reduce = reduce ?? false;
  }, [reduce]);

  /* the keyboard: the arrows walk the sheet, Space or Enter held presses */
  const keyDown = (e: React.KeyboardEvent) => {
    const s = live.current;
    const l = s.l;
    if (!l) return;
    const b = s.bubbles[s.focus];
    const walk = (row: number, col: number) => {
      if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return;
      s.focus = row * COLS + col;
      draw(performance.now());
    };
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      walk(b.row, b.col + (e.key === "ArrowLeft" ? -1 : 1));
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const row = b.row + (e.key === "ArrowUp" ? -1 : 1);
      if (row < 0 || row >= ROWS) return;
      /* the nearest bubble in the next row, since the rows are offset */
      let best = 0;
      let gap = Number.POSITIVE_INFINITY;
      for (let col = 0; col < COLS; col++) {
        const d = Math.abs(s.bubbles[row * COLS + col].x - b.x);
        if (d < gap) {
          gap = d;
          best = col;
        }
      }
      walk(row, best);
    } else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (e.repeat || s.hands.has(KEY) || s.slide) return;
      armBubbles();
      land(KEY, b.x, b.y, FINGER * l.radius, false, 0);
    }
  };

  const keyUp = (e: React.KeyboardEvent) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      release(KEY);
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div
        ref={stage}
        className="relative aspect-8/5 min-h-78 w-full touch-none select-none overflow-hidden bg-fill"
      >
        <canvas
          ref={canvas}
          className="absolute inset-0 size-full opacity-0 transition-opacity duration-200 data-[ready=true]:opacity-100"
        />
        <button
          type="button"
          aria-label={`Bubble wrap, ${count} left. Arrow keys choose a bubble. Hold Space to press it.`}
          onKeyDown={keyDown}
          onKeyUp={keyUp}
          onFocus={() => {
            live.current.keyed = true;
            draw(performance.now());
          }}
          onBlur={() => {
            live.current.keyed = false;
            release(KEY);
            draw(performance.now());
          }}
          className="pointer-events-none absolute inset-0 focus-visible:outline-none"
        />
        <div className="pointer-events-none absolute inset-0 ring-1 ring-stroke ring-inset" />
        <div className="pointer-events-none absolute bottom-3 left-3 flex h-7 items-center rounded-full bg-bg/90 px-3 text-meta text-text-secondary tabular-nums ring-1 ring-stroke">
          <TextMorph duration={160} ease="cubic-bezier(0.4, 0, 0.2, 1)">
            {count === 0 ? "none left" : `${count} left`}
          </TextMorph>
        </div>
        <Tooltip label="New sheet">
          <button
            type="button"
            aria-label="New sheet"
            onClick={fresh}
            className="absolute right-3 bottom-3 grid size-7 cursor-pointer place-items-center rounded-full bg-bg/90 text-text-secondary ring-1 ring-stroke transition-all duration-150 hover:bg-bg hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2 active:bg-surface"
          >
            <ArrowCounterClockwiseIcon className="size-3.5" />
          </button>
        </Tooltip>
        <p className="sr-only" aria-live="polite">
          {say}
        </p>
      </div>
    </TooltipProvider>
  );
}

/**
 * Without WebGL 2: the box, and each bubble as a lit disc. No bending, no
 * fingers, no room in the film, and the sheet still pops.
 */
function drawFlat(ctx: CanvasRenderingContext2D, s: Live, t: number): void {
  const l = s.l;
  if (!l || !s.box) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(s.box, 0, 0);
  ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
  ctx.translate(l.cx + s.offset, l.cy);
  ctx.rotate(l.angle);
  ctx.translate(-l.w / 2, -l.h / 2);
  ctx.fillStyle = "rgba(240, 246, 248, 0.18)";
  ctx.fillRect(0, 0, l.w, l.h);
  for (const b of s.bubbles) {
    const g = fallen(b, t, s.reduce);
    const r = b.a * (1 - 0.08 * g);
    const lit = ctx.createRadialGradient(
      b.x - r * 0.35,
      b.y - r * 0.4,
      r * 0.05,
      b.x,
      b.y,
      r,
    );
    const a = (1 - g) * Math.min(1, shown(b, t));
    lit.addColorStop(0, `rgba(255, 255, 255, ${0.15 + 0.7 * a})`);
    lit.addColorStop(0.5, `rgba(240, 246, 250, ${0.08 + 0.12 * a})`);
    lit.addColorStop(1, `rgba(230, 238, 242, ${0.25 + 0.3 * g})`);
    ctx.fillStyle = lit;
    ctx.beginPath();
    ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}
