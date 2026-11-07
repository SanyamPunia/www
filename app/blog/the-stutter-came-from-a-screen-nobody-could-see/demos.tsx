"use client";

import {
  AnimatePresence,
  animate,
  motion,
  useInView,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useTransform,
} from "motion/react";
import {
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { TextMorph } from "torph/react";
import {
  ArrowsLeftRightIcon,
  CaretRightIcon,
  PlayIcon,
} from "@/components/icons";
import { type Knob, Lane } from "@/components/lab/controls";
import { bezier } from "@/lib/bezier";
import { cn } from "@/lib/utils";

/**
 * The post's three figures, one per cause, each a picture with one control.
 * `Flight` is the scene itself: the card flying onto a laptop, hitching every
 * time the hidden title under it changes. `Restyle` is a small page whose
 * headline word changes, flashing the whole page or only the word. `Network`
 * is one track where the analytics block lands inside or outside the flight,
 * moved by a connection slider.
 *
 * Each runs on its own while it is on screen, so a reader who touches nothing
 * still sees the point. No figure shows a number, an axis or code.
 */

/** Out of the prose column, the escape the nested-corners post measured. */
const BREAKOUT =
  "relative left-1/2 my-10 flex w-[min(100vw-2rem,54rem)] -translate-x-1/2 select-none flex-col gap-4";

/** The grey ground every figure stands on. */
const STAGE =
  "@container relative w-full overflow-hidden rounded-xl bg-fill ring-1 ring-stroke ring-inset";

const PILL =
  "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-bg px-3.5 py-2 text-action text-text-secondary ring-1 ring-stroke transition-colors duration-200 hover:bg-fill-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2 active:bg-fill-active";

const PILL_ON =
  "bg-text-primary text-bg ring-text-primary hover:bg-text-primary/85 hover:text-bg active:bg-text-primary/75";

const MORPH = {
  duration: 160,
  ease: "cubic-bezier(0.32, 0.72, 0, 1)",
} as const;

/** The roles the screen rolls through, ending on the one it settles on. */
const ROLES = [
  "gtm lead",
  "data engineer",
  "product designer",
  "backend engineer",
  "forward deployed engineer",
];

/** One name in, the last one out, as the real screen swapped them. */
const SWAP = { duration: 0.25, ease: [0.23, 1, 0.32, 1] } as const;

/** A short flash, for whatever a change has to recheck. */
const FLASH = [{ opacity: 1 }, { opacity: 1, offset: 0.3 }, { opacity: 0 }];

/**
 * The one control on a figure: the site's mode pill, whose label is the
 * current state, filled once the fix is on.
 */
function FixToggle({
  fixed,
  onChange,
}: {
  fixed: boolean;
  onChange: (fixed: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={fixed}
      aria-label="Turn the fix on"
      onClick={() => onChange(!fixed)}
      className={cn(PILL, fixed && PILL_ON)}
    >
      <span className="whitespace-nowrap">
        <TextMorph duration={MORPH.duration} ease={MORPH.ease}>
          {fixed ? "after the fix" : "before the fix"}
        </TextMorph>
      </span>
      <ArrowsLeftRightIcon aria-hidden="true" className="size-3.5" />
    </button>
  );
}

/** The line under a figure: what is happening, red while it is the bug. */
function Caption({ children, bad }: { children: ReactNode; bad: boolean }) {
  return (
    <p
      aria-live="polite"
      className={cn(
        "min-w-0 text-body transition-colors duration-200",
        bad ? "text-danger" : "text-text-secondary",
      )}
    >
      {children}
    </p>
  );
}

/** The row under a stage: what is happening, and the one control. */
function Footer({
  fixed,
  onChange,
  bad,
  children,
}: {
  fixed: boolean;
  onChange: (fixed: boolean) => void;
  bad: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
      <Caption bad={bad}>{children}</Caption>
      <FixToggle fixed={fixed} onChange={onChange} />
    </div>
  );
}

/* ---------------------------------------------------------------- flight */

/** The card's trip from the top of the page onto the screen, in ms. */
const FLIGHT = 2000;
/** How long one hidden title change froze the page. */
const STALL = 160;
/** Before the fix, the roll starts as the screen nears the viewport. */
const HIDDEN = [150, 500, 850, 1200, 1550];
/** After it, the roll waits for the card to land. */
const SEEN_FROM = FLIGHT + 350;
const swapsFor = (fixed: boolean) =>
  fixed ? ROLES.map((_, i) => SEEN_FROM + i * 350) : HIDDEN;
const runFor = (fixed: boolean) =>
  fixed ? SEEN_FROM + 4 * 350 + 1300 : FLIGHT + 1500;

const glide = bezier(0.65, 0, 0.35, 1);
const clamp = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Where the card is drawn at time `t`. A stalled page draws nothing new, so
 * during a stall the card holds still, then jumps to where it should be.
 */
const drawnAt = (t: number, fixed: boolean) => {
  if (!fixed) for (const s of HIDDEN) if (t >= s && t < s + STALL) return s;
  return t;
};

export function Flight() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { amount: 0.35 });
  const still = useReducedMotion() ?? false;
  const [fixed, setFixed] = useState(false);
  const [count, setCount] = useState(0);
  const clock = useMotionValue(0);
  const fixedRef = useRef(fixed);
  fixedRef.current = fixed;
  const title = useRef<HTMLSpanElement>(null);

  const cardTransform = useTransform(clock, (t) => {
    const p = glide(clamp(drawnAt(t, fixedRef.current) / FLIGHT));
    return `translateY(${-(1 - p) * 92}%) scale(${0.4 + p * 0.6})`;
  });
  const cardOpacity = useTransform(clock, (t) => 1 - clamp((t - FLIGHT) / 280));
  // Red for exactly as long as the card is frozen, so the hitch shows in a
  // still frame as well as in motion.
  const frozen = useTransform(clock, (t) =>
    drawnAt(t, fixedRef.current) === t ? 0 : 1,
  );
  // The screen is there the whole time, faint, and forms as the card lands.
  const screenOpacity = useTransform(
    clock,
    (t) => 0.42 + 0.58 * clamp((t - FLIGHT + 120) / 380),
  );

  useMotionValueEvent(clock, "change", (t) => {
    const n = swapsFor(fixedRef.current).filter((s) => s <= t).length;
    setCount((c) => {
      if (c === n) return c;
      // A change made while nobody can see it is the one that costs.
      if (n > c && !fixedRef.current)
        title.current?.animate(
          [{ color: "var(--color-danger)" }, { color: "inherit" }],
          { duration: 500, easing: "ease-out" },
        );
      return n;
    });
  });

  // Loops while it is on screen, and restarts at once when the fix flips.
  // Reduced motion shows the finished scene and runs nothing.
  useEffect(() => {
    if (still) {
      clock.jump(runFor(fixed));
      return;
    }
    if (!inView) return;
    let stopped = false;
    let pause = 0;
    let run: ReturnType<typeof animate> | null = null;
    const loop = () => {
      if (stopped) return;
      clock.jump(0);
      run = animate(clock, runFor(fixed), {
        duration: runFor(fixed) / 1000,
        ease: "linear",
        onComplete: () => {
          pause = window.setTimeout(loop, 700);
        },
      });
    };
    loop();
    return () => {
      stopped = true;
      run?.stop();
      window.clearTimeout(pause);
    };
  }, [inView, fixed, still, clock]);

  const role = count === 0 ? null : ROLES[count - 1];

  return (
    <figure
      ref={ref}
      aria-label="A card flies down the page and lands on a laptop screen. Before the fix, the faint screen under it changes its title five times on the way, and the card hitches each time. After it, the card glides and the title changes once the screen can be seen."
      className={BREAKOUT}
    >
      <div className={cn(STAGE, "aspect-[4/3] sm:aspect-[16/10]")}>
        {/* The laptop: a dark lid with the screen in it, and a base */}
        <div className="absolute top-[44%] left-[10%] h-[42%] w-[80%] sm:top-[42%] sm:left-[24%] sm:h-[44%] sm:w-[52%] rounded-[1.6cqw] bg-inverse-bg p-[0.9cqw] shadow-[0_1px_2px_rgb(0_0_0/0.12),0_12px_32px_-16px_rgb(0_0_0/0.35)]">
          <motion.div
            className="flex h-full flex-col gap-[1.8cqw] rounded-[0.9cqw] bg-bg px-[3cqw] py-[2.4cqw]"
            style={{ opacity: screenOpacity }}
          >
            <div className="flex items-center gap-[1cqw] text-[max(0.7rem,2.2cqw)] text-text-muted leading-none">
              <span>roles</span>
              <CaretRightIcon
                aria-hidden="true"
                className="size-[max(0.6rem,1.8cqw)]"
              />
              <span
                ref={title}
                className="inline-grid min-h-[1em] overflow-hidden text-text-primary"
              >
                <AnimatePresence initial={false}>
                  {role && (
                    <motion.span
                      key={role}
                      className="whitespace-nowrap [grid-area:1/1]"
                      initial={{ opacity: 0, y: "60%" }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: "-60%" }}
                      transition={still ? { duration: 0 } : SWAP}
                    >
                      {role}
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>
            </div>
            <span className="h-[1.1cqw] w-[40%] rounded-full bg-fill-hover" />
            <span className="h-[1.1cqw] w-[62%] rounded-full bg-fill-hover" />
            <div className="mt-auto grid grid-cols-3 gap-[1.4cqw]">
              <span className="h-[5cqw] rounded-[0.8cqw] bg-fill" />
              <span className="h-[5cqw] rounded-[0.8cqw] bg-fill" />
              <span className="h-[5cqw] rounded-[0.8cqw] bg-fill" />
            </div>
          </motion.div>
        </div>
        <div className="absolute top-[86%] left-[5%] h-[3%] w-[90%] sm:left-[19%] sm:w-[62%] rounded-t-[0.3cqw] rounded-b-[1.4cqw] bg-stroke-strong" />

        {/* The card, drawn over the screen's box and carried down to it */}
        <motion.div
          aria-hidden="true"
          className="absolute top-[44%] left-[10%] flex h-[42%] w-[80%] sm:top-[42%] sm:left-[24%] sm:h-[44%] sm:w-[52%] flex-col gap-[1.4cqw] rounded-[1.6cqw] bg-bg p-[1.6cqw] shadow-[0_2px_4px_rgb(0_0_0/0.06),0_18px_40px_-18px_rgb(0_0_0/0.35)] ring-1 ring-stroke"
          style={{ transform: cardTransform, opacity: cardOpacity }}
        >
          <motion.span
            className="pointer-events-none absolute -inset-px rounded-[1.6cqw] ring-2 ring-danger"
            style={{ opacity: frozen }}
          />
          <div className="grid flex-1 place-items-center rounded-[1cqw] bg-fill-active">
            <PlayIcon className="size-[4cqw] text-text-muted" />
          </div>
          <span className="h-[1.1cqw] w-[45%] rounded-full bg-fill-hover" />
        </motion.div>
      </div>
      <Footer fixed={fixed} onChange={setFixed} bad={!fixed}>
        {fixed
          ? "The title changes after the card lands, so the card glides."
          : "The card hitches every time the faint title under it changes."}
      </Footer>
    </figure>
  );
}

/* --------------------------------------------------------------- restyle */

/** Time between two word changes. */
const WORD_GAP_MS = 1100;

/**
 * Calls `onAdd` for each style tag `popLayout` writes into `document.head` for
 * an exit inside `box`. The tag names the leaving element by its
 * `data-motion-pop-id`, which is still on that element when the tag lands, so
 * nothing else on the page can set it off. This is what flashes the page, so
 * the flash is the real event and not a timer.
 */
function useStyleTags(box: RefObject<HTMLElement | null>, onAdd: () => void) {
  const add = useRef(onAdd);
  add.current = onAdd;
  useEffect(() => {
    const seen = new MutationObserver((records) => {
      for (const record of records)
        for (const node of record.addedNodes) {
          if (!(node instanceof HTMLStyleElement)) continue;
          const rule = node.sheet?.cssRules[0];
          const id =
            rule && "selectorText" in rule
              ? (rule as CSSStyleRule).selectorText.match(
                  /data-motion-pop-id="([^"]+)"/,
                )?.[1]
              : undefined;
          if (id && box.current?.querySelector(`[data-motion-pop-id="${id}"]`))
            add.current();
        }
    });
    seen.observe(document.head, { childList: true });
    return () => seen.disconnect();
  }, [box]);
}

