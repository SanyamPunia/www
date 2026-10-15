"use client";

import { useReducedMotion } from "motion/react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { TextMorph } from "torph/react";
import { MinusIcon, PlusIcon } from "@/components/icons";
import { FOCUS } from "@/components/lab/controls";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { approach } from "@/lib/lerp";
import { cn } from "@/lib/utils";
import { createLens, drawLens, type Lens, uploadMap } from "./lens";
import { DESIGN, drawMap } from "./map";
import {
  clampHeight,
  type Geometry,
  geometry,
  HEIGHT,
  heightFor,
  LIFT,
  magnification,
  optics,
  STEP,
} from "./optics";

/*
 * A magnifying glass over a printed harbour map. Drag the glass to read the
 * print, press the map to bring it there, and raise or lower it to change how
 * much it magnifies. Raising it also moves its shadow off to the side and
 * tightens the bright spot it focuses onto the paper.
 *
 * `optics.ts` is the glass as a function of its height, `lens.ts` the one
 * shader that draws the stage, and `map.ts` the print. This file is the
 * gesture and the frame loop.
 *
 * Nothing renders per frame. The glass's position, height and swing live in a
 * ref and one loop hands them to the shader, and the loop stops once the glass
 * has settled. The only state is the magnification readout, which changes on a
 * press, a key or a pinch.
 */

/** where the glass rests, in the map's design space: on the note it leaves */
const REST = { x: 401, y: 136 } as const;

/** time constants, in seconds, for each way the glass moves */
const TAU = {
  /** following a hand, close enough to feel held */
  drag: 0.05,
  /** gliding to a point that was pressed */
  glide: 0.16,
  /** arriving on the map the first time it is seen */
  intro: 0.3,
  /** rising and falling */
  height: 0.12,
  /** the handle swinging behind a moving glass */
  swing: 0.14,
} as const;

/** the handle points down and to the right, about 53 degrees under level */
const HANDLE_ANGLE = 0.92;
/** radians of swing per px/s of sideways speed, and the most it swings */
const SWING = { gain: 0.00032, max: 0.22 } as const;
/** how far an arrow key moves the glass, and with Shift held */
const NUDGE = { step: 8, big: 32 } as const;
/** a touch that travels further than this is a scroll, not a tap */
const TAP_SLOP = 10;

interface Layout {
  w: number;
  h: number;
  dpr: number;
}

interface Grab {
  id: number;
  kind: "glass" | "map" | "tap";
  dx: number;
  dy: number;
  startX: number;
  startY: number;
  moved: boolean;
}

interface Live {
  layout: Layout | null;
  geo: Geometry;
  x: number;
  y: number;
  tx: number;
  ty: number;
  tau: number;
  vx: number;
  u: number;
  ut: number;
  held: boolean;
  hover: number;
  hoverTarget: number;
  swing: number;
  raf: number;
  last: number;
  lens: Lens | null;
  map: HTMLCanvasElement | null;
  mapReady: boolean;
  seen: boolean;
  intro: boolean;
  reduce: boolean;
  grab: Grab | null;
  pinch: number;
}

/** the steps are quarters, so 3.75 shows as itself rather than as 3.8 */
const format = (mag: number) => `${Number.parseFloat(mag.toFixed(2))}×`;

/** the design space's point on the stage, under the same cover fit the map uses */
function fromDesign(l: Layout, x: number, y: number): [number, number] {
  const s = Math.max(l.w / DESIGN.w, l.h / DESIGN.h);
  return [(l.w - DESIGN.w * s) / 2 + x * s, (l.h - DESIGN.h * s) / 2 + y * s];
}

