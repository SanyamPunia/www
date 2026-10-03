"use client";

import {
  animate,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { type Ink, ISO, paint } from "./book";

/**
 * A book drawn in pen, seen from straight above, so all there is of it is its
 * cover. Hover it and the camera swings round and down to an isometric view,
 * and the rectangle turns out to be a cuboid with a spine and a page block.
 *
 * One number carries the turn, `t`, from the top view at 0 to the isometric
 * pose at 1. While a hand is over the stage the camera also leans a little
 * toward it, scaled by `t`, so the top view never rotates in place.
 *
 * Nothing renders per frame. The canvas is redrawn when a motion value
 * changes, coalesced to one draw a frame, and nothing is requested at rest.
 */

/** the turn out to the cuboid, a little slower than the turn back */
const OPEN = { type: "spring", visualDuration: 0.7, bounce: 0.15 } as const;
const CLOSE = { type: "spring", visualDuration: 0.55, bounce: 0 } as const;

/** how far a hand at the stage's edge leans the camera, in radians */
const LEAN = { yaw: 0.2, tilt: 0.12 } as const;
const SWAY = { stiffness: 170, damping: 24 } as const;

/** the hand redraws the lines this often while the camera turns, about 12fps */
const BOIL_MS = 83;

const isHover = (e: React.PointerEvent) =>
  e.pointerType === "mouse" || e.pointerType === "pen";

export default function SketchBook() {
  const reduce = useReducedMotion();
  const still = useRef(false);

  const t = useMotionValue(0);
  const yaw = useSpring(0, SWAY);
  const tilt = useSpring(0, SWAY);

  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
  const hover = useRef(false);
  const pinned = useRef(false);

  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const ctx = useRef<CanvasRenderingContext2D | null>(null);
  const size = useRef({ w: 0, h: 0 });
  const ink = useRef<Ink | null>(null);
  const frame = useRef(0);
  const boil = useRef(0);

  useEffect(() => {
    still.current = reduce ?? false;
  }, [reduce]);

  const draw = useCallback(() => {
    frame.current = 0;
    const context = ctx.current;
    const colours = ink.current;
    const { w, h } = size.current;
    if (!context || !colours || w < 1) return;
    if (t.isAnimating() && !still.current) {
      boil.current = Math.floor(performance.now() / BOIL_MS);
    }
    const k = Math.min(Math.max(t.get(), 0), 1.1);
    paint(
      context,
      w,
      h,
      {
        yaw: ISO.yaw * t.get() + yaw.get() * k,
        tilt: Math.max(0, ISO.tilt * t.get() + tilt.get() * k),
      },
      colours,
      boil.current,
    );
  }, [t, yaw, tilt]);

  const request = useCallback(() => {
    if (!frame.current) frame.current = requestAnimationFrame(draw);
  }, [draw]);

  /* size the canvas to the stage, and read the tokens it draws in */
  useEffect(() => {
    const el = stage.current;
    const c = canvas.current;
    if (!el || !c) return;
    const context = c.getContext("2d");
    if (!context) return;
    ctx.current = context;

    const root = getComputedStyle(document.documentElement);
    const token = (name: string) =>
      root.getPropertyValue(`--color-${name}`).trim();
    ink.current = {
      line: token("text-primary"),
      soft: token("text-secondary"),
      faint: token("text-muted"),
      grid: token("stroke-strong"),
      paper: token("bg"),
    };

    const observer = new ResizeObserver(() => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w < 1 || h < 1) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      size.current = { w, h };
      request();
    });
    observer.observe(el);

    const off = [
      t.on("change", request),
      yaw.on("change", request),
      tilt.on("change", request),
    ];

    return () => {
      observer.disconnect();
      for (const stop of off) stop();
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, [request, t, yaw, tilt]);

  /* the one place the book turns, whatever asked for it */
  const sync = () => {
    const next = hover.current || pinned.current;
    if (next === openRef.current) return;
    openRef.current = next;
    setOpen(next);
    if (still.current) {
      t.stop();
      t.set(next ? 1 : 0);
      return;
    }
    animate(t, next ? 1 : 0, next ? OPEN : CLOSE);
  };

  const aim = (e: React.PointerEvent) => {
    const el = stage.current;
    if (!el || still.current) return;
    const r = el.getBoundingClientRect();
    const nx = Math.max(
      -1,
      Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1),
    );
    const ny = Math.max(
      -1,
      Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1),
    );
    yaw.set(nx * LEAN.yaw);
    tilt.set(ny * LEAN.tilt);
  };

  return (
    <div
      ref={stage}
      className="relative isolate aspect-8/5 min-h-78 w-full select-none overflow-hidden rounded-lg bg-surface"
    >
      <canvas
        ref={canvas}
        className="pointer-events-none absolute inset-0 block size-full"
      />
      {/*
       * The whole stage is the hover target rather than the book's outline,
       * which grows and moves as the camera turns and would take itself out
       * from under a pointer sitting near its edge.
       */}
      <button
        type="button"
        aria-pressed={open}
        aria-label={
          open ? "Show the cover only" : "Turn the book to see its sides"
        }
        className="absolute inset-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-inset"
        onPointerEnter={(e) => {
          if (!isHover(e)) return;
          hover.current = true;
          aim(e);
          sync();
        }}
        onPointerMove={(e) => {
          if (isHover(e)) aim(e);
        }}
        onPointerLeave={(e) => {
          /* a touch leave is a lift, not a departure */
          if (!isHover(e)) return;
          hover.current = false;
          yaw.set(0);
          tilt.set(0);
          sync();
        }}
        onPointerUp={(e) => {
          if (isHover(e)) return;
          pinned.current = !pinned.current;
          sync();
        }}
        onClick={(e) => {
          /* a keyboard press has no pointer behind it */
          if (e.detail !== 0) return;
          pinned.current = !pinned.current;
          sync();
        }}
        onKeyDown={(e) => {
          if (e.key !== "Escape" || !pinned.current) return;
          pinned.current = false;
          sync();
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-lg ring-1 ring-stroke ring-inset"
      />
    </div>
  );
}
