"use client";

import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { createDust, flake, paintDust, push, shave, step, sweep } from "./dust";
import { type Card, makeCard } from "./prizes";
import { type DustApi, type Outcome, Ticket } from "./ticket";

/*
 * A scratch card on a table: nine symbols under a silver coating, and three of
 * a kind wins. Drag across the silver and the coating comes away under the
 * coin, with the shavings skidding off beside it and the scratch following the
 * coin's speed. Find the match, let go, and the rest of the coating comes away
 * and the prize strip comes up with a code to copy. The shavings stay on the
 * card until a flick brushes them off.
 */

const now = () => performance.now() / 1000;

export default function ScratchCard() {
  const reduce = useReducedMotion() ?? false;
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [card, setCard] = useState<Card>(() => makeCard(0));
  const [touched, setTouched] = useState(false);

  // the crumbs belong to the table rather than to a card, since they skid off
  // the card and outlive it for the length of a sweep
  const live = useRef({
    dust: createDust(),
    raf: 0,
    lastT: 0,
    dpr: 1,
  });

  const frame = useCallback(() => {
    const s = live.current;
    s.raf = 0;
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    const t = now();
    const dt = Math.min(0.05, Math.max(0, t - s.lastT));
    s.lastT = t;
    const busy = step(s.dust, dt, t);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    paintDust(ctx, s.dust, t);
    if (busy) s.raf = requestAnimationFrame(frame);
  }, []);

  const kick = useCallback(() => {
    const s = live.current;
    if (s.raf) return;
    s.lastT = now();
    s.raf = requestAnimationFrame(frame);
  }, [frame]);

  useEffect(() => {
    const node = stage.current;
    const c = canvas.current;
    const s = live.current;
    if (!node || !c) return;
    const read = () => {
      s.dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = Math.round(node.clientWidth * s.dpr);
      c.height = Math.round(node.clientHeight * s.dpr);
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

  const dust = useMemo<DustApi>(() => {
    const d = () => live.current.dust;
    return {
      shave: (x, y, dx, dy, speed) => {
        shave(d(), x, y, dx, dy, speed, now());
        kick();
      },
      flake: (x, y, fromX, fromY) => {
        flake(d(), x, y, fromX, fromY, now());
        kick();
      },
      push: (x0, y0, x1, y1, reach, speed) => {
        if (push(d(), x0, y0, x1, y1, reach, speed)) kick();
      },
      bounds: (b) => {
        d().bounds = b;
      },
    };
  }, [kick]);

  const scratched = useCallback(() => setTouched(true), []);

  // a keyboard that finished a losing card has nothing on the card to land
  // on, so it lands on the next card instead
  const nextButton = useRef<HTMLButtonElement>(null);
  const settled = useCallback((outcome: Outcome, viaKey: boolean) => {
    if (outcome === "lose" && viaKey) {
      window.requestAnimationFrame(() => nextButton.current?.focus());
    }
  }, []);

  const next = () => {
    sweep(live.current.dust, now());
    kick();
    setTouched(false);
    setCard((c) => makeCard(c.id + 1, c));
  };

  return (
    <div
      ref={stage}
      className="@container relative aspect-8/5 min-h-78 w-full select-none overflow-hidden rounded-lg bg-fill ring-1 ring-stroke ring-inset"
    >
      <AnimatePresence initial={false}>
        <motion.div
          key={card.id}
          initial={{ opacity: 0, y: 14 }}
          animate={{
            opacity: 1,
            y: 0,
            transition: {
              duration: 0.35,
              delay: 0.08,
              ease: [0.23, 1, 0.32, 1],
            },
          }}
          exit={{
            opacity: 0,
            y: -10,
            transition: { duration: 0.18, ease: [0.4, 0, 1, 1] },
          }}
          className="absolute inset-0 grid place-items-center"
        >
          <Ticket
            card={card}
            dust={dust}
            stage={stage}
            reduce={reduce}
            onScratched={scratched}
            onSettled={settled}
          />
        </motion.div>
      </AnimatePresence>

      <canvas
        ref={canvas}
        className="pointer-events-none absolute inset-0 size-full"
      />

      <AnimatePresence initial={false}>
        {touched ? (
          <motion.div
            key="next"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute top-3 right-3"
          >
            <TooltipProvider delayDuration={200}>
              <Tooltip label="New card">
                <button
                  ref={nextButton}
                  type="button"
                  onClick={next}
                  aria-label="New card"
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