export default function Loupe() {
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const flat = useRef<HTMLCanvasElement>(null);
  const glassHit = useRef<HTMLButtonElement>(null);
  const handleHit = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const [failed, setFailed] = useState(false);
  const [mag, setMag] = useState(magnification(HEIGHT.rest));
  const readout = format(mag);

  const live = useRef<Live>({
    layout: null,
    geo: geometry(538, 336),
    x: 0,
    y: 0,
    tx: 0,
    ty: 0,
    tau: TAU.intro,
    vx: 0,
    u: HEIGHT.rest,
    ut: HEIGHT.rest,
    held: false,
    hover: 0,
    hoverTarget: 0,
    swing: 0,
    raf: 0,
    last: 0,
    lens: null,
    map: null,
    mapReady: false,
    seen: false,
    intro: false,
    reduce: false,
    grab: null,
    pinch: 1,
  });

  /** one frame of the stage, from whatever the refs hold now */
  const draw = useCallback(() => {
    const s = live.current;
    const l = s.layout;
    if (!l || !s.mapReady) return;
    const g = s.geo;
    const o = optics(s.u, g);
    const angle = HANDLE_ANGLE + s.swing;
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);

    if (s.lens) {
      const d = l.dpr;
      drawLens(s.lens, {
        width: Math.round(l.w * d),
        height: Math.round(l.h * d),
        dpr: d,
        cx: s.x * d,
        cy: s.y * d,
        r: g.r * d,
        rim: g.rim * d,
        mag: o.mag,
        distortion: o.distortion,
        chroma: o.chroma,
        shadowX: o.shadowX * d,
        shadowY: o.shadowY * d,
        blur: o.blur * d,
        caustic: o.caustic * d,
        gain: o.gain,
        dirX,
        dirY,
        handle: g.handle * d,
        grip: g.grip * d,
        hover: s.hover,
      });
    } else {
      drawFlat(flat.current, s, o.mag, dirX, dirY);
    }

    // the hit boxes ride the glass, written to the node so a drag renders nothing
    const glass = glassHit.current;
    if (glass) {
      const reach = g.r + g.rim;
      glass.style.width = `${reach * 2}px`;
      glass.style.height = `${reach * 2}px`;
      glass.style.transform = `translate(${s.x - reach}px, ${s.y - reach}px)`;
    }
    const handle = handleHit.current;
    if (handle) {
      const start = g.r + g.rim * 0.5;
      // never thinner than a finger, whatever the drawing is
      const thick = Math.max(g.grip * 2 + 4, 24);
      handle.style.width = `${g.handle + g.rim * 0.5 + g.grip}px`;
      handle.style.height = `${thick}px`;
      handle.style.transform = `translate(${s.x + dirX * start}px, ${
        s.y + dirY * start - thick / 2
      }px) rotate(${angle}rad)`;
    }
  }, []);

  const step = useCallback((dt: number) => {
    const s = live.current;
    const px = s.x;
    const k = s.reduce ? 1 : approach(s.tau, dt);
    s.x += (s.tx - s.x) * k;
    s.y += (s.ty - s.y) * k;
    s.vx = dt > 0 ? (s.x - px) / dt : 0;

    const want = s.held ? Math.min(HEIGHT.max + LIFT, s.ut + LIFT) : s.ut;
    s.u += (want - s.u) * (s.reduce ? 1 : approach(TAU.height, dt));
    s.hover += (s.hoverTarget - s.hover) * approach(0.1, dt);

    const lean = s.reduce
      ? 0
      : Math.max(-SWING.max, Math.min(SWING.max, -s.vx * SWING.gain));
    s.swing += (lean - s.swing) * (s.reduce ? 1 : approach(TAU.swing, dt));

    return (
      Math.abs(s.tx - s.x) > 0.05 ||
      Math.abs(s.ty - s.y) > 0.05 ||
      Math.abs(want - s.u) > 1e-4 ||
      Math.abs(s.hoverTarget - s.hover) > 0.005 ||
      Math.abs(lean - s.swing) > 5e-4
    );
  }, []);

  const tick = useCallback(
    function frame(now: number) {
      const s = live.current;
      s.raf = 0;
      // a stalled tab comes back to a 50ms step at most, not a leap
      const dt = Math.min(0.05, (now - s.last) / 1000);
      s.last = now;
      const moving = step(dt);
      draw();
      if (moving && s.seen) s.raf = requestAnimationFrame(frame);
    },
    [draw, step],
  );

  /** wake the loop, which sleeps once the glass has settled */
  const start = useCallback(() => {
    const s = live.current;
    if (s.raf || !s.seen || !s.mapReady) return;
    s.last = performance.now();
    s.raf = requestAnimationFrame(tick);
  }, [tick]);

  /** the glass's first arrival, from off the stage's lower right corner */
  const arrive = useCallback(() => {
    const s = live.current;
    const l = s.layout;
    if (s.intro || !s.seen || !s.mapReady || !l) return;
    s.intro = true;
    s.tau = TAU.intro;
    if (s.reduce) {
      s.x = s.tx;
      s.y = s.ty;
      draw();
    }
    start();
  }, [draw, start]);

  /** set the height the glass is heading for, and the readout with it */
  const setHeight = useCallback(
    (u: number) => {
      const s = live.current;
      s.ut = clampHeight(u);
      // a pinch is continuous, so the readout settles on twentieths
      setMag(Math.round(magnification(s.ut) * 20) / 20);
      start();
    },
    [start],
  );

  const stepMag = useCallback(
    (dir: 1 | -1) => {
      const s = live.current;
      const mag = magnification(s.ut);
      const next = Math.round((mag + dir * STEP) / STEP) * STEP;
      setHeight(heightFor(next));
    },
    [setHeight],
  );

  /** a client point in stage px, clamped onto the stage */
  const toStage = useCallback((clientX: number, clientY: number) => {
    const box = stage.current?.getBoundingClientRect();
    if (!box) return { x: 0, y: 0 };
    return {
      x: Math.min(box.width, Math.max(0, clientX - box.left)),
      y: Math.min(box.height, Math.max(0, clientY - box.top)),
    };
  }, []);

  /** whether a stage point is on the glass, its frame or its handle */
  const onGlass = useCallback((x: number, y: number) => {
    const s = live.current;
    const g = s.geo;
    const dx = x - s.x;
    const dy = y - s.y;
    if (Math.hypot(dx, dy) <= g.r + g.rim) return true;
    const angle = HANDLE_ANGLE + s.swing;
    const ax = Math.cos(angle);
    const ay = Math.sin(angle);
    const along = dx * ax + dy * ay;
    const across = Math.abs(-dx * ay + dy * ax);
    return (
      along > g.r && along < g.r + g.rim + g.handle + g.grip && across < 12
    );
  }, []);

  // the context, the stage's size, the print, and whether anyone is looking
  useEffect(() => {
    const node = stage.current;
    const c = canvas.current;
    if (!node || !c) return;
    const s = live.current;
    let alive = true;
    let rebuild = 0;

    const init = () => {
      const gl = c.getContext("webgl2", {
        alpha: false,
        antialias: false,
        powerPreference: "low-power",
      });
      s.lens = gl ? createLens(gl) : null;
      setFailed(!s.lens);
    };
    init();

    /** draw the print at several times the screen's density and hand it over */
    const build = async () => {
      const l = s.layout;
      if (!l) return;
      const family = getComputedStyle(node).fontFamily;
      // canvas text falls back silently when a face has not loaded yet
      await Promise.all(
        ["400", "500", "600", "italic 500", "italic 600"].map((w) =>
          document.fonts.load(`${w} 12px ${family}`).catch(() => []),
        ),
      );
      if (!alive) return;
      const max = s.lens
        ? (s.lens.gl.getParameter(s.lens.gl.MAX_TEXTURE_SIZE) as number)
        : 4096;
      // dense enough to stay sharp at 4x on a retina screen, within a budget
      const k = Math.min(
        l.dpr * 4,
        Math.min(max, 4096) / Math.max(l.w, l.h),
        Math.sqrt(9e6 / (l.w * l.h)),
      );
      const map = s.map ?? document.createElement("canvas");
      map.width = Math.round(l.w * k);
      map.height = Math.round(l.h * k);
      const ctx = map.getContext("2d");
      if (!ctx) return;
      drawMap(ctx, map.width, map.height, family);
      s.map = map;
      if (s.lens) uploadMap(s.lens, map);
      const first = !s.mapReady;
      s.mapReady = true;
      draw();
      if (first) {
        node.dataset.ready = "true";
        arrive();
      }
    };

    const read = () => {
      const w = node.clientWidth;
      const h = node.clientHeight;
      if (w === 0 || h === 0) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const prev = s.layout;
      const l = { w, h, dpr };
      s.layout = l;
      s.geo = geometry(w, h);
      for (const el of [c, flat.current]) {
        if (!el) continue;
        el.width = Math.round(w * dpr);
        el.height = Math.round(h * dpr);
      }
      if (!prev) {
        const [rx, ry] = fromDesign(l, REST.x, REST.y);
        s.tx = rx;
        s.ty = ry;
        // off the lower right corner, handle first
        s.x = w + s.geo.r * 1.4;
        s.y = h + s.geo.r * 0.9;
      } else {
        // a resize keeps the glass over the same part of the print
        const fx = w / prev.w;
        const fy = h / prev.h;
        s.x *= fx;
        s.tx *= fx;
        s.y *= fy;
        s.ty *= fy;
      }
      window.clearTimeout(rebuild);
      if (!prev) build();
      else rebuild = window.setTimeout(build, 140);
      draw();
    };
    read();
    const resize = new ResizeObserver(read);
    resize.observe(node);

    // no frames for a stage nobody is looking at
    const seen = new IntersectionObserver(([entry]) => {
      s.seen = entry?.isIntersecting ?? false;
      if (!s.seen) return;
      arrive();
      start();
    });
    seen.observe(node);

    const lost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(s.raf);
      s.raf = 0;
      s.lens = null;
    };
    const restored = () => {
      init();
      if (s.lens && s.map) uploadMap(s.lens, s.map);
      draw();
    };
    c.addEventListener("webglcontextlost", lost);
    c.addEventListener("webglcontextrestored", restored);

    return () => {
      alive = false;
      window.clearTimeout(rebuild);
      resize.disconnect();
      seen.disconnect();
      c.removeEventListener("webglcontextlost", lost);
      c.removeEventListener("webglcontextrestored", restored);
      cancelAnimationFrame(s.raf);
      s.raf = 0;
    };
  }, [arrive, draw, start]);

  useEffect(() => {
    const s = live.current;
    s.reduce = reduce ?? false;
    if (s.reduce) {
      s.x = s.tx;
      s.y = s.ty;
      s.u = s.ut;
      s.swing = 0;
      draw();
    }
  }, [reduce, draw]);

  /*
   * A trackpad pinch arrives as a wheel event with ctrlKey held, and Safari's
   * as a gesture event. Either raises and lowers the glass. A plain wheel is
   * left to the page, so scrolling past the demo is never caught on it.
   */
  useEffect(() => {
    const node = stage.current;
    if (!node) return;
    const s = live.current;
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const mag = magnification(s.ut) * Math.exp(-e.deltaY * 0.01);
      setHeight(heightFor(mag));
    };
    const gestureStart = (e: Event) => {
      e.preventDefault();
      s.pinch = magnification(s.ut);
    };
    const gestureChange = (e: Event) => {
      e.preventDefault();
      const scale = (e as Event & { scale: number }).scale;
      setHeight(heightFor(s.pinch * scale));
    };
    node.addEventListener("wheel", wheel, { passive: false });
    node.addEventListener("gesturestart", gestureStart);
    node.addEventListener("gesturechange", gestureChange);
    return () => {
      node.removeEventListener("wheel", wheel);
      node.removeEventListener("gesturestart", gestureStart);
      node.removeEventListener("gesturechange", gestureChange);
    };
  }, [setHeight]);

  const carry = (on: boolean) => {
    if (stage.current) stage.current.dataset.carry = on ? "true" : "false";
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !e.isPrimary) return;
    const target = e.target as HTMLElement;
    // the controls in the corner are buttons of their own
    if (target.closest("[data-control]")) return;
    const s = live.current;
    const p = toStage(e.clientX, e.clientY);
    const touch = e.pointerType === "touch";
    const glass = target.closest("[data-glass]") !== null;

    if (glass) {
      s.grab = {
        id: e.pointerId,
        kind: "glass",
        dx: p.x - s.x,
        dy: p.y - s.y,
        startX: p.x,
        startY: p.y,
        moved: false,
      };
      s.held = true;
      s.tau = TAU.drag;
    } else if (touch) {
      // a finger on the bare map is either a tap or the page scrolling
      s.grab = {
        id: e.pointerId,
        kind: "tap",
        dx: 0,
        dy: 0,
        startX: p.x,
        startY: p.y,
        moved: false,
      };
      return;
    } else {
      // a press on the map brings the glass there, and it follows from there
      s.grab = {
        id: e.pointerId,
        kind: "map",
        dx: 0,
        dy: 0,
        startX: p.x,
        startY: p.y,
        moved: false,
      };
      s.held = true;
      s.tau = TAU.glide;
      s.tx = p.x;
      s.ty = p.y;
      carry(true);
    }
    e.preventDefault();
    stage.current?.setPointerCapture(e.pointerId);
    start();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = live.current;
    const p = toStage(e.clientX, e.clientY);
    const g = s.grab;
    if (!g || g.id !== e.pointerId) {
      if (e.pointerType === "mouse" || e.pointerType === "pen") {
        const over = onGlass(p.x, p.y) ? 1 : 0;
        if (over !== s.hoverTarget) {
          s.hoverTarget = over;
          start();
        }
      }
      return;
    }
    if (Math.hypot(p.x - g.startX, p.y - g.startY) > 3) {
      if (!g.moved && g.kind === "glass") carry(true);
      g.moved = true;
    }
    if (g.kind === "tap") return;
    // a glass that has caught up with the hand follows it closely
    if (g.kind === "map" && g.moved) s.tau = TAU.drag;
    s.tx = p.x - g.dx;
    s.ty = p.y - g.dy;
    start();
  };

  const release = (e: React.PointerEvent<HTMLDivElement>, cancel: boolean) => {
    const s = live.current;
    const g = s.grab;
    if (!g || g.id !== e.pointerId) return;
    s.grab = null;
    s.held = false;
    carry(false);
    if (g.kind === "tap" && !cancel) {
      const p = toStage(e.clientX, e.clientY);
      if (Math.hypot(p.x - g.startX, p.y - g.startY) < TAP_SLOP) {
        s.tau = TAU.glide;
        s.tx = p.x;
        s.ty = p.y;
      }
    }
    start();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const s = live.current;
    const l = s.layout;
    if (!l) return;
    const d = e.shiftKey ? NUDGE.big : NUDGE.step;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-d, 0],
      ArrowRight: [d, 0],
      ArrowUp: [0, -d],
      ArrowDown: [0, d],
    };
    const move = moves[e.key];
    if (move) {
      e.preventDefault();
      s.tau = TAU.glide;
      s.tx = Math.min(l.w, Math.max(0, s.tx + move[0]));
      s.ty = Math.min(l.h, Math.max(0, s.ty + move[1]));
      start();
      return;
    }
    if (e.key === "+" || e.key === "=" || e.key === "PageUp") {
      e.preventDefault();
      stepMag(1);
    } else if (e.key === "-" || e.key === "_" || e.key === "PageDown") {
      e.preventDefault();
      stepMag(-1);
    }
  };

  const atMin = mag <= magnification(HEIGHT.min) + 1e-3;
  const atMax = mag >= magnification(HEIGHT.max) - 1e-3;

  const control = cn(
    "inline-flex size-7 cursor-pointer items-center justify-center rounded-full text-text-secondary transition-colors duration-200",
    "hover:bg-fill hover:text-text-primary active:bg-fill-hover active:duration-0",
    "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent",
    FOCUS,
  );

  return (
    <TooltipProvider delayDuration={200}>
      <div
        ref={stage}
        role="presentation"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => release(e, false)}
        onPointerCancel={(e) => release(e, true)}
        onPointerLeave={() => {
          live.current.hoverTarget = 0;
          start();
        }}
        className={cn(
          "group relative isolate aspect-8/5 min-h-78 w-full touch-pan-y select-none overflow-hidden rounded-lg bg-fill",
          "cursor-zoom-in data-[carry=true]:cursor-grabbing data-[carry=true]:[&_*]:cursor-grabbing",
        )}
      >
        <canvas
          ref={canvas}
          role="img"
          aria-label="A printed map of an invented harbour town, Port Lumen, with a magnifying glass over it"
          className={cn(
            "absolute inset-0 block size-full opacity-0 transition-opacity duration-200 group-data-[ready=true]:opacity-100",
            failed && "hidden",
          )}
        />
        <canvas
          ref={flat}
          className={cn(
            "absolute inset-0 block size-full opacity-0 transition-opacity duration-200 group-data-[ready=true]:opacity-100",
            !failed && "hidden",
          )}
        />

        <button
          ref={glassHit}
          type="button"
          data-glass=""
          aria-label="Magnifying glass"
          aria-describedby="loupe-keys"
          onKeyDown={onKeyDown}
          className={cn(
            "absolute top-0 left-0 cursor-grab touch-none rounded-full",
            FOCUS,
            "focus-visible:ring-offset-0",
          )}
        />
        <div
          ref={handleHit}
          data-glass=""
          aria-hidden="true"
          className="absolute top-0 left-0 origin-[0_50%] cursor-grab touch-none rounded-full"
        />
        <p id="loupe-keys" className="sr-only">
          Drag it to read the map. The arrow keys move it, and plus and minus
          raise and lower it.
        </p>

        <div
          data-control=""
          className="absolute top-3 left-3 flex items-center gap-0.5 rounded-full bg-bg p-0.5 ring-1 ring-stroke"
        >
          <Tooltip label="Lower the glass">
            <button
              type="button"
              aria-label="Lower the glass"
              disabled={atMin}
              onClick={() => stepMag(-1)}
              className={control}
            >
              <MinusIcon aria-hidden="true" className="size-3" />
            </button>
          </Tooltip>
          <span
            aria-hidden="true"
            className="min-w-9 text-center text-meta text-text-primary tabular-nums"
          >
            <TextMorph duration={160} ease="cubic-bezier(0.32, 0.72, 0, 1)">
              {readout}
            </TextMorph>
          </span>
          <Tooltip label="Raise the glass">
            <button
              type="button"
              aria-label="Raise the glass"
              disabled={atMax}
              onClick={() => stepMag(1)}
              className={control}
            >
              <PlusIcon aria-hidden="true" className="size-3" />
            </button>
          </Tooltip>
        </div>
        <span aria-live="polite" className="sr-only">
          {`Magnifying ${readout.replace("×", " times")}`}
        </span>
      </div>
    </TooltipProvider>
  );
}

