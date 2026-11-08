"use client";

import { useReducedMotion } from "motion/react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { type Drop, spawn, step } from "./drops";
import {
  createGlass,
  drawFrame,
  type Glass,
  loadScene,
  MAXD,
  MAXS,
  resizeField,
} from "./shader";

/*
 * A fogged window over a snowy street. Drag across the glass to wipe the
 * condensation off, hold Shift for the flat of a hand, and hold Space over the
 * glass to breathe it back over. The fog also grows back on its own.
 *
 * `shader.ts` is the drawing and the glass's memory, `drops.ts` the running
 * water. This file is the gesture and the frame loop. Nothing renders per
 * frame: every number the loop reads lives in a ref, and React only holds
 * whether the picture has loaded.
 */

const SRC = "/assets/condensation/street.webp";

/** the brush radius in px: a fingertip, or the flat of a hand with Shift */
const BRUSH = { finger: 24, palm: 64 } as const;

/** how long the glass takes to fog over when it is first seen, in seconds */
const INTRO = 2.4;

/** how damp the air is, from 0 to 1, which sets how fast the fog grows back */
const HUMIDITY = 0.55;

type Seg = [number, number, number, number, number, number, number, number];

export default function Condensation() {
  const reduce = useReducedMotion();
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const live = useRef({
    glass: null as Glass | null,
    image: null as HTMLImageElement | null,
    raf: 0,
    seen: false,
    reduce: false,
    cssW: 0,
    cssH: 0,
    dpr: 1,
    start: 0,
    last: 0,
    refogAcc: 0,
    dryAcc: 0,
    introDone: false,
    segs: [] as Seg[],
    drops: [] as Drop[],
    pointer: {
      x: 0,
      y: 0,
      down: false,
      palm: false,
      hover: false,
      last: null as { x: number; y: number } | null,
      lastT: 0,
    },
    breathing: false,
    breathT: 0,
    /** water pushed ahead of the brush, spent a drop at a time */
    water: 0,
    seg: new Float32Array(MAXS * 4),
    segP: new Float32Array(MAXS * 4),
    dropBuf: new Float32Array(MAXD * 4),
  });

  const brush = useCallback(
    () => (live.current.pointer.palm ? BRUSH.palm : BRUSH.finger),
    [],
  );

  /** the drawn cursor: a ring the size of what a press would wipe */
  const placeRing = useCallback(() => {
    const el = ring.current;
    if (!el) return;
    const p = live.current.pointer;
    const r = brush();
    el.style.width = `${r * 2}px`;
    el.style.height = `${r * 2}px`;
    el.style.transform = `translate(${p.x - r}px, ${p.y - r}px)`;
  }, [brush]);

  const pushSeg = useCallback(
    (
      ax: number,
      ay: number,
      bx: number,
      by: number,
      r: number,
      strength: number,
      rim: number,
      film: number,
    ) => {
      const segs = live.current.segs;
      // past the cap a stroke stretches the last segment rather than dropping
      // the rest of the frame's movement
      if (segs.length >= MAXS) {
        const s = segs[segs.length - 1];
        if (s) {
          s[2] = bx;
          s[3] = by;
        }
        return;
      }
      segs.push([ax, ay, bx, by, r, strength, rim, film]);
    },
    [],
  );

  const stroke = useCallback(
    (ax: number, ay: number, bx: number, by: number, speed: number) => {
      const s = live.current;
      // a fast hand presses lighter, so it clears a narrower band
      const r = brush() * (1 - Math.min(speed / 4000, 0.25));
      pushSeg(ax, ay, bx, by, r, 0.9, 0.9, 0.38);
      if (s.reduce) return;
      s.water +=
        Math.hypot(bx - ax, by - ay) * (s.pointer.palm ? 0.018 : 0.011);
      while (s.water > 1) {
        s.water -= 1;
        const t = Math.random();
        spawn(
          s.drops,
          ax + (bx - ax) * t + (Math.random() - 0.5) * r * 1.2,
          ay + (by - ay) * t + r * (0.75 + Math.random() * 0.2),
          (s.pointer.palm ? 2.6 : 2.0) + Math.random() * 2.6,
        );
      }
    },
    [brush, pushSeg],
  );

  const tick = useCallback(
    function frame(t: number) {
      const s = live.current;
      s.raf = 0;
      const g = s.glass;
      if (!g || !s.seen) return;
      if (!s.start) {
        s.start = t;
        s.last = t;
      }
      // a stalled tab comes back to a 50ms step at most, not a leap
      const dt = Math.min(0.05, Math.max(0, (t - s.last) / 1000));
      s.last = t;
      const age = (t - s.start) / 1000;

      if (!s.reduce) step(s.drops, dt, s.cssH, pushSeg);

      const h = HUMIDITY;
      const introP = s.reduce ? 1 : Math.min(1, age / INTRO);
      const floor = introP < 1 ? 1 - (1 - introP) ** 3 : s.introDone ? 0 : 1;
      if (introP >= 1) s.introDone = true;

      // banked until each is worth a step of the field's own precision
      s.refogAcc += dt * (0.006 + h * h * 0.11);
      s.dryAcc += dt * 0.09;
      let refog = 0;
      let dry = 0;
      if (s.refogAcc >= g.quant) {
        refog = s.refogAcc;
        s.refogAcc = 0;
      }
      if (s.dryAcc >= g.quant) {
        dry = s.dryAcc;
        s.dryAcc = 0;
      }

      let breath: [number, number, number, number] = [0, 0, 0, 0];
      if (s.breathing) {
        s.breathT += dt;
        const p = s.pointer;
        const bx = p.last || p.hover ? p.x : s.cssW / 2;
        const by = p.last || p.hover ? p.y : s.cssH / 2;
        const grow = s.reduce ? 1 : Math.min(1, s.breathT / 1.2);
        breath = [
          bx,
          by,
          Math.min(Math.max(s.cssW, s.cssH) * 0.45, 90 + grow * 230),
          dt * 2.2,
        ];
      }

      const n = Math.min(s.segs.length, MAXS);
      for (let i = 0; i < n; i++) {
        const v = s.segs[i];
        if (!v) continue;
        s.seg.set([v[0], v[1], v[2], v[3]], i * 4);
        s.segP.set([v[4], v[5], v[6], v[7]], i * 4);
      }
      s.segs.length = 0;

      const nd = Math.min(s.drops.length, MAXD);
      for (let i = 0; i < nd; i++) {
        const d = s.drops[i];
        if (d) s.dropBuf.set([d.x, d.y, d.r, d.stretch], i * 4);
      }

      drawFrame(g, {
        cssW: s.cssW,
        cssH: s.cssH,
        width: Math.round(s.cssW * s.dpr),
        height: Math.round(s.cssH * s.dpr),
        seg: s.seg,
        segP: s.segP,
        segN: n,
        drops: s.dropBuf,
        dropN: nd,
        refog,
        dry,
        breath,
        floor,
        time: age,
        grain: s.reduce ? 0 : age,
      });

      s.raf = requestAnimationFrame(frame);
    },
    [pushSeg],
  );

  const start = useCallback(() => {
    const s = live.current;
    if (s.raf || !s.seen || !s.glass) return;
    s.raf = requestAnimationFrame(tick);
  }, [tick]);

  const setBreath = useCallback(
    (on: boolean) => {
      const s = live.current;
      if (on === s.breathing) return;
      s.breathing = on;
      s.breathT = 0;
      start();
    },
    [start],
  );

  useEffect(() => {
    live.current.reduce = reduce === true;
  }, [reduce]);

  // the context, the photograph, the stage's size, and whether anyone is looking
  useEffect(() => {
    const node = stage.current;
    const c = canvas.current;
    if (!node || !c) return;
    const s = live.current;

    const size = (fog: number) => {
      const w = node.clientWidth;
      const h = node.clientHeight;
      if (w === 0 || h === 0) return;
      s.cssW = w;
      s.cssH = h;
      s.dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = Math.round(w * s.dpr);
      c.height = Math.round(h * s.dpr);
      if (s.glass?.sharp) resizeField(s.glass, w, h, fog);
    };

    const init = () => {
      const gl = c.getContext("webgl2", {
        antialias: false,
        alpha: false,
        premultipliedAlpha: false,
      });
      s.glass = gl ? createGlass(gl) : null;
      if (!s.glass) {
        setFailed(true);
        return false;
      }
      return true;
    };

    if (!init()) return;

    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      s.image = image;
      const g = s.glass;
      if (!g) return;
      loadScene(g, image);
      // the intro fogs a clear pane over, unless nothing is meant to travel
      size(s.reduce ? 1 : 0);
      setReady(true);
      start();
    };
    image.src = SRC;

    const resize = new ResizeObserver(() => size(1));
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
      s.glass = null;
    };
    const restored = () => {
      if (!init() || !s.glass || !s.image) return;
      loadScene(s.glass, s.image);
      size(1);
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
      image.onload = null;
    };
  }, [start]);

  // Shift widens the brush and Space breathes, while the demo has the pointer
  // or the focus. Everywhere else both keys are the page's.
  useEffect(() => {
    const s = live.current;
    const ours = () => s.pointer.hover || s.pointer.down;
    const control = (e: KeyboardEvent) =>
      e.target instanceof HTMLElement &&
      e.target.closest("button, input, textarea, select") !== null;

    const down = (e: KeyboardEvent) => {
      if (
        e.key === "Shift" &&
        !s.pointer.palm &&
        (s.pointer.hover || s.pointer.down)
      ) {
        s.pointer.palm = true;
        placeRing();
      }
      if (e.code === "Space" && !control(e) && ours()) {
        e.preventDefault();
        setBreath(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "Shift" && s.pointer.palm) {
        s.pointer.palm = false;
        placeRing();
      }
      if (e.code === "Space" && !control(e)) setBreath(false);
    };
    const blur = () => {
      setBreath(false);
      s.pointer.down = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [placeRing, setBreath]);

  const local = (e: { clientX: number; clientY: number }) => {
    const box = stage.current?.getBoundingClientRect();
    return box
      ? { x: e.clientX - box.left, y: e.clientY - box.top }
      : { x: 0, y: 0 };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !live.current.glass) return;
    const p = live.current.pointer;
    e.currentTarget.setPointerCapture(e.pointerId);
    const at = local(e);
    p.down = true;
    p.palm = e.shiftKey;
    p.x = at.x;
    p.y = at.y;
    p.last = at;
    p.lastT = e.timeStamp;
    // a press with no movement still wipes the patch under it
    stroke(at.x, at.y, at.x + 0.01, at.y, 0);
    placeRing();
    start();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = live.current.pointer;
    const at = local(e);
    p.x = at.x;
    p.y = at.y;
    if (e.pointerType === "mouse") {
      p.hover = true;
      if (!p.down) p.palm = e.shiftKey;
      if (ring.current) ring.current.style.opacity = "1";
      placeRing();
    }
    if (!p.down || !p.last) return;
    if (e.buttons === 0) {
      p.down = false;
      return;
    }
    const native = e.nativeEvent;
    const list = native.getCoalescedEvents?.() ?? [];
    for (const ev of list.length ? list : [native]) {
      const q = local(ev);
      const dt = Math.max(1, ev.timeStamp - p.lastT);
      const speed = (Math.hypot(q.x - p.last.x, q.y - p.last.y) / dt) * 1000;
      stroke(p.last.x, p.last.y, q.x, q.y, speed);
      p.last = q;
      p.lastT = ev.timeStamp;
    }
  };

  const onPointerUp = () => {
    live.current.pointer.down = false;
  };

  const onPointerLeave = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;
    live.current.pointer.hover = false;
    if (ring.current) ring.current.style.opacity = "0";
  };

  return (
    <div className="w-full min-w-0">
      <div
        ref={stage}
        role="img"
        aria-label="A fogged window over a snowy street at night. Drag across it to wipe the condensation away."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onLostPointerCapture={onPointerUp}
        onPointerLeave={onPointerLeave}
        onContextMenu={(e) => e.preventDefault()}
        className={cn(
          "relative isolate aspect-8/5 min-h-78 w-full touch-none select-none overflow-hidden rounded-lg bg-inverse-bg",
          !failed && "cursor-none [&_*]:cursor-none",
        )}
      >
        <canvas
          ref={canvas}
          className={cn(
            "absolute inset-0 block size-full transition-opacity duration-200",
            ready ? "opacity-100" : "opacity-0",
          )}
        />

        {failed && (
          <>
            {/* biome-ignore lint/performance/noImgElement: a still already on disk behind a fallback note, not worth an image pipeline */}
            <img
              src={SRC}
              alt=""
              draggable={false}
              className="absolute inset-0 size-full scale-110 select-none object-cover blur-md"
            />
            <p className="absolute inset-x-4 bottom-4 mx-auto w-fit rounded-full bg-inverse-bg/60 px-3 py-1 text-center text-meta text-inverse-text">
              This needs WebGL2, so the glass cannot be wiped here.
            </p>
          </>
        )}

        <div
          ref={ring}
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-0 rounded-full border border-inverse-text/55 opacity-0 transition-[width,height,opacity] duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
        />
      </div>
    </div>
  );
}
