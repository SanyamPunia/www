"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { TextMorph } from "torph/react";
import {
  ArrowCounterClockwiseIcon,
  ArrowsLeftRightIcon,
} from "@/components/icons";
import { cn } from "@/lib/utils";

/**
 * The post's three illustrations. Every one sets the same page twice, as the
 * author tested it and as a reduce motion visitor gets it. `Hero` plays on its
 * own, and `FadeIn` and `Modal` carry a switch that stands in for the system
 * setting, since a page cannot change the setting itself.
 *
 * The mock window is a container, and everything inside it is sized in `cqw`,
 * so one drawing reads the same in a wide figure and on a phone.
 */

/** Out of the prose column, the escape the nested-corners post measured. */
const BREAKOUT =
  "relative left-1/2 my-8 flex w-[min(100vw-2rem,54rem)] -translate-x-1/2 select-none flex-col gap-3";

const STAGE =
  "grid w-full grid-cols-1 gap-6 rounded-lg bg-fill p-5 ring-1 ring-stroke ring-inset sm:grid-cols-2 sm:p-8";

const PILL =
  "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-fill px-3 py-1.5 text-action text-text-secondary transition-colors duration-200 hover:bg-fill-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2 active:bg-fill-active";

const MORPH = {
  duration: 160,
  ease: "cubic-bezier(0.32, 0.72, 0, 1)",
} as const;

const HIDDEN = { opacity: 0, y: 10 };
const SHOWN = { opacity: 1, y: 0 };
const RISE = { duration: 0.55, ease: [0.22, 1, 0.36, 1] } as const;

/* ------------------------------------------------------------- the drawing */

function Bar({ className }: { className?: string }) {
  return <span className={cn("block rounded-full bg-fill-hover", className)} />;
}

/** A mock browser window. Its body is the container every `cqw` reads. */
function Browser({ children }: { children: ReactNode }) {
  return (
    <div className="@container relative overflow-hidden rounded-lg bg-bg ring-1 ring-stroke">
      <div className="flex items-center border-stroke border-b px-[3cqw] py-[2cqw]">
        <div className="flex w-[10cqw] gap-[1.1cqw]">
          <span className="size-[1.6cqw] rounded-full bg-stroke-strong" />
          <span className="size-[1.6cqw] rounded-full bg-stroke-strong" />
          <span className="size-[1.6cqw] rounded-full bg-stroke-strong" />
        </div>
        <span className="mx-auto rounded-full bg-fill px-[4cqw] py-[0.7cqw] text-[2.2cqw] text-text-muted leading-none">
          acme.dev
        </span>
        <span className="w-[10cqw]" />
      </div>
      <div className="relative flex h-[60cqw] flex-col">{children}</div>
    </div>
  );
}

/** The part of the page that never animates, so the page has plainly loaded. */
function Nav() {
  return (
    <div className="flex items-center justify-between px-[5cqw] pt-[4cqw]">
      <div className="flex items-center gap-[1.6cqw]">
        <span className="size-[3.2cqw] rounded-[0.9cqw] bg-text-primary" />
        <Bar className="h-[1.4cqw] w-[8cqw]" />
      </div>
      <div className="flex items-center gap-[2.4cqw]">
        <Bar className="h-[1.2cqw] w-[6cqw]" />
        <Bar className="h-[1.2cqw] w-[6cqw]" />
        <Bar className="h-[1.2cqw] w-[6cqw]" />
        <span className="size-[3.4cqw] rounded-full bg-fill-active" />
      </div>
    </div>
  );
}

/** The dashed outline of a box that holds nothing anyone can see. */
function Ghost({ tag }: { tag?: boolean }) {
  return (
    <>
      <span className="-inset-[0.6cqw] pointer-events-none absolute rounded-[1.2cqw] border border-danger/55 border-dashed" />
      {tag && (
        <span className="-top-[2.2cqw] pointer-events-none absolute right-[0.6cqw] rounded-full bg-danger px-[1.4cqw] py-[0.5cqw] font-mono text-[2.2cqw] text-bg leading-none">
          opacity 0
        </span>
      )}
    </>
  );
}

/**
 * One piece of the page that fades in. `missing` is the bug: it starts hidden
 * and nothing moves it, and `ghost` outlines the box it still takes up.
 */