/**
 * The stage without WebGL 2: the print, and a plain enlarged circle of it under
 * a frame. No distortion, no fringe and no caustic, but the glass still reads
 * and still magnifies by the same height.
 */
function drawFlat(
  c: HTMLCanvasElement | null,
  s: Live,
  mag: number,
  dirX: number,
  dirY: number,
): void {
  const ctx = c?.getContext("2d");
  const l = s.layout;
  if (!c || !ctx || !l || !s.map) return;
  const d = l.dpr;
  const g = s.geo;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(s.map, 0, 0, c.width, c.height);
  const x = s.x * d;
  const y = s.y * d;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, g.r * d, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(x, y);
  ctx.scale(mag, mag);
  ctx.translate(-x, -y);
  ctx.drawImage(s.map, 0, 0, c.width, c.height);
  ctx.restore();
  ctx.lineCap = "round";
  ctx.strokeStyle = "#3a2a1c";
  ctx.lineWidth = g.grip * 2 * d;
  ctx.beginPath();
  ctx.moveTo(x + dirX * g.r * d, y + dirY * g.r * d);
  ctx.lineTo(
    x + dirX * (g.r + g.rim + g.handle) * d,
    y + dirY * (g.r + g.rim + g.handle) * d,
  );
  ctx.stroke();
  ctx.strokeStyle = "#1c1b1a";
  ctx.lineWidth = g.rim * d;
  ctx.beginPath();
  ctx.arc(x, y, (g.r + g.rim / 2) * d, 0, Math.PI * 2);
  ctx.stroke();
}
