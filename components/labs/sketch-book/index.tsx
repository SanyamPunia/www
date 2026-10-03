"use client";

import {
  animate,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
  type ValueAnimationTransition,
} from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { type Frame, type Ink, paint, REVEAL_END } from "./book";

/**
 * A book drawn in pen, seen from straight above, so all there is of it is its
 * cover. Hover it and the camera swings round and down to an isometric view,
 * and the rectangle turns out to be a cuboid. Press it and the front board
 * swings open on its hinge, and the first page writes itself.
 *
 * Four numbers carry it: `turn` from the top view to the isometric pose, `lid`
 * from shut to the board lying open on the table, `write` for how much of the
 * first page is down, and `ink` for the drawing's first inking. While a hand
 * is over the stage the camera also leans a little toward it.
 *
 * Nothing renders per frame. The canvas is redrawn when a motion value
 * changes, coalesced to one draw a frame, and nothing is requested at rest.
 */

/** the turn out to the cuboid, a little slower than the turn back */
const TURN_OUT = { type: "spring", visualDuration: 0.7, bounce: 0.15 } as const;
const TURN_BACK = { type: "spring", visualDuration: 0.55, bounce: 0 } as const;

/**
 * The board lifts, falls past upright, lands on the table and bounces once
 * off it. Keyframes rather than a spring, since a spring would overshoot into
 * the table rather than off it.
 */
const LID_OPEN: ValueAnimationTransition<number> = {
  duration: 0.9,
  times: [0, 0.74, 0.87, 1],
  ease: ["easeInOut", "easeOut", "easeIn"],
};
const LID_SHUT: ValueAnimationTransition<number> = {
  duration: 0.6,
  times: [0, 0.78, 0.9, 1],
  ease: ["easeInOut", "easeOut", "easeIn"],
};

/** the page is written at one speed, after the board has got out of the way */
const WRITE = { duration: 2.4, delay: 0.55 } as const;

/** how far a hand at the stage's edge leans the camera, in radians */
const LEAN = { yaw: 0.2, tilt: 0.12 } as const;
const SWAY = { stiffness: 170, damping: 24 } as const;

/** the hand redraws the lines this often while the book moves, about 12fps */
const BOIL_MS = 83;

const isHover = (type: string) => type === "mouse" || type === "pen";

type Phase = "top" | "turned" | "open";

const LABEL: Record<Phase, string> = {
  top: "Turn the book to see its sides",
  turned: "Open the cover",
  open: "Close the book",
};

