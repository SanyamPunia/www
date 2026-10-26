"use client";

import {
  AnimatePresence,
  motion,
  type Transition,
  useReducedMotion,
} from "motion/react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { TextMorph } from "torph/react";
import {
  ArrowCounterClockwiseIcon,
  ArrowsClockwiseIcon,
  ArrowsLeftRightIcon,
  ArrowUpIcon,
} from "@/components/icons";
import { cn } from "@/lib/utils";
import { armButton, buzz, chime, click, drop } from "./button-sound";
import { spread } from "./ripple";

/*
 * A publish button that does far more than it has to. `ripple.ts` is how its
 * colour changes and `button-sound.ts` the sound. This file is the button, its
 * states and the timing between them.
 *
 * Press it and it publishes, then lands green or red. A failure retries itself
 * twice, each after a countdown drawn as a line draining round the pill,
 * before it hands the retry to the reader.
 *
 * **The button is a pill in every state.** Width is the one value that moves,
 * on a spring, between the measured widths of what each state says, so the
 * corner never animates. The label morphs between states through `torph`,
 * since "Publish", "Publishing" and "Published" share most of their letters.
 *
 * **Every change of colour flows out from the middle of the pill**, which is
 * `ripple.ts`.
 */

type Phase = "idle" | "pending" | "success" | "failure" | "retrying" | "retry";

/** how the next request goes, which the corner picks */
type Outcome = "succeeds" | "fails";
const LATENCY: Record<Outcome, number> = { succeeds: 1400, fails: 1200 };

const TIMING = {
  /** how long "Failed" stays before it counts down */
  failure: 900,
  /** the countdown before each automatic retry */
  countdown: 3,
  /** automatic retries before the retry is the reader's */
  retries: 2,
  /** how long the last word stays before the button resets */
  success: 2000,
  retry: 3200,
};

/** the button's colour in each state, as the token it is read from */
const FILL: Record<Phase, string> = {
  idle: "var(--color-bg)",
  pending: "var(--color-bg)",
  success: tint("success"),
  failure: tint("danger"),
  retrying: tint("danger"),
  retry: tint("danger"),
};

/**
 * A result is a wash of its colour over white, opaque so it covers what is
 * under it. 12% keeps the ink on it at body contrast, the pill the token table
 * measures at 4.59 and 4.61.
 */
function tint(tone: "success" | "danger"): string {
  return `color-mix(in oklab, var(--color-${tone}) 12%, var(--color-bg))`;
}

const INK: Record<Phase, string> = {
  idle: "text-text-primary",
  pending: "text-text-primary",
  success: "text-success",
  failure: "text-danger",
  retrying: "text-danger",
  retry: "text-danger",
};

function words(row: Phase, count: number): string {
  switch (row) {
    case "idle":
      return "Publish";
    case "pending":
      return "Publishing";
    case "success":
      return "Published";
    case "failure":
      return "Failed";
    case "retrying":
      return `Retrying in ${count}`;
    case "retry":
      return "Try again";
  }
}

const ROWS: readonly Phase[] = [
  "idle",
  "pending",
  "success",
  "failure",
  "retrying",
  "retry",
];

const RESIZE: Transition = {
  type: "spring",
  visualDuration: 0.4,
  bounce: 0.18,
};
const MORPH = { duration: 260, ease: "cubic-bezier(0.4, 0, 0.2, 1)" };
const SWAP = { duration: 0.2, ease: [0.23, 1, 0.32, 1] } as const;

const ROW =
  "flex items-center gap-2 whitespace-nowrap px-7 font-medium text-body tabular-nums";