function Reveal({
  shown,
  missing,
  ghost,
  tag,
  delay = 0,
  children,
}: {
  shown: boolean;
  missing?: boolean;
  ghost?: boolean;
  tag?: boolean;
  delay?: number;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <motion.div
        initial={HIDDEN}
        animate={shown && !missing ? SHOWN : HIDDEN}
        transition={{ ...RISE, delay: shown ? delay : 0 }}
      >
        {children}
      </motion.div>
      {missing && (
        <motion.div
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: ghost ? 1 : 0 }}
          transition={{ duration: 0.3, delay: ghost ? delay : 0 }}
          className="pointer-events-none absolute inset-0"
        >
          <Ghost tag={tag} />
        </motion.div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- the hero */

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD
 *
 *    0ms   both pages loaded, nav only
 *  400ms   headline rises in on the left page
 *  560ms   subline
 *  720ms   button
 *  880ms   three cards, 90ms apart
 * 2200ms   the right page's empty slots outline themselves
 * 5600ms   the left page fades back out
 * 6200ms   loop
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  headline: 400,
  sub: 560,
  cta: 720,
  cards: 880,
  ghosts: 2200,
  out: 5600,
  loop: 6200,
};

/** One integer drives the whole sequence. */
const STAGES = [
  [TIMING.headline, 1],
  [TIMING.sub, 2],
  [TIMING.cta, 3],
  [TIMING.cards, 4],
  [TIMING.ghosts, 5],
  [TIMING.out, 6],
] as const;

/** Where the sequence rests when it does not play. */
const FINAL = 5;

function useStoryboard(active: boolean, still: boolean): number {
  const [stage, setStage] = useState(still ? FINAL : 0);
  useEffect(() => {
    if (still) {
      setStage(FINAL);
      return;
    }
    if (!active) return;
    let timers: number[] = [];
    const play = () => {
      timers = [];
      setStage(0);
      for (const [at, s] of STAGES)
        timers.push(window.setTimeout(() => setStage(s), at));
      timers.push(window.setTimeout(play, TIMING.loop));
    };
    play();
    return () => {
      for (const t of timers) window.clearTimeout(t);
    };
  }, [active, still]);
  return stage;
}

function Landing({ stage, missing }: { stage: number; missing?: boolean }) {
  const on = (n: number) => stage >= n && stage < 6;
  const ghost = stage >= 5 && stage < 6;
  return (
    <Browser>
      <Nav />
      <div className="flex flex-col items-center gap-[2.4cqw] px-[6cqw] pt-[7cqw] text-center">
        <Reveal shown={on(1)} missing={missing} ghost={ghost} tag>
          <span className="block font-medium text-[5.4cqw] text-text-primary leading-tight tracking-tight">
            Ship it before Friday
          </span>
        </Reveal>
        <Reveal shown={on(2)} missing={missing} ghost={ghost} delay={0.06}>
          <div className="flex flex-col items-center gap-[1.2cqw]">
            <Bar className="h-[1.5cqw] w-[44cqw]" />
            <Bar className="h-[1.5cqw] w-[30cqw]" />
          </div>
        </Reveal>
        <Reveal shown={on(3)} missing={missing} ghost={ghost} delay={0.12}>
          <span className="block rounded-full bg-text-primary px-[3.6cqw] py-[1.5cqw] text-[2.3cqw] text-bg leading-none">
            Get started
          </span>
        </Reveal>
      </div>
      <div className="mt-auto grid grid-cols-3 gap-[2.6cqw] px-[5cqw] pb-[5cqw]">
        {[0, 1, 2].map((i) => (
          <Reveal
            key={i}
            shown={on(4)}
            missing={missing}
            ghost={ghost}
            delay={0.18 + i * 0.09}
          >
            <div className="flex flex-col gap-[1.5cqw] rounded-[1.6cqw] bg-surface p-[2.6cqw] ring-1 ring-stroke">
              <span className="size-[3.6cqw] rounded-[0.9cqw] bg-fill-active" />
              <Bar className="h-[1.3cqw] w-4/5" />
              <Bar className="h-[1.3cqw] w-3/5" />
            </div>
          </Reveal>
        ))}
      </div>
    </Browser>
  );
}

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const seen = useInView(ref, { amount: 0.35 });
  const still = useReducedMotion() ?? false;
  const stage = useStoryboard(seen, still);
  return (
    <figure ref={ref} className={BREAKOUT}>
      <div
        role="img"
        aria-label="The same landing page twice. With motion on, its headline, button and cards fade in. With reduce motion on, the page loads with nothing but its nav, and every missing piece is outlined where it should be."
        className={STAGE}
      >
        <div className="flex min-w-0 flex-col gap-2.5">
          <Landing stage={stage} />
          <span className="text-meta text-text-muted">What you tested</span>
        </div>
        <div className="flex min-w-0 flex-col gap-2.5">
          <Landing stage={stage} missing />
          <span className="text-danger text-meta">
            What a reduce motion visitor gets
          </span>
        </div>
      </div>
    </figure>
  );
}