export default function SketchBook() {
  const reduce = useReducedMotion();
  const still = useRef(false);

  const turn = useMotionValue(0);
  const lid = useMotionValue(0);
  const write = useMotionValue(0);
  const ink = useMotionValue(0);
  const yaw = useSpring(0, SWAY);
  const tilt = useSpring(0, SWAY);

  const [phase, setPhase] = useState<Phase>("top");
  const hover = useRef(false);
  /** turned for a hand with no hover, which is touch and the keyboard */
  const pinned = useRef(false);
  const opened = useRef(false);
  const lastPointer = useRef("");

  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const ctx = useRef<CanvasRenderingContext2D | null>(null);
  const size = useRef({ w: 0, h: 0 });
  const colours = useRef<Ink | null>(null);
  const frame = useRef(0);
  const boil = useRef(0);

  const inView = useInView(stage, { once: true, amount: 0.4 });

  useEffect(() => {
    still.current = reduce ?? false;
  }, [reduce]);

  const draw = useCallback(() => {
    frame.current = 0;
    const context = ctx.current;
    const tokens = colours.current;
    const { w, h } = size.current;
    if (!context || !tokens || w < 1) return;
    if ((turn.isAnimating() || lid.isAnimating()) && !still.current) {
      boil.current = Math.floor(performance.now() / BOIL_MS);
    }
    const f: Frame = {
      turn: turn.get(),
      lid: lid.get(),
      write: write.get(),
      ink: ink.get(),
      lean: { yaw: yaw.get(), tilt: tilt.get() },
      boil: boil.current,
    };
    paint(context, w, h, f, tokens);
  }, [turn, lid, write, ink, yaw, tilt]);

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
    colours.current = {
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

    const off = [turn, lid, write, ink, yaw, tilt].map((v) =>
      v.on("change", request),
    );

    return () => {
      observer.disconnect();
      for (const stop of off) stop();
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, [request, turn, lid, write, ink, yaw, tilt]);

  /*
   * The drawing inks itself in the first time it is seen, in the order a
   * sketch is built up. Under reduced motion it is simply there.
   */
  useEffect(() => {
    if (!inView || reduce === null) return;
    if (reduce) {
      ink.set(REVEAL_END);
      return;
    }
    const run = animate(ink, REVEAL_END, {
      duration: REVEAL_END,
      ease: "linear",
    });
    return () => run.stop();
  }, [inView, reduce, ink]);

  /* the one place the book moves, whatever asked for it */
  const sync = () => {
    const turned = hover.current || pinned.current;
    const open = turned && opened.current;
    opened.current = open;
    setPhase(open ? "open" : turned ? "turned" : "top");

    if (still.current) {
      for (const v of [turn, lid, write]) v.stop();
      turn.set(turned ? 1 : 0);
      lid.set(open ? 1 : 0);
      write.set(open ? 1 : 0);
      return;
    }

    const aim = turned ? 1 : 0;
    if (turn.get() !== aim || turn.isAnimating()) {
      animate(turn, aim, turned ? TURN_OUT : TURN_BACK);
    }

    const target = open ? 1 : 0;
    if (lid.get() !== target || lid.isAnimating()) {
      animate(lid, [lid.get(), target, open ? 0.965 : 0.03, target], {
        ...(open ? LID_OPEN : LID_SHUT),
        onComplete: () => {
          /* a shut book is written again the next time it is opened */
          if (!opened.current) write.set(0);
        },
      });
    }

    if (open) {
      animate(write, 1, {
        ...WRITE,
        ease: "linear",
        duration: WRITE.duration * (1 - write.get()),
      });
    } else {
      write.stop();
    }
  };

  /** touch and the keyboard step through the three states in order */
  const step = () => {
    if (!pinned.current && !hover.current) pinned.current = true;
    else if (!opened.current) opened.current = true;
    else {
      opened.current = false;
      pinned.current = false;
    }
    sync();
  };

  const lean = (e: React.PointerEvent) => {
    const el = stage.current;
    if (!el || still.current) return;
    const r = el.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
    yaw.set(Math.max(-1, Math.min(1, nx)) * LEAN.yaw);
    tilt.set(Math.max(-1, Math.min(1, ny)) * LEAN.tilt);
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
        data-phase={phase}
        aria-label={LABEL[phase]}
        className="absolute inset-0 cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-inset"
        onPointerDown={(e) => {
          lastPointer.current = e.pointerType;
        }}
        onPointerEnter={(e) => {
          if (!isHover(e.pointerType)) return;
          hover.current = true;
          lean(e);
          sync();
        }}
        onPointerMove={(e) => {
          if (isHover(e.pointerType)) lean(e);
        }}
        onPointerLeave={(e) => {
          /* a touch leave is a lift, not a departure */
          if (!isHover(e.pointerType)) return;
          hover.current = false;
          pinned.current = false;
          opened.current = false;
          yaw.set(0);
          tilt.set(0);
          sync();
        }}
        onPointerUp={(e) => {
          if (!isHover(e.pointerType)) step();
        }}
        onClick={(e) => {
          /* a keyboard press has no pointer behind it */
          if (e.detail === 0) {
            step();
            return;
          }
          /* a tap was already heard on its release */
          if (!isHover(lastPointer.current)) return;
          opened.current = !opened.current;
          sync();
        }}
        onKeyDown={(e) => {
          if (e.key !== "Escape") return;
          pinned.current = false;
          opened.current = false;
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
