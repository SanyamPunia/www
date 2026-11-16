"use client";

import {
  animate,
  type MotionValue,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import {
  type ReactNode,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from "react";
import { TextMorph } from "torph/react";
import {
  ArrowDownIcon,
  ArrowsLeftRightIcon,
  CheckIcon,
  CodeIcon,
  HandIcon,
  XIcon,
} from "@/components/icons";
import { cn } from "@/lib/utils";

/**
 * The post's six figures. Four share one picture, a page being swiped:
 * `Mac` is a browser window over a trackpad, `Phone` a phone with a finger on
 * the screen. `Scroll` is the bug and the fix, `Pair` splits the bug into its
 * two causes, `Bisect` is the hunt for it, and `Inputs` shows the fix landing
 * on one device and not the other. `Paths` is a diagram of where a swipe goes
 * before the page moves, and `Query` is which devices the fix's query matches.
 *
 * Each runs on its own while it is on screen. No figure shows a number or an
 * axis, the same as the stutter post's figures.
 */

/** Out of the prose column, the escape the nested-corners post measured. */
const BREAKOUT =
  "relative left-1/2 my-10 flex w-[min(100vw-2rem,54rem)] -translate-x-1/2 select-none flex-col gap-4";

/** The grey ground every figure stands on. */
const STAGE =
  "@container relative w-full overflow-hidden rounded-xl bg-fill ring-1 ring-stroke ring-inset";

const PILL =
  "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-bg px-3.5 py-2 text-action text-text-secondary ring-1 ring-stroke transition-colors duration-200 hover:bg-fill-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2 active:bg-fill-active disabled:cursor-not-allowed disabled:opacity-50";

const PILL_ON =
  "bg-text-primary text-bg ring-text-primary hover:bg-text-primary/85 hover:text-bg active:bg-text-primary/75";

const MORPH = {
  duration: 160,
  ease: "cubic-bezier(0.32, 0.72, 0, 1)",
} as const;

/** The page is three screens tall, and one swipe moves it half a screen. */
const SCREENS = 3;
/** Both in % of the page's own height, which is what `translateY` reads. */
const STEP = 100 / (SCREENS * 2);
const END = 100 - 100 / SCREENS;
const SWIPES = 4;
/** How far past the end the rubber band pulls, in the same units. */
const STRETCH = 4;

const GLIDE = [0.23, 1, 0.32, 1] as const;
const TRAVEL = [0.65, 0, 0.35, 1] as const;

/**
 * Plays animations and waits on timers for one run of a loop, and stops all of
 * them at once when the run is replaced. Finished animations drop out of the
 * set, so a loop that runs for minutes holds only the live ones.
 */
function runner() {
  let stopped = false;
  const runs = new Set<{ stop: () => void }>();
  const timers = new Set<number>();
  const play = ((...args: Parameters<typeof animate>) => {
    const run = animate(...args);
    runs.add(run);
    run.then(() => runs.delete(run));
    return run;
  }) as typeof animate;
  const wait = (ms: number) =>
    new Promise<void>((done) => {
      const id = window.setTimeout(() => {
        timers.delete(id);
        done();
      }, ms);
      timers.add(id);
    });
  return {
    play,
    wait,
    live: () => !stopped,
    stop: () => {
      stopped = true;
      for (const run of runs) run.stop();
      for (const id of timers) window.clearTimeout(id);
    },
  };
}

/* ----------------------------------------------------------- the picture */

interface Swipes {
  page: MotionValue<string>;
  finger: MotionValue<string>;
  fingerOpacity: MotionValue<number>;
  alarm: MotionValue<number>;
}

/**
 * Four swipes up, then the page glides back to the top and it starts again.
 * `stuck` keeps the page still and flashes red on each swipe. `bounce` lets
 * the last swipe pull past the end and spring back, the macOS rubber band.
 * Restarts from the top whenever either flips, so the change is seen at once.
 * Reduced motion shows where the page ends up and runs nothing.
 */
function useSwipes(
  ref: RefObject<HTMLElement | null>,
  stuck: boolean,
  bounce: boolean,
): Swipes {
  const inView = useInView(ref, { amount: 0.35 });
  const still = useReducedMotion() ?? false;
  const page = useMotionValue(0);
  const fingerY = useMotionValue(0);
  const fingerOpacity = useMotionValue(0);
  const alarm = useMotionValue(0);

  useEffect(() => {
    page.jump(0);
    fingerY.jump(0);
    fingerOpacity.jump(0);
    alarm.jump(0);
    if (still) {
      page.jump(stuck ? 0 : -STEP * 2);
      return;
    }
    if (!inView) return;

    const { play, wait, live, stop } = runner();
    const loop = async () => {
      while (live()) {
        for (let i = 1; i <= SWIPES && live(); i++) {
          fingerY.jump(0);
          play(fingerOpacity, [0, 1, 1, 0], {
            duration: 0.7,
            times: [0, 0.15, 0.75, 1],
          });
          play(fingerY, -6, { duration: 0.55, ease: [0.4, 0, 0.2, 1] });
          await wait(180);
          if (stuck) {
            play(alarm, [0, 1, 0], { duration: 0.7, times: [0, 0.3, 1] });
          } else if (i === SWIPES && bounce) {
            play(page, [page.get(), -(END + STRETCH), -END], {
              duration: 0.9,
              times: [0, 0.45, 1],
              ease: "easeOut",
            });
          } else {
            play(page, -i * STEP, { duration: 0.7, ease: GLIDE });
          }
          await wait(1100);
        }
        await wait(500);
        if (!stuck) {
          play(page, 0, { duration: 0.6, ease: TRAVEL });
          await wait(1100);
        }
      }
    };
    void loop();
    return stop;
  }, [inView, stuck, bounce, still, page, fingerY, fingerOpacity, alarm]);

  return {
    page: useTransform(page, (v) => `translateY(${v}%)`),
    finger: useTransform(fingerY, (v) => `translateY(${v}cqw)`),
    fingerOpacity,
    alarm,
  };
}

/** What the page holds: blocks that differ, so travel reads as travel. */
const SECTIONS = [
  { title: "w-[46%]", lines: ["w-full", "w-[82%]"], cards: false },
  { title: "w-[34%]", lines: ["w-[90%]", "w-[70%]"], cards: true },
  { title: "w-[52%]", lines: ["w-full", "w-[60%]"], cards: false },
  { title: "w-[40%]", lines: ["w-[86%]", "w-[74%]"], cards: true },
  { title: "w-[30%]", lines: ["w-full", "w-[66%]"], cards: false },
];

/**
 * The page itself, three screens tall, and the red wash a stuck swipe paints.
 * `corners` is the frame's bottom radius: the frame clips the wash, so a square
 * wash loses its ring at the rounded corners.
 */
function Page({
  swipes,
  dense,
  corners,
}: {
  swipes: Swipes;
  dense?: boolean;
  corners: string;
}) {
  return (
    <div className="relative flex-1 overflow-hidden">
      <motion.div
        className={cn(
          "absolute inset-x-0 top-0 flex h-[300%] flex-col justify-between",
          dense ? "px-[1.6cqw] py-[1.6cqw]" : "px-[3cqw] py-[2.6cqw]",
        )}
        style={{ transform: swipes.page }}
      >
        {SECTIONS.map((s) => (
          <div
            key={s.title}
            className={cn(
              "flex flex-col",
              dense ? "gap-[0.8cqw]" : "gap-[1.2cqw]",
            )}
          >
            <span
              className={cn("h-[1.6cqw] rounded-full bg-fill-active", s.title)}
            />
            {s.lines.map((w) => (
              <span
                key={w}
                className={cn("h-[1cqw] rounded-full bg-fill-hover", w)}
              />
            ))}
            {s.cards ? (
              <div className="mt-[0.6cqw] grid grid-cols-3 gap-[1cqw]">
                <span className="h-[6cqw] rounded-[0.8cqw] bg-fill" />
                <span className="h-[6cqw] rounded-[0.8cqw] bg-fill" />
                <span className="h-[6cqw] rounded-[0.8cqw] bg-fill" />
              </div>
            ) : (
              <span className="mt-[0.6cqw] h-[9cqw] rounded-[0.9cqw] bg-fill" />
            )}
          </div>
        ))}
      </motion.div>
      <motion.span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 bg-danger/10 ring-2 ring-danger ring-inset",
          corners,
        )}
        style={{ opacity: swipes.alarm }}
      />
    </div>
  );
}

