"use client";

import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
} from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { TextMorph } from "torph/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  chevron,
  reloadMorph,
  SHARE_TRAY,
  STAR,
  shareArrow,
  sidebarPane,
  WINDOW_RECT,
} from "./glyphs";
import { PAGES, SITE, START } from "./pages";
import { echo, Glyph, nudge, Tool, useFlat } from "./tool";

const LOAD = 1.2;
/** presses this close together count as one run, which adds copies up to 2 */
const RUN = 340;
/** The bar stands on the stage and the address is cut into the bar */
const RAISED =
  "inset 0 1px 0 rgb(255 255 255), inset 0 -1px 0 rgb(0 0 0 / 0.04), 0 1px 2px rgb(0 0 0 / 0.08), 0 6px 12px -4px rgb(0 0 0 / 0.1), 0 20px 36px -14px rgb(0 0 0 / 0.16)";
const WELL =
  "inset 0 1px 3px rgb(0 0 0 / 0.13), inset 0 1px 1px rgb(0 0 0 / 0.05), 0 1px 0 rgb(255 255 255)";
/** how far a press leans the sidebar pane, as a share of its travel */
const LEAN = 0.16;
const PANE = { type: "spring", stiffness: 420, damping: 26 } as const;
const TILT = -32;
const WIND = -52;
const TURN = { type: "spring", stiffness: 340, damping: 18 } as const;
const SPIN = { duration: 0.5, ease: [0.3, 0, 0.1, 1] } as const;
const MORPH = { duration: 0.42, delay: 0.04, ease: [0.4, 0, 0.2, 1] } as const;

/** Back and forward are one icon, mirrored */
function Arrow({
  dir,
  spent,
  onGo,
}: {
  dir: -1 | 1;
  spent: boolean;
  onGo: () => void;
}) {
  const path = useRef<SVGPathElement>(null);
  const run = useRef(0);
  const last = useRef(-Infinity);
  const reduce = useReducedMotion();
  const { press, release } = useFlat((f) => {
    path.current?.setAttribute("d", chevron(dir, f));
  });

  return (
    <Tool
      name={dir < 0 ? "back" : "forward"}
      label={dir < 0 ? "Back" : "Forward"}
      spent={spent}
      onPress={spent ? undefined : press}
      onFire={() => {
        const node = path.current;
        if (spent) {
          if (node && !reduce) nudge(node, dir * 2.5);
          return;
        }
        const now = performance.now();
        run.current = now - last.current < RUN ? run.current + 1 : 0;
        last.current = now;
        if (node && !reduce) echo(node, dir * 7, 0, Math.min(run.current, 2));
        release();
        onGo();
      }}
    >
      <Glyph>
        <path ref={path} d={chevron(dir, 0)} />
      </Glyph>
    </Tool>
  );
}

/**
 * Tilts back on a hover and winds further under a press. The release turns it
 * a full turn forward, and over that turn the drawing morphs into a stop. The
 * way back is the same turn and the same morph in reverse.
 */