/**
 * The word that changes, written either way. Both sit in a box one line tall
 * that clips top and bottom only, since a leaving word can be wider than the
 * box, so a frame where the leaving word is still in the flow cannot
 * stack the two words, grow the line and shift the page, and the leaving word
 * cannot rise over the line above.
 */
function Word({
  role,
  pop,
  still,
}: {
  role: string;
  pop: boolean;
  still: boolean;
}) {
  const props = {
    initial: { opacity: 0, y: "50%" },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: "-50%" },
    transition: still ? { duration: 0 } : SWAP,
  };
  return pop ? (
    <span className="relative block h-[1.25em] [clip-path:inset(0_-100vw)]">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span key={role} className="block whitespace-nowrap" {...props}>
          {role}
        </motion.span>
      </AnimatePresence>
    </span>
  ) : (
    <span className="grid h-[1.25em] [clip-path:inset(0_-100vw)]">
      <AnimatePresence initial={false}>
        <motion.span
          key={role}
          className="whitespace-nowrap [grid-area:1/1]"
          {...props}
        >
          {role}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** The red wash a recheck paints over whatever it covers. */
const WASH =
  "pointer-events-none absolute opacity-0 bg-danger/15 ring-2 ring-danger ring-inset";

export function Restyle() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { amount: 0.35 });
  const still = useReducedMotion() ?? false;
  const [fixed, setFixed] = useState(false);
  const [index, setIndex] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const pageWash = useRef<HTMLSpanElement>(null);
  const wordWash = useRef<HTMLSpanElement>(null);

  const flash = useCallback((el: HTMLElement | null) => {
    el?.animate(FLASH, { duration: 800, easing: "ease-out" });
  }, []);
  useStyleTags(box, () => flash(pageWash.current));

  useEffect(() => {
    if (!inView) return;
    const tick = window.setInterval(
      () => setIndex((i) => (i + 1) % ROLES.length),
      WORD_GAP_MS,
    );
    return () => window.clearInterval(tick);
  }, [inView]);

  // Without the mode only the word itself is rechecked.
  // biome-ignore lint/correctness/useExhaustiveDependencies: flashes once per word change
  useEffect(() => {
    if (fixed && index > 0) flash(wordWash.current);
  }, [index]);

  return (
    <figure
      ref={ref}
      aria-label="A small web page whose headline word keeps changing. Before the fix, the whole page flashes red on every change, because the browser rechecks all of it. After it, only the word flashes."
      className={BREAKOUT}
    >
      <div
        className={cn(STAGE, "grid min-h-96 place-items-center p-6 sm:p-12")}
      >
        <div
          ref={box}
          className="relative flex w-full max-w-[34rem] flex-col gap-5 overflow-hidden rounded-xl bg-bg p-6 shadow-[0_1px_2px_rgb(0_0_0/0.06),0_16px_40px_-20px_rgb(0_0_0/0.3)] ring-1 ring-stroke sm:p-8"
        >
          <span ref={pageWash} className={cn(WASH, "inset-0 rounded-xl")} />
          <div className="flex items-center justify-between">
            <span className="size-4 rounded-full bg-text-primary" />
            <div className="flex gap-2">
              <span className="h-2 w-8 rounded-full bg-fill-active" />
              <span className="h-2 w-8 rounded-full bg-fill-active" />
              <span className="h-2 w-8 rounded-full bg-fill-active" />
            </div>
          </div>
          <p className="flex flex-col gap-1 pt-4 text-text-primary leading-tight">
            <span className="text-body text-text-muted">Now hiring</span>
            <span className="relative self-start text-[clamp(1.15rem,4.4cqw,1.75rem)]">
              <span
                ref={wordWash}
                className={cn(WASH, "-inset-x-1.5 -inset-y-0.5 rounded-md")}
              />
              <Word role={ROLES[index]} pop={!fixed} still={still} />
            </span>
          </p>
          <div className="flex flex-col gap-2">
            <span className="h-2 w-full rounded-full bg-fill-hover" />
            <span className="h-2 w-[86%] rounded-full bg-fill-hover" />
            <span className="h-2 w-[64%] rounded-full bg-fill-hover" />
          </div>
          <div className="grid grid-cols-3 gap-3 pt-2">
            <span className="h-16 rounded-lg bg-fill" />
            <span className="h-16 rounded-lg bg-fill" />
            <span className="h-16 rounded-lg bg-fill" />
          </div>
        </div>
      </div>
      <Footer fixed={fixed} onChange={setFixed} bad={!fixed}>
        {fixed
          ? "Safari rechecks only the word."
          : "Every word change makes Safari recheck the whole page."}
      </Footer>
    </figure>
  );
}