export default function OverengineeredButton() {
  const body = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const fills = useRef<HTMLSpanElement>(null);
  const base = useRef<HTMLSpanElement>(null);
  const measure = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  /** bumped by every new request and every stop, so a stale timer is a no-op */
  const run = useRef(0);

  const reduce = useReducedMotion() ?? false;
  const [phase, setPhase] = useState<Phase>("idle");
  const [count, setCount] = useState(TIMING.countdown);
  const [attempt, setAttempt] = useState(0);
  const [outcome, setOutcome] = useState<Outcome>("succeeds");
  const outcomeRef = useRef(outcome);
  outcomeRef.current = outcome;
  const [widths, setWidths] = useState<Record<Phase, number> | null>(null);
  /** false until the first widths have painted, so the pill mounts at its size */
  const [sized, setSized] = useState(false);
  const [message, setMessage] = useState("");

  /*
   * Every pill is as wide as what it says, so each row is measured once off a
   * hidden copy in the button's own type, and again when the font arrives.
   */
  useLayoutEffect(() => {
    const read = () => {
      const host = measure.current;
      if (!host) return;
      const next = {} as Record<Phase, number>;
      for (const el of host.children) {
        const key = (el as HTMLElement).dataset.phase as Phase | undefined;
        if (key) next[key] = (el as HTMLElement).offsetWidth;
      }
      setWidths(next);
    };
    read();
    // the pill takes its measured width in one step, and the spring only
    // answers changes after that, or it grows out of a line on mount
    void document.fonts?.ready.then(() => {
      read();
      requestAnimationFrame(() => setSized(true));
    });
  }, []);

  /*
   * Every change of colour flows out from the middle of the button rather than
   * switching, and it is written to the DOM, so it renders nothing.
   */
  const shown = useRef(FILL.idle);
  useEffect(() => {
    const next = FILL[phase];
    const host = fills.current;
    const b = button.current;
    if (next === shown.current || !host || !b || !widths) return;
    shown.current = next;
    // the pill may be growing or shrinking under the wash, so it covers the
    // wider of the two
    const w = Math.max(b.offsetWidth, widths[phase]);
    const reach = Math.hypot(w / 2, b.offsetHeight / 2);
    spread(host, next, reach, reduce, () => {
      if (base.current && shown.current === next)
        base.current.style.backgroundColor = next;
    });
  }, [phase, widths, reduce]);

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  const clear = useCallback(() => {
    for (const t of timers.current) clearTimeout(t);
    timers.current = [];
    run.current += 1;
  }, []);

  useEffect(() => {
    const t = timers;
    return () => t.current.forEach(clearTimeout);
  }, []);

  const settle = useCallback(
    (to: Phase, ms: number) => {
      later(() => setPhase("idle"), ms);
      setPhase(to);
    },
    [later],
  );

  /* ------------------------------------------------------------- a request */

  const shake = useCallback(() => {
    if (reduce) return;
    body.current?.animate(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-6px)" },
        { transform: "translateX(5px)" },
        { transform: "translateX(-3px)" },
        { transform: "translateX(2px)" },
        { transform: "translateX(0)" },
      ],
      { duration: 380, easing: "ease-out", delay: 60 },
    );
  }, [reduce]);

  /**
   * One request. The outcome is read as it is sent, so flipping the corner
   * during a countdown changes how the next retry goes. `n` is the attempt,
   * from 0, which decides whether a failure retries itself.
   */
  const send = useCallback(
    (n: number) => {
      clear();
      const token = run.current;
      const live = () => token === run.current;
      const which = outcomeRef.current;
      const ok = which === "succeeds";
      setAttempt(n);
      setPhase("pending");
      setMessage("Publishing.");

      later(() => {
        if (!live()) return;
        if (ok) {
          setMessage("Published.");
          chime();
          buzz(14);
          settle("success", TIMING.success);
          return;
        }
        drop();
        buzz([18, 60, 18]);
        shake();
        setPhase("failure");
        if (n >= TIMING.retries) {
          setMessage("Couldn't publish.");
          later(() => live() && settle("retry", TIMING.retry), TIMING.failure);
          return;
        }
        setMessage(
          `Couldn't publish. Retrying in ${TIMING.countdown} seconds.`,
        );
        later(() => {
          if (!live()) return;
          setCount(TIMING.countdown);
          setPhase("retrying");
          for (let s = 1; s < TIMING.countdown; s++)
            later(() => live() && setCount(TIMING.countdown - s), s * 1000);
          later(() => live() && send(n + 1), TIMING.countdown * 1000);
        }, TIMING.failure);
      }, LATENCY[which]);
    },
    [clear, later, settle, shake],
  );

  /** a retry countdown stopped by hand, which hands the retry to the reader */
  const stop = useCallback(() => {
    clear();
    setMessage("Stopped retrying.");
    settle("retry", TIMING.retry);
  }, [clear, settle]);

  const press = () => {
    armButton();
    if (phase === "pending" || phase === "failure") return;
    click();
    send(phase === "retrying" ? attempt + 1 : 0);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && phase === "retrying") stop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, stop]);

  /* ---------------------------------------------------------------- render */

  const name =
    phase === "retrying"
      ? `Retrying in ${count}, press to retry now`
      : phase === "failure"
        ? "Couldn't publish"
        : words(phase, count);
  const inert = phase === "pending" || phase === "failure";
  const w = widths?.[phase];

  return (
    <div className="relative flex aspect-8/5 min-h-78 w-full select-none items-center justify-center overflow-hidden rounded-lg bg-bg">
      <div ref={body} className="relative">
        <motion.button
          ref={button}
          type="button"
          aria-label={name}
          aria-busy={phase === "pending" || undefined}
          aria-disabled={inert || undefined}
          onClick={press}
          initial={false}
          animate={w === undefined ? undefined : { width: w }}
          transition={reduce || !sized ? { duration: 0 } : RESIZE}
          className={cn(
            "relative isolate flex h-14 items-center justify-center overflow-hidden rounded-full ring-1 ring-stroke",
            "shadow-[0_1px_2px_rgb(0_0_0/0.05),0_6px_16px_-8px_rgb(0_0_0/0.16)]",
            "before:absolute before:inset-0 before:-z-10 before:rounded-full before:transition-colors before:duration-150",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2",
            inert
              ? "cursor-default"
              : "cursor-pointer hover:before:bg-black/[0.03] active:before:bg-black/[0.07] active:before:duration-0",
          )}
        >
          {/* the button's colour, and the washes that change it */}
          <span
            ref={fills}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-20"
          >
            <span
              ref={base}
              className="absolute inset-0"
              style={{ backgroundColor: FILL.idle }}
            />
          </span>

          {phase === "retrying" ? <Drain key={attempt} still={reduce} /> : null}

          {/* the pill's width before the measurement lands, never painted */}
          {widths ? null : (
            <span className={cn(ROW, "invisible")}>
              <span className="size-4" />
              Publish
            </span>
          )}
          <span
            aria-hidden="true"
            className={cn(
              ROW,
              "absolute inset-0 justify-center transition-colors duration-200",
              INK[phase],
            )}
          >
            {/* down 0.1em onto the lowercase x-height's centre, which sits
                below the line box's centre that flex lines it up on */}
            <span className="relative top-[0.1em] grid size-4 shrink-0 place-items-center">
              <AnimatePresence initial={false}>
                <motion.span
                  key={phase}
                  className="absolute inset-0 grid place-items-center"
                  initial={{ opacity: 0, scale: 0.6, filter: "blur(3px)" }}
                  animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                  exit={{
                    opacity: 0,
                    scale: 0.6,
                    filter: "blur(3px)",
                    transition: { duration: 0.12 },
                  }}
                  transition={SWAP}
                >
                  <Icon row={phase} />
                </motion.span>
              </AnimatePresence>
            </span>
            <TextMorph duration={MORPH.duration} ease={MORPH.ease}>
              {words(phase, count)}
            </TextMorph>
          </span>
        </motion.button>
      </div>

      {/* hidden copies of every row, measured for the pill's width */}
      <div
        ref={measure}
        aria-hidden="true"
        className="pointer-events-none invisible absolute top-0 left-0"
      >
        {ROWS.map((k) => (
          <span key={k} data-phase={k} className={cn(ROW, "absolute w-max")}>
            <span className="size-4 shrink-0" />
            {words(k, TIMING.countdown)}
          </span>
        ))}
      </div>

      {/* which request goes next, the site's own mode selector */}
      <button
        type="button"
        aria-label={`Next publish ${outcome}, press to change`}
        onClick={() =>
          setOutcome((o) => (o === "succeeds" ? "fails" : "succeeds"))
        }
        className="absolute top-3 right-3 flex h-7 cursor-pointer items-center gap-1.5 rounded-full bg-fill px-2.5 font-mono text-meta text-text-primary transition-colors duration-200 hover:bg-fill-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2 active:bg-fill-active"
      >
        <ArrowsLeftRightIcon
          aria-hidden="true"
          className="relative top-[0.1em] size-3 shrink-0 text-text-muted"
        />
        <TextMorph duration={200} ease={MORPH.ease}>
          {outcome}
        </TextMorph>
      </button>

      <span aria-live="polite" className="sr-only">
        {message}
      </span>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-lg ring-1 ring-stroke ring-inset"
      />
    </div>
  );
}