function Reload({
  loading,
  onLoad,
  onStop,
}: {
  loading: boolean;
  onLoad: () => void;
  onStop: () => void;
}) {
  const ring = useRef<SVGPathElement>(null);
  const head = useRef<SVGPathElement>(null);
  const rotate = useMotionValue(0);
  const morph = useMotionValue(0);
  const reduce = useReducedMotion();
  const over = useRef(false);
  const spinning = useRef(false);
  const was = useRef(loading);

  useMotionValueEvent(morph, "change", (t) => {
    const [a, b] = reloadMorph(t);
    ring.current?.setAttribute("d", a);
    head.current?.setAttribute("d", b);
  });

  const rest = useCallback(() => {
    if (reduce || spinning.current) return;
    animate(rotate, over.current ? TILT : 0, TURN);
  }, [reduce, rotate]);

  // follows `loading`, so a load that ends on its own and one stopped by hand
  // take the same way back
  useEffect(() => {
    if (was.current === loading) return;
    was.current = loading;
    const to = loading ? 1 : 0;
    if (reduce) {
      morph.jump(to);
      return;
    }
    spinning.current = true;
    animate(morph, to, MORPH);
    animate(rotate, 360, {
      ...SPIN,
      onComplete: () => {
        rotate.jump(0);
        spinning.current = false;
        if (!loading) rest();
      },
    });
  }, [loading, reduce, morph, rotate, rest]);

  return (
    <Tool
      name="reload"
      label={loading ? "Stop" : "Reload"}
      onPress={(down) => {
        if (loading || reduce || spinning.current) return;
        animate(rotate, down ? WIND : over.current ? TILT : 0, TURN);
      }}
      onHover={(hovering) => {
        over.current = hovering;
        if (!loading) rest();
      }}
      onFire={() => {
        if (loading) onStop();
        else onLoad();
      }}
    >
      <motion.span className="grid size-6 sm:size-7" style={{ rotate }}>
        <Glyph>
          <path ref={ring} d={reloadMorph(0)[0]} />
          <path ref={head} d={reloadMorph(0)[1]} />
        </Glyph>
      </motion.span>
    </Tool>
  );
}

/** Only the fill moves: it grows out of the middle of the star and back */
function Star({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <Tool
      name="star"
      label={on ? "Remove bookmark" : "Bookmark this page"}
      pressed={on}
      onFire={onToggle}
    >
      {/* a star's ink sits above its centre */}
      <span
        className={cn(
          "relative top-px grid size-6 transition-colors duration-200 sm:size-7",
          on && "text-accent",
        )}
      >
        <Glyph>
          <path
            d={STAR}
            fill="currentColor"
            stroke="none"
            className={cn(
              "origin-center transition-all [transform-box:fill-box] motion-reduce:transition-none",
              on
                ? "scale-100 opacity-100 duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                : "scale-0 opacity-0 duration-150 ease-out",
            )}
          />
          <path d={STAR} />
        </Glyph>
      </span>
    </Tool>
  );
}

function Share({ onShare }: { onShare: () => void }) {
  const path = useRef<SVGPathElement>(null);
  const reduce = useReducedMotion();
  const { press, release } = useFlat((f) => {
    path.current?.setAttribute("d", shareArrow(f));
  });

  return (
    <Tool
      name="share"
      label="Copy link"
      onPress={press}
      onFire={() => {
        if (path.current && !reduce) echo(path.current, 0, -8);
        release();
        onShare();
      }}
    >
      <Glyph>
        <path d={SHARE_TRAY} />
        <path ref={path} d={shareArrow(0)} />
      </Glyph>
    </Tool>
  );
}

/**
 * The pane is one value, so a press leans it toward where a release will send
 * it and the toggle carries on from there.
 */