/* --------------------------------------------------------------- network */

/** The first seconds after the page loads, in ms. */
const SPAN = 6200;
const SCROLL = { first: 700, stops: 2200 };
const CARD = [1000, 2200] as const;
const BLOCK = 350;
const REST = 1000;

const DELAY: Knob<"delay"> = {
  key: "delay",
  label: "your connection",
  min: 100,
  max: 2500,
  step: 25,
  format: (v) => (v < 600 ? "fast" : v < 1400 ? "average" : "slow"),
};

const pct = (t: number) => `${(t / SPAN) * 100}%`;

export function Network() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { amount: 0.4, once: true });
  const still = useReducedMotion() ?? false;
  const [fixed, setFixed] = useState(false);
  const [delay, setDelay] = useState(350);

  // Before the fix it starts on the first scroll, after it once scrolling
  // has rested, and either way it lands one network delay later.
  const start = (fixed ? SCROLL.stops + REST : SCROLL.first) + delay;
  const hitch = start < CARD[1] && start + BLOCK > CARD[0];
  const mark = fixed
    ? { at: SCROLL.stops, label: "scrolling stops" }
    : { at: SCROLL.first, label: "first scroll" };
  const spring = still
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 380, damping: 34 };

  return (
    <figure
      ref={ref}
      aria-label="A track of the first seconds on the page, with the card's flight marked on it. The analytics script blocks the page for a moment. Before the fix it starts on the first scroll, so on a fast connection it lands while the card flies. After it, it waits until scrolling stops, so it misses the flight on any connection."
      className={BREAKOUT}
    >
      <div
        className={cn(
          STAGE,
          "flex min-h-80 flex-col justify-center gap-10 px-6 py-12 sm:px-12",
        )}
      >
        <div className="relative flex flex-col gap-3">
          {/* The moment the load starts, down through both lanes */}
          <motion.span
            aria-hidden="true"
            className="absolute top-0 bottom-6 w-0 border-text-muted/60 border-l border-dashed"
            initial={false}
            animate={{ left: pct(mark.at) }}
            transition={spring}
          />
          {/* The page: the card's flight, the one moment that has to be smooth */}
          <div className="relative h-12">
            <span className="absolute inset-x-0 top-1/2 h-px bg-stroke-strong" />
            <span
              className={cn(
                "absolute inset-y-0 flex items-center justify-center whitespace-nowrap rounded-lg text-meta ring-1 transition-colors duration-200",
                hitch
                  ? "bg-danger/10 text-danger ring-danger"
                  : "bg-bg text-text-secondary ring-stroke-strong",
              )}
              style={{ left: pct(CARD[0]), width: pct(CARD[1] - CARD[0]) }}
            >
              card flies
            </span>
          </div>
          {/* Analytics: downloading, then one block that freezes the page */}
          <div className="relative h-12">
            <span className="absolute inset-x-0 top-1/2 h-px bg-stroke-strong" />
            <motion.span
              aria-hidden="true"
              className="absolute top-1/2 h-0 -translate-y-1/2 border-text-muted border-t-2 border-dotted"
              initial={false}
              animate={{ left: pct(mark.at), width: pct(start - mark.at) }}
              transition={spring}
            />
            <motion.span
              className="absolute bottom-[calc(50%+0.4rem)] -translate-x-1/2 whitespace-nowrap text-meta text-text-muted"
              initial={false}
              // A short wait has no room for its label, and the line says it.
              animate={{
                left: pct((mark.at + start) / 2),
                opacity: start - mark.at > 900 ? 1 : 0,
              }}
              transition={{ left: spring, opacity: { duration: 0.15 } }}
            >
              downloading
            </motion.span>
            <motion.span
              className="absolute inset-y-0"
              style={{ width: pct(BLOCK) }}
              initial={{ left: pct(start), opacity: 0 }}
              animate={{ left: pct(start), opacity: inView || still ? 1 : 0 }}
              transition={
                still
                  ? { duration: 0 }
                  : { left: spring, opacity: { duration: 0.3, delay: 0.2 } }
              }
            >
              <span
                className={cn(
                  "block h-full min-w-2 rounded-lg transition-colors duration-200",
                  hitch ? "bg-danger" : "bg-text-secondary",
                )}
              />
              <span
                className={cn(
                  "absolute top-1/2 -translate-y-1/2 whitespace-nowrap bg-fill px-1 text-meta transition-colors duration-200",
                  // Near the end of the track the label goes on the left.
                  start > SPAN * 0.78 ? "right-full mr-1" : "left-full ml-1",
                  hitch ? "text-danger" : "text-text-secondary",
                )}
              >
                analytics
              </span>
            </motion.span>
          </div>
          {/* What starts the load */}
          <div className="relative h-6">
            <motion.span
              className="absolute top-0 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap text-meta text-text-muted"
              initial={false}
              animate={{ left: pct(mark.at) }}
              transition={spring}
            >
              {mark.label}
            </motion.span>
          </div>
        </div>
        <div className="w-full sm:max-w-72">
          <Lane knob={DELAY} value={delay} onChange={setDelay} />
        </div>
      </div>
      <Footer fixed={fixed} onChange={setFixed} bad={hitch}>
        {hitch
          ? "It lands while the card flies, so the card hitches."
          : fixed
            ? "It waits for scrolling to stop, so the card stays smooth on any connection."
            : "It lands after the card, but only because the connection is slow."}
      </Footer>
    </figure>
  );
}