/** Two fingertips, swiping up. */
function Fingers({ swipes, one }: { swipes: Swipes; one?: boolean }) {
  return (
    <motion.div
      aria-hidden="true"
      className="flex gap-[1.2cqw]"
      style={{ transform: swipes.finger, opacity: swipes.fingerOpacity }}
    >
      <span className="size-[2.2cqw] rounded-full bg-text-muted/50" />
      {!one && <span className="size-[2.2cqw] rounded-full bg-text-muted/50" />}
    </motion.div>
  );
}

/**
 * A browser window over a trackpad, filling whatever positioned box it is put
 * in. `wide` is the full stage, where the window is centred at about half.
 */
function Mac({
  stuck,
  bounce,
  wide = true,
}: {
  stuck: boolean;
  bounce: boolean;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const swipes = useSwipes(ref, stuck, bounce);
  return (
    <div ref={ref} className="absolute inset-0">
      <div
        className={cn(
          "absolute top-[7%] flex h-[62%] flex-col overflow-hidden rounded-[1.4cqw] bg-bg shadow-[0_1px_2px_rgb(0_0_0/0.06),0_16px_40px_-20px_rgb(0_0_0/0.3)] ring-1 ring-stroke",
          wide ? "left-[11%] w-[78%] sm:left-[22%] sm:w-[56%]" : "inset-x-[6%]",
        )}
      >
        <div className="flex h-[4.5cqw] shrink-0 items-center gap-[0.8cqw] border-stroke border-b px-[1.6cqw] sm:h-[4cqw]">
          <span className="size-[1.1cqw] rounded-full bg-stroke-strong" />
          <span className="size-[1.1cqw] rounded-full bg-stroke-strong" />
          <span className="size-[1.1cqw] rounded-full bg-stroke-strong" />
          <span className="mx-[4cqw] h-[2cqw] flex-1 rounded-full bg-fill" />
        </div>
        <Page swipes={swipes} dense={!wide} corners="rounded-b-[1.4cqw]" />
      </div>
      <div
        className={cn(
          "absolute bottom-[7%] h-[20%] rounded-[1.2cqw] bg-bg ring-1 ring-stroke",
          wide
            ? "left-[33%] w-[34%] sm:left-[38%] sm:w-[24%]"
            : "left-[28%] w-[44%]",
        )}
      >
        <div className="absolute top-[58%] left-1/2 -translate-x-1/2">
          <Fingers swipes={swipes} />
        </div>
      </div>
    </div>
  );
}

/** A phone, a finger on its screen, filling the height of its box. */
function Phone({ stuck, bounce }: { stuck: boolean; bounce: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const swipes = useSwipes(ref, stuck, bounce);
  return (
    <div ref={ref} className="absolute inset-0 grid place-items-center">
      <div className="flex aspect-[9/18] h-[84%] flex-col rounded-[3cqw] bg-inverse-bg p-[0.7cqw] shadow-[0_1px_2px_rgb(0_0_0/0.12),0_12px_32px_-16px_rgb(0_0_0/0.35)]">
        <div className="relative flex flex-1 flex-col overflow-hidden rounded-[2.4cqw] bg-bg pt-[2.6cqw]">
          <Page swipes={swipes} dense corners="rounded-b-[2.4cqw]" />
          <div className="absolute bottom-[22%] left-1/2 -translate-x-1/2">
            <Fingers swipes={swipes} one />
          </div>
        </div>
      </div>
    </div>
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

/** The row under a stage: the caption, and the figure's controls. */
function Footer({
  bad,
  caption,
  children,
}: {
  bad: boolean;
  caption: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
      <Caption bad={bad}>{caption}</Caption>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

/** The site's mode pill, whose label is the current state. */
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

/** One thing on the page, on or off. Filled while it is on. */
function Switch({
  on,
  onChange,
  disabled,
  children,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn(PILL, on && PILL_ON)}
    >
      <span className="whitespace-nowrap">{children}</span>
    </button>
  );
}

/* ---------------------------------------------------------------- scroll */

export function Scroll() {
  const [fixed, setFixed] = useState(false);
  return (
    <figure
      aria-label="A browser window over a trackpad. Two fingers swipe up again and again. Before the fix, the page in the window does not move and the window flashes red. After it, the page scrolls and bounces at the end."
      className={BREAKOUT}
    >
      <div className={cn(STAGE, "aspect-[4/3] sm:aspect-[16/10]")}>
        <Mac stuck={!fixed} bounce />
      </div>
      <Footer
        bad={!fixed}
        caption={
          fixed
            ? "The page scrolls, and bounces at the end like any Mac page."
            : "You swipe, and the page does not move."
        }
      >
        <FixToggle fixed={fixed} onChange={setFixed} />
      </Footer>
    </figure>
  );
}

/* ------------------------------------------------------------------ pair */

export function Pair() {
  const [noBounce, setNoBounce] = useState(true);
  const [listener, setListener] = useState(true);
  const stuck = noBounce && listener;

  const caption = stuck
    ? "Both are on, so Safari ignores the swipe."
    : noBounce
      ? "It scrolls, and stops dead at the end."
      : listener
        ? "It scrolls and bounces. The listener alone is fine."
        : "It scrolls and bounces.";

  return (
    <figure
      aria-label="The same window, with two switches: no bounce on the page, and a wheel listener that can cancel. With both on, the page does not move. With either one off, it scrolls."
      className={BREAKOUT}
    >
      <div className={cn(STAGE, "aspect-[4/3] sm:aspect-[16/10]")}>
        <Mac stuck={stuck} bounce={!noBounce} />
      </div>
      <Footer bad={stuck} caption={caption}>
        <Switch on={noBounce} onChange={setNoBounce}>
          no bounce on the page
        </Switch>
        <Switch on={listener} onChange={setListener}>
          a wheel listener that can cancel
        </Switch>
      </Footer>
    </figure>
  );
}

/* ----------------------------------------------------------------- paths */

/** Where the three stops sit on the stage, in % of its width and height. */
const AT = {
  input: { x: 14, y: 74 },
  script: { x: 50, y: 24 },
  scroll: { x: 86, y: 74 },
};

type Input = "trackpad" | "touch";
type Outcome = "scrolls" | "dropped";

/**
 * What a swipe does on this page as shipped, with the no-bounce rule on.
 * Touch never fires a wheel event, so the wheel listener is never involved.
 */
function route(input: Input, passive: boolean) {
  if (input === "touch")
    return { ask: false, tell: false, outcome: "scrolls" as Outcome };
  if (passive) return { ask: false, tell: true, outcome: "scrolls" as Outcome };
  return { ask: true, tell: false, outcome: "dropped" as Outcome };
}

/** One stop on the diagram: an icon tile and the line under it. */
function Stop({
  at,
  icon,
  label,
  note,
  tone,
  pulse,
}: {
  at: { x: number; y: number };
  icon: ReactNode;
  label: string;
  note: string;
  tone: "idle" | "on" | "bad";
  pulse: MotionValue<number>;
}) {
  return (
    <div
      className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2"
      style={{ left: `${at.x}%`, top: `${at.y}%` }}
    >
      <div className="relative grid size-12 place-items-center rounded-xl bg-bg ring-1 ring-stroke sm:size-14">
        <motion.span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute -inset-px rounded-xl ring-2",
            tone === "bad" ? "bg-danger/10 ring-danger" : "ring-text-primary",
          )}
          style={{ opacity: pulse }}
        />
        {icon}
      </div>
      <div className="flex flex-col items-center whitespace-nowrap rounded-md bg-fill px-1.5 py-0.5 leading-tight">
        <span className="text-meta text-text-primary">{label}</span>
        <span
          className={cn(
            "text-meta transition-colors duration-200",
            tone === "bad"
              ? "text-danger"
              : tone === "on"
                ? "text-text-secondary"
                : "text-text-muted",
          )}
        >
          {note}
        </span>
      </div>
    </div>
  );
}

export function Paths() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const still = useReducedMotion() ?? false;
  const [input, setInput] = useState<Input>("trackpad");
  const [passive, setPassive] = useState(false);
  const { ask, tell, outcome } = route(input, passive);

  const x = useMotionValue(AT.input.x);
  const y = useMotionValue(AT.input.y);
  const dot = useMotionValue(0);
  const gx = useMotionValue(AT.input.x);
  const gy = useMotionValue(AT.input.y);
  const ghost = useMotionValue(0);
  const scriptPulse = useMotionValue(0);
  const scrollPulse = useMotionValue(0);
  const left = useTransform(x, (v) => `${v}%`);
  const top = useTransform(y, (v) => `${v}%`);
  const ghostLeft = useTransform(gx, (v) => `${v}%`);
  const ghostTop = useTransform(gy, (v) => `${v}%`);

  useEffect(() => {
    for (const v of [dot, ghost, scriptPulse, scrollPulse]) v.jump(0);
    x.jump(AT.input.x);
    y.jump(AT.input.y);
    if (still || !inView) return;

    const { play, wait, live, stop } = runner();
    const go = (to: { x: number; y: number }, s: number) => {
      play(x, to.x, { duration: s, ease: TRAVEL });
      return play(y, to.y, { duration: s, ease: TRAVEL });
    };
    const loop = async () => {
      while (live()) {
        x.jump(AT.input.x);
        y.jump(AT.input.y);
        gx.jump(AT.input.x);
        gy.jump(AT.input.y);
        play(dot, 1, { duration: 0.2 });
        await wait(300);
        if (ask) {
          // The browser has to wait for the page's answer before it moves.
          await go(AT.script, 0.7);
          play(scriptPulse, [0, 1, 0], { duration: 0.9 });
          await wait(900);
          await go(AT.scroll, 0.7);
        } else {
          if (tell) {
            // A passive listener hears about it, but nobody waits for it.
            play(ghost, [0, 0.5, 0.5, 0], {
              duration: 0.8,
              times: [0, 0.2, 0.8, 1],
            });
            play(gx, AT.script.x, { duration: 0.7, ease: TRAVEL });
            play(gy, AT.script.y, { duration: 0.7, ease: TRAVEL });
          }
          await go(AT.scroll, 0.9);
        }
        play(scrollPulse, [0, 1, 0], { duration: 0.9 });
        play(dot, 0, { duration: 0.3, delay: 0.2 });
        await wait(1500);
      }
    };
    void loop();
    return stop;
  }, [
    inView,
    still,
    ask,
    tell,
    x,
    y,
    dot,
    gx,
    gy,
    ghost,
    scriptPulse,
    scrollPulse,
  ]);

  const bad = outcome === "dropped";
  const caption =
    input === "touch"
      ? "A touch swipe fires no wheel event, so the listener never hears about it."
      : passive
        ? "A passive listener is only told. The page scrolls without waiting."
        : "Safari waits for the listener, which cancels nothing, then drops the scroll anyway.";

  // Straight along the bottom, or up through the page's script.
  const direct = `M ${AT.input.x} ${AT.input.y} L ${AT.scroll.x} ${AT.scroll.y}`;
  const via = `M ${AT.input.x} ${AT.input.y} L ${AT.script.x} ${AT.script.y} L ${AT.scroll.x} ${AT.scroll.y}`;

  return (
    <figure
      ref={ref}
      aria-label="A diagram of a swipe travelling from the input, past the page's script, to the scroll. With a trackpad and a listener that can cancel, the swipe stops at the script and waits, then reaches the scroll and is dropped. With a passive listener it goes straight to the scroll. With touch, no wheel event fires and it goes straight to the scroll."
      className={BREAKOUT}
    >
      <div className={cn(STAGE, "aspect-[4/3] sm:aspect-[16/8]")}>
        <svg
          aria-hidden="true"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 size-full"
        >
          <path
            d={via}
            fill="none"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            vectorEffect="non-scaling-stroke"
            className={cn(
              "transition-colors duration-200",
              ask ? "stroke-text-muted" : "stroke-stroke-strong",
            )}
          />
          <path
            d={direct}
            fill="none"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            vectorEffect="non-scaling-stroke"
            className={cn(
              "transition-colors duration-200",
              ask ? "stroke-stroke-strong" : "stroke-text-muted",
            )}
          />
        </svg>
        <Stop
          at={AT.input}
          icon={
            <HandIcon
              aria-hidden="true"
              className="size-5 text-text-secondary"
            />
          }
          label={input === "touch" ? "touch" : "trackpad"}
          note={input === "touch" ? "touch events" : "wheel event"}
          tone="on"
          pulse={dot}
        />
        <Stop
          at={AT.script}
          icon={
            <CodeIcon
              aria-hidden="true"
              className="size-5 text-text-secondary"
            />
          }
          label="wheel listener"
          note={
            ask
              ? "asked, waits"
              : tell
                ? "told, not waited for"
                : "never hears it"
          }
          tone={ask || tell ? "on" : "idle"}
          pulse={scriptPulse}
        />
        <Stop
          at={AT.scroll}
          icon={
            <ArrowDownIcon
              aria-hidden="true"
              className={cn(
                "size-5 transition-colors duration-200",
                bad ? "text-danger" : "text-text-secondary",
              )}
            />
          }
          label="scroll"
          note={bad ? "dropped" : "page moves"}
          tone={bad ? "bad" : "on"}
          pulse={scrollPulse}
        />
        {/* Drawn last, so the swipe passes over the tiles rather than under */}
        <motion.span
          aria-hidden="true"
          className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-text-muted"
          style={{ left: ghostLeft, top: ghostTop, opacity: ghost }}
        />
        <motion.span
          aria-hidden="true"
          className={cn(
            "absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors duration-200",
            bad ? "bg-danger" : "bg-text-primary",
          )}
          style={{ left, top, opacity: dot }}
        />
      </div>
      <Footer bad={bad} caption={caption}>
        <Switch
          on={input === "touch"}
          onChange={(on) => setInput(on ? "touch" : "trackpad")}
        >
          {input === "touch" ? "touch" : "trackpad"}
        </Switch>
        <Switch on={passive} disabled={input === "touch"} onChange={setPassive}>
          {passive ? "passive listener" : "listener can cancel"}
        </Switch>
      </Footer>
    </figure>
  );
}

/* ---------------------------------------------------------------- bisect */

const ISLANDS = ["hero", "client row", "bento", "closing"] as const;
type Island = (typeof ISLANDS)[number];

export function Bisect() {
  const [js, setJs] = useState(true);
  const [off, setOff] = useState<ReadonlySet<Island>>(new Set());
  const heroOn = js && !off.has("hero");
  const stuck = heroOn;

  const toggle = (island: Island) =>
    setOff((prev) => {
      const next = new Set(prev);
      if (next.has(island)) next.delete(island);
      else next.add(island);
      return next;
    });

  const caption = !js
    ? "It scrolls with JavaScript off, so a script is involved."
    : !heroOn
      ? "It scrolls with only the hero blocked. The hero holds the walkthrough."
      : off.size > 0
        ? "Still stuck. That script was not it."
        : "Stuck. Turn things off until it scrolls.";

  return (
    <figure
      aria-label="The window again, with switches for JavaScript and for each of the page's four scripts. The page stays stuck until JavaScript is off or the hero's script is blocked."
      className={BREAKOUT}
    >
      <div className={cn(STAGE, "aspect-[4/3] sm:aspect-[16/10]")}>
        <Mac stuck={stuck} bounce={false} />
      </div>
      <Footer bad={stuck} caption={caption}>
        <Switch on={js} onChange={setJs}>
          javascript
        </Switch>
        {ISLANDS.map((island) => (
          <Switch
            key={island}
            on={!off.has(island)}
            disabled={!js}
            onChange={() => toggle(island)}
          >
            {island}
          </Switch>
        ))}
      </Footer>
    </figure>
  );
}

/* ---------------------------------------------------------------- inputs */

export function Inputs() {
  const [fixed, setFixed] = useState(false);
  return (
    <figure
      aria-label="A phone and a Mac side by side, both being swiped. On the phone the page scrolls and stops dead at the end, before and after the fix. On the Mac, the page is stuck before the fix, and after it the page scrolls and bounces."
      className={BREAKOUT}
    >
      <div className={cn(STAGE, "flex aspect-[4/3] sm:aspect-[16/9]")}>
        <div className="relative w-[34%] border-stroke border-r border-dashed">
          <Phone stuck={false} bounce={false} />
          <span className="absolute bottom-[3%] left-1/2 -translate-x-1/2 whitespace-nowrap text-meta text-text-muted">
            touch: no bounce kept
          </span>
        </div>
        <div className="relative flex-1">
          <Mac stuck={!fixed} bounce wide={false} />
        </div>
      </div>
      <Footer
        bad={!fixed}
        caption={
          fixed
            ? "The query matches only the Mac, so only the Mac gets its bounce back."
            : "The phone scrolls either way. The Mac is stuck."
        }
      >
        <FixToggle fixed={fixed} onChange={setFixed} />
      </Footer>
    </figure>
  );
}

/* ----------------------------------------------------------------- query */

type Shape = "phone" | "tablet" | "laptop" | "desktop";

/** What each device answers to the fix's two media features. */
const DEVICES: { shape: Shape; hover: boolean; fine: boolean }[] = [
  { shape: "phone", hover: false, fine: false },
  { shape: "tablet", hover: false, fine: false },
  { shape: "laptop", hover: true, fine: true },
  { shape: "desktop", hover: true, fine: true },
];

/** An outline of the device, sat on a shared baseline. */
function Outline({ shape, on }: { shape: Shape; on: boolean }) {
  const edge = cn(
    "ring-2 ring-inset transition-colors duration-200",
    on ? "ring-text-primary" : "ring-text-muted",
  );
  const fill = on ? "bg-text-primary" : "bg-text-muted";
  return (
    <div className="flex h-16 flex-col items-center justify-end">
      {shape === "phone" && (
        <span className={cn("h-14 w-7 rounded-md", edge)} />
      )}
      {shape === "tablet" && (
        <span className={cn("h-12 w-16 rounded-md", edge)} />
      )}
      {shape === "laptop" && (
        <>
          <span className={cn("h-11 w-18 rounded-t-md", edge)} />
          <span className={cn("h-1.5 w-22 rounded-b-sm", fill)} />
        </>
      )}
      {shape === "desktop" && (
        <>
          <span className={cn("h-11 w-20 rounded-sm", edge)} />
          <span className={cn("h-2 w-1.5", fill)} />
          <span className={cn("h-1 w-8 rounded-full", fill)} />
        </>
      )}
    </div>
  );
}

/** One media feature and whether the device matches it. */
function Feature({ label, match }: { label: string; match: boolean }) {
  const Icon = match ? CheckIcon : XIcon;
  return (
    <span
      className={cn(
        "flex items-center gap-1.5 text-meta",
        match ? "text-text-primary" : "text-text-muted",
      )}
    >
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      {label}
    </span>
  );
}

export function Query() {
  return (
    <figure
      aria-label="Four devices and the fix's media query. A phone and a tablet cannot hover and have a coarse pointer, so the query does not match and the page keeps no bounce. A laptop with a trackpad and a desktop with a mouse match both features, so the page gets the browser default back."
      className={BREAKOUT}
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {DEVICES.map((d) => {
          const match = d.hover && d.fine;
          return (
            <div
              key={d.shape}
              className="flex flex-col items-center gap-4 rounded-xl bg-fill px-4 py-6 ring-1 ring-stroke ring-inset"
            >
              <Outline shape={d.shape} on={match} />
              <span className="text-body text-text-primary">{d.shape}</span>
              <div className="flex flex-col gap-1.5">
                <Feature label="can hover" match={d.hover} />
                <Feature label="fine pointer" match={d.fine} />
              </div>
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-meta",
                  match
                    ? "bg-text-primary text-bg"
                    : "bg-bg text-text-secondary ring-1 ring-stroke",
                )}
              >
                {match ? "default bounce" : "no bounce"}
              </span>
            </div>
          );
        })}
      </div>
      <Caption bad={false}>
        Only a pointer that can hover and is precise gets the default back.
      </Caption>
    </figure>
  );
}
