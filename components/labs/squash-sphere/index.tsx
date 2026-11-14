"use client";

import { useReducedMotion } from "motion/react";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
} from "react";
import { approach } from "@/lib/lerp";
import {
  BUILD,
  DOTS,
  dots,
  FRICTION,
  RADIUS_SHARE,
  SPIN,
  SQUASH,
  squashGoal,
  TICK,
  TILT,
} from "./sphere";

/** Cuelume, loaded on the first touch so it never weighs on the page's first load */
type Cuelume = typeof import("cuelume");
let cuelume: Promise<Cuelume> | null = null;
const loadCuelume = () => (cuelume ??= import("cuelume"));

/*
 * A ball of dots that spins about its upright axis. Drag it, or scroll
 * sideways, and it turns under the hand. Let go and it coasts back to its own
 * slow turn. Spun fast, it squashes: the poles come in, the equator goes out,
 * and it softens, then springs back round with a little give as it slows.
 *
 * Turned by hand it ticks as it goes, with the landing page's own sound:
 * Cuelume's mechanical `select` detent, once every 15 degrees.
 *
 * **Nothing renders.** The turn, the throw and the squash are refs, and one
 * frame loop paints the canvas from them. It runs only while the stage is on
 * screen, and under reduced motion only while something is moving.
 */

/** Alpha bands per pass, so a frame is a handful of fills however many dots there are */
const BANDS = 10;
/** A hand still for longer than this before letting go throws nothing (ms) */
const STILL = 60;
/** What an arrow key adds to the spin (radians a second), and the most a key can reach */
const KICK = 5;
const KICK_MAX = 36;
/** Under reduced motion an arrow steps the turn by this much instead (radians) */
const STEP = 0.4;
/** The longest gap between two wheel events still read as one swipe (ms) */
const SWIPE_GAP = 50;

const DOT_LIST = dots(DOTS);

interface Ink {
  dot: string;
  seam: string;
  edge: string;
  shadow: string;
}