/* ------------------------------------------------------------- the controls */

function Caption({
  label,
  status,
  bad,
}: {
  label: string;
  status: string;
  bad: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-meta">
      <span className="text-text-muted">{label}</span>
      <span
        aria-live="polite"
        className={cn(
          "whitespace-nowrap",
          bad ? "text-danger" : "text-text-muted",
        )}
      >
        {status}
      </span>
    </div>
  );
}

function Controls({
  reduce,
  onReduce,
  onReplay,
}: {
  reduce: boolean;
  onReduce: () => void;
  onReplay: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        aria-pressed={reduce}
        aria-label="Simulate reduce motion"
        onClick={onReduce}
        className={cn(
          PILL,
          reduce &&
            "bg-text-primary text-bg hover:bg-text-primary/85 hover:text-bg active:bg-text-primary/75",
        )}
      >
        <span className="whitespace-nowrap">
          <TextMorph duration={MORPH.duration} ease={MORPH.ease}>
            {reduce ? "reduce motion on" : "reduce motion off"}
          </TextMorph>
        </span>
        <ArrowsLeftRightIcon aria-hidden="true" className="size-3.5" />
      </button>
      <button type="button" onClick={onReplay} className={PILL}>
        <ArrowCounterClockwiseIcon aria-hidden="true" className="size-3.5" />
        <span>Replay</span>
      </button>
    </div>
  );
}

/* ------------------------------------------------------------- the fade-in */

function Dashboard({ fixed, reduce }: { fixed: boolean; reduce: boolean }) {
  const missing = !fixed && reduce;
  return (
    <Browser>
      <Nav />
      <div className="flex flex-col gap-[2.4cqw] px-[5cqw] pt-[6cqw]">
        <div className="relative self-start">
          <motion.span
            className="block font-medium text-[5.4cqw] text-text-primary leading-tight tracking-tight"
            // the broken page skips the destination, the fixed one the start
            initial={fixed && reduce ? false : HIDDEN}
            animate={missing ? undefined : SHOWN}
            transition={{ ...RISE, delay: 0.2 }}
          >
            Welcome back
          </motion.span>
          {missing && <Ghost tag />}
        </div>
        <Bar className="h-[1.5cqw] w-[48cqw]" />
      </div>
      <div className="mt-auto grid grid-cols-2 gap-[2.6cqw] px-[5cqw] pb-[5cqw]">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="flex flex-col gap-[1.6cqw] rounded-[1.6cqw] bg-surface p-[3cqw] ring-1 ring-stroke"
          >
            <Bar className="h-[1.3cqw] w-2/5" />
            <span className="font-medium text-[4.4cqw] text-text-primary tabular-nums leading-none">
              {i === 0 ? "1,284" : "96%"}
            </span>
            <Bar className="h-[1.3cqw] w-3/5" />
          </div>
        ))}
      </div>
    </Browser>
  );
}

export function FadeIn() {
  const [reduce, setReduce] = useState(false);
  const [run, setRun] = useState(0);
  return (
    <figure
      aria-label="Fade-in demo, a broken page beside a fixed one"
      className={BREAKOUT}
    >
      <div className={STAGE}>
        {[false, true].map((fixed) => (
          <div key={String(fixed)} className="flex min-w-0 flex-col gap-2.5">
            {/* a remount, since Motion keeps a value it reached once `animate` goes */}
            <Dashboard key={`${run}-${reduce}`} fixed={fixed} reduce={reduce} />
            <Caption
              label={fixed ? "Fixed" : "Broken"}
              status={!fixed && reduce ? "never shows" : "shows"}
              bad={!fixed && reduce}
            />
          </div>
        ))}
      </div>
      <Controls
        reduce={reduce}
        onReduce={() => setReduce((r) => !r)}
        onReplay={() => setRun((n) => n + 1)}
      />
    </figure>
  );
}

/* --------------------------------------------------------------- the modal */

type Phase = "shut" | "open" | "closing";

/** A real control inside a mock: readable at a phone's width, with room to tap. */
const ACTION =
  "relative cursor-pointer rounded-full px-[4.2cqw] py-[1.9cqw] text-[2.8cqw] leading-none transition-colors duration-200 before:-inset-2 before:absolute focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2";

/** Strong ease-out, so the dialog answers the press at once. */
const EASE_OUT = "ease-[cubic-bezier(0.23,1,0.32,1)]";

