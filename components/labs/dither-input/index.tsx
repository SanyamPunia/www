"use client";

import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { approach } from "@/lib/lerp";
import { createGlow, drawGlow, type Glow, PULSES, type Tone } from "./glow";

/*
 * A text field whose glow is a dithered gradient. The light is a halo round the field
 * that gathers at the caret and follows it as you type. Each keystroke sends a
 * small pulse out from the caret, and Enter sends a large one.
 *
 * `glow.ts` is the drawing, one fragment shader over the stage. This file is
 * the field, the caret's position and the frame loop. Nothing renders per
 * frame: every eased number lives in a ref and one loop hands them to the
 * shader, and the loop stops once the field is blurred and everything has
 * settled.
 */

/** a cell's size in css px, rounded to whole device pixels */
const CELL = 3;
/** how quickly the caret's lamp glides, focus fades and typing cools */
const GLIDE = 0.08;
const FADE = 0.3;
const COOL = 0.5;
/** a pulse is done once its ring has faded, in seconds */
const PULSE_LIFE = 2;
/** a pulse's strength for a keystroke, a deletion and a send */
const KEY = 0.45;
const DELETE = 0.3;
const SEND = 1.6;

function hex(value: string): Tone {
  const n = Number.parseInt(value.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/**
 * The glow's two ramps, dim to bright, scoped here and not tokens. The field
 * mixes from the warm set on its left to the cool set on its right, so the glow
 * is a gradient in hue and the dither steps through it in flat colours.
 */
const WARM_RAMP = new Float32Array(
  ["#2b1660", "#6a2fd6", "#e0559f", "#ffd6b8"].flatMap(hex),
);
const COOL_RAMP = new Float32Array(
  ["#0e2a66", "#2f66f0", "#33cbe0", "#e3fbff"].flatMap(hex),
);

/** a token's colour as 0..1 floats, normalised by a 2D context */
function tone(name: string): Tone {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return [0, 0, 0];
  ctx.fillStyle = value;
  const hex = ctx.fillStyle;
  if (!hex.startsWith("#")) return [0, 0, 0];
  const n = Number.parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export default function DitherInput() {
  const reduce = useReducedMotion();
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [failed, setFailed] = useState(false);

  // everything the loop and the field read, kept out of React
  const live = useRef({
    glow: null as Glow | null,
    raf: 0,
    last: 0,
    seen: false,
    reduce: false,
    w: 0,
    h: 0,
    dpr: 1,
    time: 0,
    // the field's box on the stage, in css px
    rect: [0, 0, 0, 0] as [number, number, number, number],
    radius: 0,
    // where the caret's lamp is and where the caret is, in css px
    cx: 0,
    cy: 0,
    tx: 0,
    ty: 0,
    focused: false,
    focus: 0,
    energy: 0,
    // x, y, age, strength per pulse, in device px
    pulses: new Float32Array(PULSES * 4),
    measure: null as CanvasRenderingContext2D | null,
    ground: [0, 0, 0] as Tone,
  });

  const draw = useCallback(() => {
    const s = live.current;
    const c = canvas.current;
    if (!s.glow || !c) return;
    const d = s.dpr;
    const [x, y, w, h] = s.rect;
    drawGlow(s.glow, {
      width: c.width,
      height: c.height,
      dpr: d,
      fit: Math.min(1, Math.max(0.45, Math.min(s.w, s.h) / 480)),
      cell: Math.max(1, Math.round(CELL * d)),
      time: s.time,
      rect: [(x + w / 2) * d, (y + h / 2) * d, (w / 2) * d, (h / 2) * d],
      radius: s.radius * d,
      caret: [s.cx * d, s.cy * d],
      focus: s.focus,
      energy: s.energy,
      pulses: s.pulses,
      ground: s.ground,
      warm: WARM_RAMP,
      cool: COOL_RAMP,
    });
  }, []);

  /** whether anything is still moving, so the loop can stop when nothing is */
  const settled = useCallback(() => {
    const s = live.current;
    if (s.focused) return false;
    if (s.focus > 0.002 || s.energy > 0.002) return false;
    for (let i = 0; i < PULSES; i++) if (s.pulses[i * 4 + 3] > 0) return false;
    return Math.abs(s.tx - s.cx) < 0.1 && Math.abs(s.ty - s.cy) < 0.1;
  }, []);

  const tick = useCallback(
    (now: number) => {
      const s = live.current;
      const dt = Math.min(0.05, (now - s.last) / 1000);
      s.last = now;
      s.time += dt;
      const k = approach(GLIDE, dt);
      s.cx += (s.tx - s.cx) * k;
      s.cy += (s.ty - s.cy) * k;
      s.focus += ((s.focused ? 1 : 0) - s.focus) * approach(FADE, dt);
      s.energy *= 1 - approach(COOL, dt);
      if (s.energy < 0.005) s.energy = 0;
      if (!s.focused && s.focus < 0.005) s.focus = 0;
      const p = s.pulses;
      for (let i = 0; i < PULSES; i++) {
        if (p[i * 4 + 3] <= 0) continue;
        p[i * 4 + 2] += dt;
        if (p[i * 4 + 2] > PULSE_LIFE) p[i * 4 + 3] = 0;
      }
      draw();
      s.raf =
        s.seen && !s.reduce && !settled() ? requestAnimationFrame(tick) : 0;
    },
    [draw, settled],
  );

  const start = useCallback(() => {
    const s = live.current;
    if (s.reduce) {
      // no easing and no loop: every value is where it is going, drawn once
      s.cx = s.tx;
      s.cy = s.ty;
      s.focus = s.focused ? 1 : 0;
      s.energy = 0;
      draw();
      return;
    }
    if (s.raf || !s.seen) return;
    s.last = performance.now();
    s.raf = requestAnimationFrame(tick);
  }, [draw, tick]);

  /**
   * Where the caret is on the stage. The field's text is measured with the
   * field's own font, lowercased the way the site displays it, up to the
   * caret, and moved by however far the field has scrolled sideways.
   */
  const aim = useCallback(() => {
    const s = live.current;
    const el = input.current;
    const node = stage.current;
    if (!el || !node) return;
    const [x, y, w, h] = s.rect;
    s.ty = y + h / 2;
    if (!s.focused) {
      s.tx = x + w / 2;
      return;
    }
    const style = getComputedStyle(el);
    if (!s.measure)
      s.measure = document.createElement("canvas").getContext("2d");
    const ctx = s.measure;
    const pad =
      Number.parseFloat(style.paddingLeft) +
      Number.parseFloat(style.borderLeftWidth);
    let width = 0;
    if (ctx) {
      ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const before = el.value.slice(0, el.selectionEnd ?? el.value.length);
      width = ctx.measureText(before.toLocaleLowerCase()).width;
    }
    const inner = w - pad * 2;
    s.tx = x + pad + Math.min(inner, Math.max(0, width - el.scrollLeft));
  }, []);

  const pulse = useCallback((strength: number) => {
    const s = live.current;
    if (s.reduce) return;
    const p = s.pulses;
    // a free slot, or else the oldest one
    let slot = 0;
    for (let i = 0; i < PULSES; i++) {
      if (p[i * 4 + 3] <= 0) {
        slot = i;
        break;
      }
      if (p[i * 4 + 2] > p[slot * 4 + 2]) slot = i;
    }
    // from where the caret is going, so a pulse leaves the new letter
    p.set([s.tx * s.dpr, s.ty * s.dpr, 0, strength], slot * 4);
    s.energy = Math.min(1.4, s.energy + strength * 0.6);
  }, []);

  const onFocus = () => {
    live.current.focused = true;
    aim();
    start();
  };

  const onBlur = () => {
    live.current.focused = false;
    aim();
    start();
  };

  const onInput = (e: React.FormEvent<HTMLInputElement>) => {
    const native = e.nativeEvent as InputEvent;
    aim();
    pulse(native.inputType?.startsWith("delete") ? DELETE : KEY);
    start();
  };

  // the caret moves on arrows, clicks and selections as well as on typing
  const onSelect = () => {
    aim();
    start();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    aim();
    pulse(SEND);
    start();
  };

  useEffect(() => {
    const s = live.current;
    s.reduce = reduce === true;
    if (s.reduce) {
      cancelAnimationFrame(s.raf);
      s.raf = 0;
      s.pulses.fill(0);
    }
    start();
  }, [reduce, start]);

  // the context, the stage's size, the field's box, and whether anyone is looking
  useEffect(() => {
    const node = stage.current;
    const c = canvas.current;
    const el = input.current;
    if (!node || !c || !el) return;
    const s = live.current;
    s.ground = tone("--color-inverse-bg");

    const init = () => {
      const gl = c.getContext("webgl", {
        alpha: false,
        antialias: false,
        powerPreference: "low-power",
      });
      s.glow = gl ? createGlow(gl) : null;
      setFailed(!s.glow);
    };
    init();

    const read = () => {
      const w = node.clientWidth;
      const h = node.clientHeight;
      if (w === 0 || h === 0) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      s.w = w;
      s.h = h;
      s.dpr = dpr;
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      const stageBox = node.getBoundingClientRect();
      const box = el.getBoundingClientRect();
      s.rect = [
        box.left - stageBox.left,
        box.top - stageBox.top,
        box.width,
        box.height,
      ];
      s.radius =
        Number.parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
      aim();
      s.cx = s.tx;
      s.cy = s.ty;
      draw();
    };
    read();
    const resize = new ResizeObserver(read);
    resize.observe(node);

    // no frames for a stage nobody is looking at
    const seen = new IntersectionObserver(([entry]) => {
      s.seen = entry?.isIntersecting ?? false;
      if (s.seen) start();
    });
    seen.observe(node);

    const lost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(s.raf);
      s.raf = 0;
      s.glow = null;
    };
    const restored = () => {
      init();
      draw();
      start();
    };
    c.addEventListener("webglcontextlost", lost);
    c.addEventListener("webglcontextrestored", restored);

    return () => {
      resize.disconnect();
      seen.disconnect();
      c.removeEventListener("webglcontextlost", lost);
      c.removeEventListener("webglcontextrestored", restored);
      cancelAnimationFrame(s.raf);
      s.raf = 0;
    };
  }, [aim, draw, start]);

  return (
    <div
      ref={stage}
      onPointerDown={(e) => {
        if (e.target !== input.current) {
          e.preventDefault();
          input.current?.focus();
        }
      }}
      className="relative isolate aspect-8/5 min-h-78 w-full cursor-text overflow-hidden rounded-lg bg-inverse-bg"
    >
      <canvas
        ref={canvas}
        className="pointer-events-none absolute inset-0 block size-full [image-rendering:pixelated]"
      />
      <div className="absolute inset-0 grid place-items-center px-8">
        <input
          ref={input}
          type="text"
          aria-label="Message"
          placeholder="Type something, then press Enter"
          autoComplete="off"
          spellCheck={false}
          onFocus={onFocus}
          onBlur={onBlur}
          onInput={onInput}
          onSelect={onSelect}
          onKeyDown={onKeyDown}
          className={
            failed
              ? "h-12 w-full max-w-120 rounded-md border border-inverse-stroke bg-inverse-fill px-4 text-body text-inverse-text caret-inverse-text outline-none transition-all duration-200 placeholder:text-body placeholder:text-inverse-text-secondary focus:border-inverse-text-secondary focus:shadow-[0_0_0_4px_var(--color-inverse-stroke)]"
              : "h-12 w-full max-w-120 rounded-md border border-inverse-stroke bg-inverse-fill px-4 text-body text-inverse-text caret-inverse-text outline-none transition-all duration-200 placeholder:text-body placeholder:text-inverse-text-secondary focus:border-inverse-text-secondary"
          }
        />
      </div>
    </div>
  );
}