function Icon({ row }: { row: Phase }): ReactNode {
  switch (row) {
    case "idle":
      return <ArrowUpIcon aria-hidden="true" className="size-4" />;
    case "pending":
      return <Spinner />;
    case "success":
      return <Mark paths={["M5.5 12.5l4.5 4.5 8.5-10"]} />;
    case "failure":
      return <Mark paths={["M7 7l10 10", "M17 7L7 17"]} />;
    case "retrying":
      return <ArrowsClockwiseIcon aria-hidden="true" className="size-4" />;
    case "retry":
      return (
        <ArrowCounterClockwiseIcon aria-hidden="true" className="size-4" />
      );
  }
}

/**
 * The countdown before an automatic retry, as a deeper wash of red inside the
 * pill that recedes to the left over the countdown. Its leading edge is a
 * gradient, so like the colour flow it has no line for the eye to catch. A
 * hairline round the pill drained the same time first, and read as a stray
 * mark once it was short. Under reduced motion the count still says it, and
 * the wash stays still.
 */
function Drain({ still }: { still: boolean }) {
  const deep = "color-mix(in oklab, var(--color-danger) 20%, var(--color-bg))";
  return (
    <motion.span
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 left-0 -z-10 w-[calc(100%+2rem)]"
      style={{
        backgroundImage: `linear-gradient(to right, ${deep} 0%, ${deep} calc(100% - 2rem), transparent 100%)`,
      }}
      initial={{ x: "0%" }}
      animate={{ x: still ? "0%" : "-100%" }}
      transition={{ duration: TIMING.countdown, ease: "linear" }}
    />
  );
}

function Spinner() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4 motion-safe:animate-spin"
      style={{ animationDuration: "0.7s" }}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="3"
      />
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        pathLength={100}
        strokeDasharray="26 100"
      />
    </svg>
  );
}

/** a tick or a cross, drawn on stroke by stroke as the result lands */
function Mark({ paths }: { paths: string[] }) {
  const reduce = useReducedMotion() ?? false;
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-4"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {paths.map((d, i) => (
        <motion.path
          key={d}
          d={d}
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          // hidden until it starts, since a round cap on a stroke of no length
          // paints a dot
          initial={reduce ? false : { pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{
            pathLength: {
              duration: 0.3,
              delay: 0.1 + i * 0.12,
              ease: [0.65, 0, 0.35, 1],
            },
            opacity: { duration: 0.01, delay: 0.13 + i * 0.12 },
          }}
        />
      ))}
    </svg>
  );
}