function Editor({ fixed, reduce }: { fixed: boolean; reduce: boolean }) {
  const [phase, setPhase] = useState<Phase>("shut");
  const timer = useRef(0);
  const save = useRef<HTMLButtonElement>(null);
  const shut = useRef<HTMLButtonElement>(null);
  // focus only moves for the keyboard, or a mouse press paints a ring
  const byKey = useRef(false);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    if (!byKey.current) return;
    if (phase === "open") shut.current?.focus();
    if (phase === "shut") {
      save.current?.focus();
      byKey.current = false;
    }
  }, [phase]);

  const remove = () => {
    window.clearTimeout(timer.current);
    setPhase("shut");
  };
  const close = (key: boolean) => {
    byKey.current = key;
    // the fixed page finishes the job itself when motion is off
    if (fixed && reduce) return remove();
    setPhase("closing");
    // and keeps a timeout in case the event never comes
    if (fixed) timer.current = window.setTimeout(remove, 350);
  };

  const stuck = phase === "closing" && reduce;
  const status = stuck ? "stuck open" : phase === "shut" ? "closed" : phase;
  const title = `${fixed ? "fixed" : "broken"}-saved`;

  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <Browser>
        <Nav />
        <div className="flex flex-1 flex-col gap-[1.8cqw] px-[5cqw] pt-[6cqw] pb-[5cqw]">
          <span className="font-medium text-[4.4cqw] text-text-primary leading-tight tracking-tight">
            Untitled draft
          </span>
          <Bar className="h-[1.3cqw] w-full" />
          <Bar className="h-[1.3cqw] w-11/12" />
          <Bar className="h-[1.3cqw] w-4/5" />
          <Bar className="h-[1.3cqw] w-2/3" />
          <button
            ref={save}
            type="button"
            onClick={(e) => {
              byKey.current = e.detail === 0;
              setPhase("open");
            }}
            className={cn(
              ACTION,
              "mt-auto self-start bg-text-primary text-bg hover:bg-text-primary/85 active:bg-text-primary/75",
            )}
          >
            Save
          </button>
        </div>
        {phase !== "shut" && (
          // the backdrop goes when the dialog is removed, and only then
          <div
            className={cn(
              "absolute inset-0 grid place-items-center bg-text-primary/20",
              !reduce &&
                `transition-opacity duration-200 starting:opacity-0 ${EASE_OUT}`,
            )}
          >
            <div className="relative">
              <div
                role="dialog"
                aria-labelledby={title}
                onKeyDown={(e) => {
                  if (e.key === "Escape") close(true);
                }}
                onTransitionEnd={(e) => {
                  if (e.target === e.currentTarget && phase === "closing")
                    remove();
                }}
                className={cn(
                  "flex w-[54cqw] flex-col gap-[1.8cqw] rounded-[2cqw] bg-bg p-[4cqw] ring-1 ring-stroke",
                  reduce
                    ? "transition-none"
                    : `transition-[opacity,scale] starting:scale-95 starting:opacity-0 ${EASE_OUT}`,
                  phase === "closing"
                    ? "scale-95 opacity-0 duration-150"
                    : "duration-200",
                )}
              >
                <span
                  id={title}
                  className="font-medium text-[3.4cqw] text-text-primary leading-tight"
                >
                  Changes saved
                </span>
                <Bar className="h-[1.3cqw] w-full" />
                <Bar className="h-[1.3cqw] w-3/4" />
                <button
                  ref={shut}
                  type="button"
                  onClick={(e) => close(e.detail === 0)}
                  className={cn(
                    ACTION,
                    "mt-[1cqw] self-end bg-fill text-text-primary hover:bg-fill-hover active:bg-fill-active",
                  )}
                >
                  Close
                </button>
              </div>
              {/* the dialog it never removed, still in the page under its backdrop */}
              {stuck && <Ghost tag />}
            </div>
          </div>
        )}
      </Browser>
      <Caption label={fixed ? "Fixed" : "Broken"} status={status} bad={stuck} />
    </div>
  );
}

export function Modal() {
  const [reduce, setReduce] = useState(false);
  const [run, setRun] = useState(0);
  return (
    <figure
      aria-label="Dialog demo, a broken page beside a fixed one"
      className={BREAKOUT}
    >
      <div className={STAGE}>
        <Editor key={`b-${run}-${reduce}`} fixed={false} reduce={reduce} />
        <Editor key={`f-${run}-${reduce}`} fixed reduce={reduce} />
      </div>
      <Controls
        reduce={reduce}
        onReduce={() => setReduce((r) => !r)}
        onReplay={() => setRun((n) => n + 1)}
      />
    </figure>
  );
}
