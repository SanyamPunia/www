"use client";

import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  type MouseEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  clear,
  flood,
  measure,
  paint,
  portionAt,
  type Ridge,
  SCAN_FROM,
  SCAN_TO,
  SEEDS,
} from "./ink";
import { VIEW } from "./ridges";

/*
 * A blank fingerprint, drawn as the faint impression of its ridges. Press the
 * print and ink spreads out from that point through the patch of ridges
 * around it, or drag across it and every patch you cross floods from where you
 * crossed it. Once all seven are full, a light reads the print top to bottom
 * and leaves it green behind it, and the print says it is verified.
 */

type Phase = "ink" | "scan" | "done";

const COUNT = SEEDS.length;
/**
 * The light starts this long after the press that fills the last patch, while
 * that patch is still flooding. Waiting for the last disc and then a beat left
 * most of a second of a finished print doing nothing. The light runs from the
 * top and leaves everything above it green whether or not the ink got there
 * first, so a flood it overtakes is simply read as it arrives.
 */
const LEAD = 0.15;
/** seconds for the light to cross the print */
const SCAN = 0.7;
/** seconds for a reset to take the ink away */
const FADE = 0.24;
/**
 * The ending is two beats. The ring goes out from the print and fades, and
 * only then does the badge rise under it, since the ring passes straight
 * through the badge's row on its way out and the two drew over each other.
 */
const RING = 0.6;
const BADGE_AT = 0.3;
/**
 * Seconds for a portion's hover light to close most of the way to its target,
 * shorter in than out: the patch under the pointer answers at once and the one
 * it left eases away behind it, so crossing a boundary is a crossfade.
 */
const LIGHT_IN = 0.1;
const LIGHT_OUT = 0.18;
/** print units between the points a drag is tested at, so a flick skips nothing */
const WALK = 1.5;

/** seconds, which is the unit every duration in `ink.ts` is written in */
const now = () => performance.now() / 1000;

const ease = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