function SidebarToggle({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  const fill = useRef<SVGPathElement>(null);
  const line = useRef<SVGPathElement>(null);
  const pane = useMotionValue(open ? 1 : 0);
  const reduce = useReducedMotion();
  const rest = sidebarPane(open ? 1 : 0);

  useMotionValueEvent(pane, "change", (v) => {
    const next = sidebarPane(v);
    fill.current?.setAttribute("d", next.fill);
    line.current?.setAttribute("d", next.line);
  });

  const send = (to: number) => {
    if (reduce) pane.jump(to);
    else animate(pane, to, PANE);
  };

  return (
    <Tool
      name="sidebar"
      className="hidden sm:mr-2 sm:grid"
      label={open ? "Hide sidebar" : "Show sidebar"}
      pressed={open}
      onPress={(down) => {
        if (reduce) return;
        const at = open ? 1 : 0;
        send(down ? at + (open ? -LEAN : LEAN) : at);
      }}
      onFire={() => {
        send(open ? 0 : 1);
        onToggle();
      }}
    >
      <Glyph>
        <rect {...WINDOW_RECT} />
        <path
          ref={fill}
          d={rest.fill}
          fill="currentColor"
          fillOpacity={0.28}
          stroke="none"
        />
        <path ref={line} d={rest.line} />
      </Glyph>
    </Tool>
  );
}

export default function BrowserToolbar() {
  const [index, setIndex] = useState(START);
  const [loading, setLoading] = useState(false);
  const [sidebar, setSidebar] = useState(true);
  const [stars, setStars] = useState<ReadonlySet<number>>(() => new Set([3]));
  const [copied, setCopied] = useState(false);

  const progress = useMotionValue(0);
  const barOpacity = useMotionValue(0);
  const timer = useRef(0);
  const copyTimer = useRef(0);

  const address = `${SITE}${PAGES[index]}`;

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      clearTimeout(copyTimer.current);
    },
    [],
  );

  const endLoad = (finished: boolean) => {
    clearTimeout(timer.current);
    setLoading(false);
    animate(progress, finished ? 1 : progress.get(), { duration: 0.14 });
    animate(barOpacity, 0, { duration: 0.2, delay: 0.1 });
  };

  const load = () => {
    setLoading(true);
    progress.jump(0);
    barOpacity.jump(1);
    animate(progress, 0.86, { duration: LOAD, ease: [0.2, 0.7, 0.3, 1] });
    timer.current = window.setTimeout(() => endLoad(true), LOAD * 1000);
  };

  const go = (to: number) => {
    if (loading) endLoad(false);
    setIndex(to);
  };

  const share = () => {
    void navigator.clipboard?.writeText(`https://${address}`).catch(() => {});
    setCopied(true);
    clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="grid aspect-8/5 min-h-56 w-full select-none place-items-center rounded-lg bg-linear-to-b from-surface to-fill-hover p-3 ring-1 ring-stroke ring-inset sm:p-6">
      <TooltipProvider delayDuration={500}>
        <div
          className="relative flex w-full items-center gap-0.5 overflow-hidden rounded-xl bg-bg p-1.5 outline outline-stroke sm:gap-1 sm:p-2"
          style={{
            backgroundImage:
              "linear-gradient(to bottom, rgb(255 255 255 / 1), rgb(0 0 0 / 0.018))",
            boxShadow: RAISED,
          }}
        >
          <SidebarToggle
            open={sidebar}
            onToggle={() => setSidebar((o) => !o)}
          />
          <Arrow dir={-1} spent={index === 0} onGo={() => go(index - 1)} />
          <Arrow
            dir={1}
            spent={index === PAGES.length - 1}
            onGo={() => go(index + 1)}
          />
          <Reload
            loading={loading}
            onLoad={load}
            onStop={() => endLoad(false)}
          />
          <div
            style={{ boxShadow: WELL }}
            className="mx-1 flex h-11 min-w-0 flex-1 items-center overflow-hidden whitespace-nowrap rounded-lg bg-fill px-3 text-body text-text-secondary [text-transform:none] [font-kerning:none] [font-variant-ligatures:none] sm:mx-1.5 sm:h-14 sm:px-4"
          >
            <TextMorph duration={220} ease="cubic-bezier(0.4, 0, 0.2, 1)">
              {copied ? "Link copied" : address}
            </TextMorph>
          </div>
          <Star
            on={stars.has(index)}
            onToggle={() =>
              setStars((prev) => {
                const next = new Set(prev);
                if (!next.delete(index)) next.add(index);
                return next;
              })
            }
          />
          <Share onShare={share} />
          <motion.span
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-linear-to-r from-accent/0 via-accent/35 to-accent"
            style={{ scaleX: progress, opacity: barOpacity }}
          />
          <span role="status" className="sr-only">
            {copied ? "Link copied" : loading ? "Loading" : address}
          </span>
        </div>
      </TooltipProvider>
    </div>
  );
}