export default function SquashSphere() {
  const reduced = useReducedMotion() ?? false;
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;

  const size = useRef({ w: 0, h: 0, dpr: 1 });
  const ink = useRef<Ink | null>(null);
  // the turn and its speed, in radians and radians a second
  const turn = useRef({ yaw: 0, v: SPIN });
  // the squash: the yaw last frame, the speed read from it, and the spring
  const squash = useRef({ lastYaw: 0, speed: 0, at: 0, vel: 0 });
  const drag = useRef<{
    id: number;
    x: number;
    t: number;
    moved: number;
  } | null>(null);
  const lastWheel = useRef(0);
  const visible = useRef(false);
  const frame = useRef(0);
  const last = useRef(0);

  // the detent at the front, and when the last tick sounded
  const tick = useRef({ step: 0, at: 0, sound: null as Cuelume | null });
  const stepOf = (yaw: number) =>
    Math.round((yaw * TICK.perTurn) / (Math.PI * 2));
  const arm = () => {
    if (!tick.current.sound)
      void loadCuelume().then((m) => {
        tick.current.sound = m;
      });
  };
  /** Ticks if the ball has turned a detent past the front since the last tick */
  const tickIfPassed = (now: number) => {
    const k = tick.current;
    const next = stepOf(turn.current.yaw);
    if (next === k.step) return;
    const direction = next > k.step ? "forward" : "back";
    k.step = next;
    if (!k.sound || now - k.at < TICK.ms) return;
    k.at = now;
    k.sound.play("select", {
      theme: "mech",
      emphasis: "subtle",
      volume: TICK.volume,
      direction,
    });
  };
  /** Moves the detent along without a sound, for the ball's own slow turn */
  const quietStep = () => {
    tick.current.step = stepOf(turn.current.yaw);
  };

  const radius = () => Math.min(size.current.w, size.current.h) * RADIUS_SHARE;

  /* ---------------------------------------------------------------- paint */

  const paint = () => {
    const c = canvas.current;
    const colors = ink.current;
    if (!c || !colors) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const { w, h, dpr } = size.current;
    const r = radius();
    if (r <= 0) return;
    const at = squash.current.at;
    const sx = 1 + SQUASH.widen * at;
    const sy = 1 - SQUASH.press * at;
    const cx = w / 2;
    // a touch above the middle, so the shadow under it has room
    const cy = h * 0.47;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // the shadow on the floor widens as the ball flattens
    ctx.save();
    ctx.translate(cx, cy + r * 1.32);
    ctx.scale(r * 0.95 * sx, r * 0.12 * (0.9 + 0.1 * sx));
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    glow.addColorStop(0, colors.shadow);
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // the silhouette, so the squash reads even where the dots are sparse
    ctx.strokeStyle = colors.edge;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * sx, r * sy, 0, 0, Math.PI * 2);
    ctx.stroke();

    const { yaw } = turn.current;
    const cosT = Math.cos(TILT);
    const sinT = Math.sin(TILT);
    const back: Path2D[] = [];
    const front: Path2D[] = [];
    const seamBack = new Path2D();
    const seamFront = new Path2D();
    for (let b = 0; b < BANDS; b++) {
      back.push(new Path2D());
      front.push(new Path2D());
    }

    for (const d of DOT_LIST) {
      const cl = Math.cos(d.lat);
      const x = cl * Math.sin(d.lon + yaw);
      const y = Math.sin(d.lat);
      const z = cl * Math.cos(d.lon + yaw);
      // seen from a little above: the top leans toward the eye
      const yv = y * cosT - z * sinT;
      const zv = y * sinT + z * cosT;
      const px = cx + x * r * sx;
      const py = cy - yv * r * sy;
      const depth = (zv + 1) / 2;
      // the strip barely shrinks with depth, so it still reads round the back
      const s = d.seam ? 2 + 0.9 * depth : 0.9 + 1.5 * depth;
      const band = Math.min(BANDS - 1, Math.floor(depth * BANDS));
      const path = d.seam
        ? zv < 0
          ? seamBack
          : seamFront
        : zv < 0
          ? back[band]
          : front[band];
      path.moveTo(px + s, py);
      path.arc(px, py, s, 0, Math.PI * 2);
    }

    const alphaOf = (band: number) =>
      0.12 + 0.88 * ((band + 0.5) / BANDS) ** 1.6;

    ctx.fillStyle = colors.dot;
    for (let b = 0; b < BANDS; b++) {
      ctx.globalAlpha = alphaOf(b);
      ctx.fill(back[b]);
    }
    ctx.fillStyle = colors.dot;
    for (let b = 0; b < BANDS; b++) {
      ctx.globalAlpha = alphaOf(b);
      ctx.fill(front[b]);
    }
    // the strip stays in view round the back, only a little faded: it is drawn
    // over the front dots, or they cover it where it passes behind them
    ctx.fillStyle = colors.seam;
    ctx.globalAlpha = 0.55;
    ctx.fill(seamBack);
    ctx.globalAlpha = 1;
    ctx.fill(seamFront);
    ctx.globalAlpha = 1;

    const blur = Math.round(Math.max(0, at) * SQUASH.blur * 4) / 4;
    const filter = blur > 0 ? `blur(${blur}px)` : "";
    if (c.style.filter !== filter) c.style.filter = filter;
  };

  /* ----------------------------------------------------------------- loop */

  const step = (now: number) => {
    frame.current = 0;
    const dt = Math.min(50, last.current ? now - last.current : 16.7) / 1000;
    last.current = now;
    const t = turn.current;
    const q = squash.current;
    const calm = reducedRef.current;

    if (!drag.current) {
      if (calm) t.v = 0;
      else {
        t.v = SPIN + (t.v - SPIN) * FRICTION ** (dt / 0.0167);
        t.yaw += t.v * dt;
        // a throw still carrying the ball is the reader's turn, its own slow turn is silent
        if (Math.abs(t.v) > SPIN * TICK.thrown) tickIfPassed(now);
        else quietStep();
      }
    }

    // the squash, from how fast the ball actually turned this frame, whatever turned it
    if (calm || dt <= 0) {
      q.at = q.vel = q.speed = 0;
    } else {
      const speed = Math.abs(t.yaw - q.lastYaw) / dt;
      const tau = speed > q.speed ? BUILD.rise : BUILD.fall;
      q.speed += (speed - q.speed) * approach(tau, dt);
      const goal = squashGoal(q.speed);
      q.vel += (SQUASH.stiffness * (goal - q.at) - SQUASH.damping * q.vel) * dt;
      q.at += q.vel * dt;
      if (goal === 0 && Math.abs(q.at) < 0.002 && Math.abs(q.vel) < 0.002)
        q.at = q.vel = 0;
    }
    q.lastYaw = t.yaw;

    paint();

    const moving =
      !calm || drag.current !== null || q.at !== 0 || Math.abs(t.v) > 0.001;
    if (visible.current && moving) run();
    else last.current = 0;
  };

  const stepRef = useRef(step);
  stepRef.current = step;

  const run = () => {
    if (frame.current) return;
    frame.current = requestAnimationFrame((now) => stepRef.current(now));
  };

  /* ----------------------------------------------------- size, ink, view */

  // biome-ignore lint/correctness/useExhaustiveDependencies: paint and run read refs, set up once
  useEffect(() => {
    const el = stage.current;
    const c = canvas.current;
    if (!el || !c) return;
    const css = getComputedStyle(document.documentElement);
    const token = (name: string) => css.getPropertyValue(name).trim();
    ink.current = {
      dot: token("--color-text-secondary"),
      seam: token("--color-text-primary"),
      edge: token("--color-stroke-strong"),
      shadow: `color-mix(in srgb, ${token("--color-text-primary")} 16%, transparent)`,
    };

    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      size.current = { w: width, h: height, dpr };
      c.width = Math.round(width * dpr);
      c.height = Math.round(height * dpr);
      paint();
    };
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(el);

    const view = new IntersectionObserver(([entry]) => {
      visible.current = entry.isIntersecting;
      if (entry.isIntersecting) run();
    });
    view.observe(el);

    return () => {
      resize.disconnect();
      view.disconnect();
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, []);

  /* ------------------------------------------------------------- gestures */

  const endDrag = useRef<(released: boolean) => void>(() => {});
  endDrag.current = (released) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    const el = stage.current;
    if (el) {
      el.dataset.carry = "false";
      if (el.hasPointerCapture(d.id)) el.releasePointerCapture(d.id);
    }
    // a hand that stopped before letting go, or a cut-off drag, throws nothing
    if (!released || performance.now() - d.t > STILL || reducedRef.current)
      turn.current.v = 0;
    run();
  };

  useEffect(() => {
    const release = (e: PointerEvent) => {
      if (drag.current?.id === e.pointerId)
        endDrag.current(e.type === "pointerup");
    };
    const cut = () => endDrag.current(false);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    window.addEventListener("blur", cut);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      window.removeEventListener("blur", cut);
    };
  }, []);

  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current || (e.pointerType === "mouse" && e.button !== 0)) return;
    drag.current = { id: e.pointerId, x: e.clientX, t: e.timeStamp, moved: 0 };
    turn.current.v = 0;
    quietStep();
    arm();
    run();
  };

  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    if (e.pointerType === "mouse" && e.buttons === 0)
      return endDrag.current(false);
    const r = radius();
    if (r <= 0) return;
    const dx = e.clientX - d.x;
    const dt = Math.max(8, e.timeStamp - d.t);
    d.x = e.clientX;
    d.t = e.timeStamp;
    d.moved += Math.abs(dx);
    const el = stage.current;
    if (el && d.moved > 3 && !el.hasPointerCapture(e.pointerId)) {
      el.setPointerCapture(e.pointerId);
      el.dataset.carry = "true";
    }
    // the ball's front follows the pointer pixel for pixel
    turn.current.yaw += dx / r;
    turn.current.v = (dx / r) * (1000 / dt);
    tickIfPassed(e.timeStamp);
    run();
  };

  // a sideways scroll turns the ball, held from the browser so it is not also a
  // swipe back through history. An upright scroll is the page's.
  // biome-ignore lint/correctness/useExhaustiveDependencies: radius and run read refs, set up once
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      if (drag.current || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      const r = radius();
      if (r <= 0) return;
      e.preventDefault();
      const px = e.deltaMode === 1 ? e.deltaX * 16 : e.deltaX;
      const gap = Math.min(
        SWIPE_GAP,
        Math.max(8, e.timeStamp - lastWheel.current),
      );
      lastWheel.current = e.timeStamp;
      turn.current.yaw -= px / r;
      turn.current.v = reducedRef.current ? 0 : (-px / r) * (1000 / gap);
      arm();
      tickIfPassed(e.timeStamp);
      run();
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, []);

  const spinBy = (way: number, hard: boolean) => {
    const t = turn.current;
    arm();
    if (reducedRef.current) {
      t.yaw += way * STEP * (hard ? 3 : 1);
      tickIfPassed(performance.now());
    } else {
      const next = t.v + way * KICK * (hard ? 2.5 : 1);
      t.v = Math.max(-KICK_MAX, Math.min(KICK_MAX, next));
    }
    run();
  };

  const key = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowRight") spinBy(1, e.shiftKey);
    else if (e.key === "ArrowLeft") spinBy(-1, e.shiftKey);
    else return;
    e.preventDefault();
  };

  // a click with no pointer behind it is the keyboard's Enter or Space, or an
  // assistive technology, and spins it the way the arrows do
  const click = (e: ReactMouseEvent<HTMLButtonElement>) => {
    if (e.detail === 0) spinBy(1, true);
  };

  /* --------------------------------------------------------------- render */

  return (
    <div
      ref={stage}
      onPointerDown={down}
      onPointerMove={move}
      data-carry="false"
      className="relative aspect-8/5 min-h-78 w-full min-w-0 cursor-grab touch-pan-y select-none overflow-hidden rounded-lg bg-fill data-[carry=true]:cursor-grabbing"
    >
      <canvas
        ref={canvas}
        className="pointer-events-none absolute inset-0 size-full"
      />
      <button
        type="button"
        onKeyDown={key}
        onClick={click}
        aria-label="Spin the sphere"
        aria-describedby="squash-sphere-how"
        className="pointer-events-none absolute inset-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15"
      />
      <span id="squash-sphere-how" className="sr-only">
        Use the left and right arrow keys to spin it. Hold Shift to spin it
        harder. Spun fast, it flattens.
      </span>
      <div className="pointer-events-none absolute inset-0 rounded-lg ring-1 ring-stroke ring-inset" />
    </div>
  );
}