export default function FingerprintInk() {
  const reduce = useReducedMotion();
  const statusId = useId();
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  const [count, setCount] = useState(0);
  const [phase, setPhase] = useState<Phase>("ink");

  // Everything the frame loop reads lives here, so a flood renders nothing.
  const live = useRef({
    ridges: [] as Ridge[],
    all: null as Path2D | null,
    inked: SEEDS.map(() => false),
    ends: SEEDS.map(() => 0),
    lastPress: 0,
    phase: "ink" as Phase,
    scanAt: 0,
    fadeAt: 0,
    fading: false,
    hovered: -1,
    light: new Float32Array(SEEDS.length),
    lastT: 0,
    pressing: false,
    last: { x: 0, y: 0 },
    scale: 1,
    colors: { ghost: "", lit: "", ink: "", done: "" },
    still: false,
    raf: 0,
  });
  live.current.still = reduce === true;

  const frame = useCallback(() => {
    const s = live.current;
    s.raf = 0;
    const ctx = canvas.current?.getContext("2d");
    if (!ctx || !s.all) return;
    const t = now();
    let busy = false;

    let alpha = 1;
    if (s.fading) {
      const p = s.still ? 1 : (t - s.fadeAt) / FADE;
      alpha = Math.max(0, 1 - p);
      if (p >= 1) {
        s.fading = false;
        clear(s.ridges);
        s.inked = SEEDS.map(() => false);
        s.phase = "ink";
        setPhase("ink");
        setCount(0);
        alpha = 1;
      } else busy = true;
    }

    // the last portion lands, the print holds a beat, and the light reads it
    const full = s.inked.every(Boolean);
    if (s.phase === "ink" && full && !s.fading) {
      if (s.still) {
        s.phase = "done";
        setPhase("done");
      } else if (t >= s.lastPress + LEAD) {
        s.phase = "scan";
        s.scanAt = t;
        setPhase("scan");
      }
      busy = true;
    }

    let seal = 0;
    let band: number | null = null;
    if (s.phase === "scan") {
      const p = Math.min(1, (t - s.scanAt) / SCAN);
      band = SCAN_FROM + (SCAN_TO - SCAN_FROM) * ease(p);
      seal = band;
      if (p >= 1) {
        s.phase = "done";
        setPhase("done");
        band = null;
      } else busy = true;
    }
    if (s.phase === "done") seal = VIEW.h;

    for (const end of s.ends) if (t < end) busy = true;

    // each portion's light eases toward whether the pointer is on it
    const dt = Math.min(0.05, t - s.lastT);
    s.lastT = t;
    const target = s.phase === "ink" && !s.fading ? s.hovered : -1;
    for (let p = 0; p < s.light.length; p++) {
      const to = p === target ? 1 : 0;
      const from = s.light[p];
      if (from === to) continue;
      if (s.still) {
        s.light[p] = to;
        continue;
      }
      const tau = to > from ? LIGHT_IN : LIGHT_OUT;
      const next = to + (from - to) * Math.exp(-dt / tau);
      s.light[p] = Math.abs(next - to) < 0.004 ? to : next;
      busy = true;
    }

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    ctx.setTransform(s.scale * dpr, 0, 0, s.scale * dpr, 0, 0);
    paint(ctx, s.ridges, s.all, {
      now: t,
      ...s.colors,
      hover: s.light,
      alpha,
      seal,
      band,
    });

    if (busy) s.raf = requestAnimationFrame(frame);
  }, []);

  const kick = useCallback(() => {
    const s = live.current;
    if (s.raf) return;
    // a loop starting from rest measures its first step from now, or the
    // light would jump by however long the print sat still
    s.lastT = now();
    s.raf = requestAnimationFrame(frame);
  }, [frame]);

  // measure the ridges once, read the tokens, and size the canvas to the box
  useEffect(() => {
    const s = live.current;
    const node = box.current;
    const c = canvas.current;
    if (!node || !c) return;

    s.ridges = measure();
    const all = new Path2D();
    for (const r of s.ridges) all.addPath(r.path);
    s.all = all;

    // a canvas fill cannot take a `var()`, so the tokens are read once here
    const root = getComputedStyle(document.documentElement);
    const token = (name: string) =>
      root.getPropertyValue(`--color-${name}`).trim();
    s.colors = {
      ghost: token("text-muted"),
      lit: token("text-muted"),
      ink: token("text-primary"),
      done: token("success"),
    };

    const read = () => {
      const w = node.clientWidth;
      if (w === 0) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      s.scale = w / VIEW.w;
      c.width = Math.round(w * dpr);
      c.height = Math.round(((w * VIEW.h) / VIEW.w) * dpr);
      kick();
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(s.raf);
      s.raf = 0;
    };
  }, [kick]);

  const ink = useCallback(
    (portion: number, x: number, y: number) => {
      const s = live.current;
      if (s.inked[portion] || s.phase !== "ink" || s.fading) return;
      s.inked[portion] = true;
      s.lastPress = now();
      s.ends[portion] = flood(s.ridges, portion, x, y, now(), s.still);
      setCount(s.inked.filter(Boolean).length);
      kick();
    },
    [kick],
  );

  const tryAt = useCallback(
    (x: number, y: number) => {
      const portion = portionAt(x, y);
      if (portion >= 0) ink(portion, x, y);
    },
    [ink],
  );

  // The gesture is bound to the node: the box is a surface the pointer drags
  // across rather than a control, and the button over it is the keyboard's.
  useEffect(() => {
    const node = box.current;
    if (!node) return;
    const s = live.current;
    // client coordinates to print units, off the box's own rect
    const toPrint = (e: PointerEvent) => {
      const rect = node.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) / rect.width) * VIEW.w,
        y: ((e.clientY - rect.top) / rect.height) * VIEW.h,
      };
    };

    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      node.setPointerCapture(e.pointerId);
      s.pressing = true;
      const p = toPrint(e);
      s.last = p;
      s.hovered = -1;
      tryAt(p.x, p.y);
      kick();
    };
    const move = (e: PointerEvent) => {
      const p = toPrint(e);
      if (s.pressing) {
        // walk the segment since the last event, so a fast drag cannot jump
        // over a portion between two events
        const dx = p.x - s.last.x;
        const dy = p.y - s.last.y;
        const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / WALK));
        for (let i = 1; i <= steps; i++) {
          tryAt(s.last.x + (dx * i) / steps, s.last.y + (dy * i) / steps);
        }
        s.last = p;
        return;
      }
      if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      const hit = portionAt(p.x, p.y);
      const next = hit >= 0 && !s.inked[hit] ? hit : -1;
      if (next !== s.hovered) {
        s.hovered = next;
        kick();
      }
    };
    const up = () => {
      s.pressing = false;
    };
    const leave = () => {
      if (s.hovered === -1) return;
      s.hovered = -1;
      kick();
    };

    node.addEventListener("pointerdown", down);
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerup", up);
    node.addEventListener("pointercancel", up);
    node.addEventListener("lostpointercapture", up);
    node.addEventListener("pointerleave", leave);
    return () => {
      node.removeEventListener("pointerdown", down);
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", up);
      node.removeEventListener("pointercancel", up);
      node.removeEventListener("lostpointercapture", up);
      node.removeEventListener("pointerleave", leave);
    };
  }, [kick, tryAt]);

  // A keyboard press inks the next portion, core first, from its seed. `detail` of 0
  // is what says no pointer was involved, since the pointer has already been
  // answered by the gesture above.
  const keyInk = (e: MouseEvent) => {
    if (e.detail !== 0) return;
    const s = live.current;
    const next = s.inked.indexOf(false);
    if (next >= 0) ink(next, SEEDS[next].x, SEEDS[next].y);
  };

  const reset = () => {
    const s = live.current;
    if (s.fading) return;
    s.fading = true;
    s.fadeAt = now();
    if (s.phase === "scan") {
      s.phase = "done";
    }
    kick();
  };

  const done = phase === "done";

  return (
    <div className="@container relative flex aspect-8/5 min-h-78 w-full select-none flex-col items-center justify-center gap-5 overflow-hidden rounded-lg bg-fill ring-1 ring-stroke ring-inset">
      <div
        ref={box}
        style={{
          ["--print" as string]: "clamp(9.5rem, 35cqw, 12rem)",
          aspectRatio: `${VIEW.w} / ${VIEW.h}`,
        }}
        className="relative w-(--print) shrink-0 cursor-pointer touch-none"
      >
        {/* One ring goes out from the print as it verifies, in the success
            tone, and is gone. It is the moment the whole gesture was for, and
            the print alone turning green is quiet for it. */}
        <AnimatePresence>
          {done && !reduce ? (
            <motion.span
              key="pulse"
              aria-hidden="true"
              initial={{ opacity: 0.5, scale: 1 }}
              animate={{ opacity: 0, scale: 1.35 }}
              exit={{ opacity: 0 }}
              transition={{ duration: RING, ease: [0.23, 1, 0.32, 1] }}
              className="pointer-events-none absolute -inset-1 rounded-full border-2 border-success"
            />
          ) : null}
        </AnimatePresence>
        <canvas
          ref={canvas}
          className="pointer-events-none absolute inset-0 size-full"
        />
        <button
          type="button"
          onClick={keyInk}
          aria-label={
            done ? "Print verified" : "Ink the next part of the print"
          }
          aria-disabled={done || undefined}
          aria-describedby={statusId}
          className="absolute -inset-2 cursor-pointer rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2 focus-visible:ring-offset-fill"
        />
      </div>

      <div id={statusId} className="grid h-8 place-items-center">
        <AnimatePresence mode="wait" initial={false}>
          {phase === "done" ? (
            <motion.span
              key="done"
              initial={{ opacity: 0, y: 4 }}
              animate={{
                opacity: 1,
                y: 0,
                transition: {
                  duration: 0.2,
                  delay: reduce ? 0 : BADGE_AT,
                  ease: [0.23, 1, 0.32, 1],
                },
              }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
              className="relative isolate inline-flex h-8 items-center gap-1.5 rounded-full bg-bg px-3.5 font-medium text-action text-success"
            >
              {/* the wash sits over white rather than over the grey stage, so
                  the text keeps the 4.59:1 the token table measures for it */}
              <span
                aria-hidden="true"
                className="absolute inset-0 -z-10 rounded-full bg-success/10"
              />
              {/* drawn on rather than swapped in, since the check arriving is
                  the answer to the whole gesture */}
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="none"
                className="size-3.5"
              >
                <motion.path
                  d="M3.2 10.2 7.95 14.6 16.8 5.2"
                  stroke="currentColor"
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  // a zero-length path with a round cap paints a dot, so the
                  // check is hidden until it starts drawing
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{
                    duration: 0.3,
                    delay: (reduce ? 0 : BADGE_AT) + 0.1,
                    ease: [0.23, 1, 0.32, 1],
                    opacity: {
                      duration: 0.01,
                      delay: (reduce ? 0 : BADGE_AT) + 0.1,
                    },
                  }}
                />
              </svg>
              Verified
            </motion.span>
          ) : (
            <motion.span
              key={phase}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
              className="text-body text-text-secondary"
            >
              {phase === "scan" ? (
                "Reading the print"
              ) : count === 0 ? (
                "Press the print"
              ) : (
                <>
                  <span className="text-text-primary tabular-nums">
                    {count}
                  </span>{" "}
                  of {COUNT} inked
                </>
              )}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <span role="status" className="sr-only">
        {done ? "Print verified" : ""}
      </span>

      <AnimatePresence initial={false}>
        {count > 0 ? (
          <motion.div
            key="reset"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute top-3 right-3"
          >
            <TooltipProvider delayDuration={200}>
              <Tooltip label="Start over">
                <button
                  type="button"
                  onClick={reset}
                  aria-label="Start over"
                  className={cn(
                    "inline-flex size-8 cursor-pointer items-center justify-center rounded-full bg-fill-hover text-text-secondary transition-colors duration-200",
                    // one step up from the site's order, since it sits on a
                    // `fill` ground where `bg-fill` would be invisible
                    "hover:bg-fill-active hover:text-text-primary active:bg-stroke-strong active:duration-0",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2 focus-visible:ring-offset-fill",
                  )}
                >
                  <ArrowCounterClockwiseIcon
                    aria-hidden="true"
                    className="size-4"
                  />
                </button>
              </Tooltip>
            </TooltipProvider>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
