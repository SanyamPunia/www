"use client";

import {
  type AnimationPlaybackControls,
  animate,
  useInView,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import {
  Fragment,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { TextMorph } from "torph/react";
import { CaretLeftIcon, CaretRightIcon } from "@/components/icons";
import { FOCUS } from "@/components/lab/controls";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { type Cloud, clear, draw, sample } from "./assemble";
import { COPY, LAYOUT, type Nodes, PATTERNS, prepare, reset } from "./patterns";

/** the reference, which is where a reader should start */
const START = PATTERNS.findIndex((p) => p.id === "wipe");

/** `book-opening`'s morph, so the lab's labels change on the site's one curve */
const MORPH = {
  duration: 200,
  ease: "cubic-bezier(0.32, 0.72, 0, 1)",
} as const;

/**
 * The copy, split once into lines, words and characters, with a node for each
 * pattern to write to. Memoised with a stable prop, so it renders once and
 * React never touches the text a pattern rewrites.
 */
const Copy = memo(function Copy({ nodes }: { nodes: React.RefObject<Nodes> }) {
  return (
    <div
      aria-hidden="true"
      ref={(el) => {
        nodes.current.block = el;
      }}
      // kerning and ligatures off, so splitting a word into characters moves
      // nothing: an inline-block ends a shaping run, and a kerned pair across
      // two of them sets differently from the same pair in one
      className="relative flex flex-col items-center gap-[0.14em] font-medium leading-[1.3] tracking-[-0.01em] [font-kerning:none] [font-variant-ligatures:none]"
      style={{ fontSize: "max(0.8rem, 5.4cqw)" }}
    >
      {LAYOUT.map((words, l) => (
        <div
          key={words.map((w) => w.text).join(" ")}
          ref={(el) => {
            if (el) nodes.current.wraps[l] = el;
          }}
          className="relative"
        >
          <div
            ref={(el) => {
              if (el) nodes.current.lines[l] = el;
            }}
            className="relative whitespace-nowrap"
          >
            {words.map((word, j) => (
              <Fragment key={word.index}>
                {j > 0 && " "}
                <span
                  ref={(el) => {
                    if (el) nodes.current.words[word.index] = el;
                  }}
                  className={cn(
                    "relative inline-block",
                    word.hl ? "text-text-primary" : "text-text-secondary",
                  )}
                >
                  <span
                    ref={(el) => {
                      if (el) nodes.current.inks[word.index] = el;
                    }}
                    className="relative inline-block"
                  >
                    {word.letters.map((letter) => (
                      <span
                        key={letter.index}
                        ref={(el) => {
                          if (el) nodes.current.chars[letter.index] = el;
                        }}
                        className="inline-block"
                      >
                        {letter.ch}
                      </span>
                    ))}
                  </span>
                  <span
                    ref={(el) => {
                      if (el) nodes.current.bars[word.index] = el;
                    }}
                    className={cn(
                      "-inset-x-[0.05em] pointer-events-none absolute inset-y-[0.1em] hidden rounded-[0.1em]",
                      word.hl ? "bg-text-primary" : "bg-stroke-strong",
                    )}
                  />
                </span>
              </Fragment>
            ))}
          </div>
          <span
            ref={(el) => {
              if (el) nodes.current.rects[l] = el;
            }}
            className="pointer-events-none absolute inset-0 hidden origin-left rounded-[0.09em] bg-fill-active"
          />
        </div>
      ))}
    </div>
  );
});

export default function TextReveal() {
  const [index, setIndex] = useState(START);
  const pattern = PATTERNS[index] ?? PATTERNS[0];
  const reduced = useReducedMotion();

  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const nodes = useRef<Nodes>({
    block: null,
    wraps: [],
    rects: [],
    lines: [],
    words: [],
    inks: [],
    bars: [],
    chars: [],
    widths: [],
  });

  const t = useMotionValue(0);
  const current = useRef(pattern);
  const cloud = useRef<Cloud | null>(null);
  const inks = useRef<[string, string]>(["#6b6b6b", "#1a1a1a"]);
  const run = useRef<AnimationPlaybackControls | null>(null);
  const started = useRef(false);
  const inView = useInView(stage, { once: true, amount: 0.5 });

  /** one frame of the current pattern */
  const paint = useCallback((time: number) => {
    const p = current.current;
    p.paint(time, nodes.current);
    const ctx = canvas.current?.getContext("2d");
    if (ctx && p.id === "assemble" && cloud.current)
      draw(ctx, cloud.current, time, inks.current);
  }, []);

  useEffect(() => t.on("change", paint), [t, paint]);

  /**
   * Put the stage into the current pattern from nothing: every style off, the
   * pattern's own setup on, and the dots resampled if it draws them. The rects
   * the dots are read from are only true with every other pattern's styles
   * gone, which is why this resets first.
   */
  const ready = useCallback(() => {
    const n = nodes.current;
    const p = current.current;
    reset(n);
    const ctx = canvas.current?.getContext("2d");
    if (ctx) clear(ctx);
    cloud.current =
      p.id === "assemble" && stage.current
        ? sample(stage.current, n.chars)
        : null;
    prepare(p, n);
    paint(t.get());
  }, [paint, t]);

  const play = useCallback(() => {
    run.current?.stop();
    const d = current.current.duration;
    if (reduced) {
      t.set(d);
      return;
    }
    t.jump(0);
    paint(0);
    run.current = animate(t, d, { duration: d, ease: "linear" });
  }, [paint, reduced, t]);

  /**
   * Every character's resting advance, in ems, measured once the face is in.
   * In ems so a resize leaves it right, and measured with every style off, so
   * a pattern caught mid-swell cannot be what gets written down.
   */
  useLayoutEffect(() => {
    let live = true;
    const measure = () => {
      const n = nodes.current;
      if (!n.block) return;
      reset(n);
      const size = Number.parseFloat(getComputedStyle(n.block).fontSize);
      n.widths = n.chars.map((el) => el.getBoundingClientRect().width / size);
      const root = getComputedStyle(document.documentElement);
      inks.current = [
        root.getPropertyValue("--color-text-secondary").trim() || "#6b6b6b",
        root.getPropertyValue("--color-text-primary").trim() || "#1a1a1a",
      ];
      ready();
    };
    measure();
    document.fonts.ready.then(() => {
      if (live) measure();
    });
    return () => {
      live = false;
    };
  }, [ready]);

  // a new pattern starts from its own first frame, and plays once the demo is seen
  useLayoutEffect(() => {
    run.current?.stop();
    current.current = pattern;
    t.jump(0);
    ready();
    if (started.current) play();
  }, [pattern, play, ready, t]);

  useEffect(() => {
    if (!inView || started.current) return;
    started.current = true;
    play();
  }, [inView, play]);

  // the canvas is backed at the device's ratio, and a resize resamples the dots
  useEffect(() => {
    const el = stage.current;
    const cv = canvas.current;
    if (!el || !cv) return;
    const observer = new ResizeObserver(() => {
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(el.clientWidth * ratio);
      cv.height = Math.round(el.clientHeight * ratio);
      if (current.current.id === "assemble") ready();
      else paint(t.get());
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [paint, ready, t]);

  useEffect(() => () => run.current?.stop(), []);

  const step = (by: number) =>
    setIndex((i) => (i + by + PATTERNS.length) % PATTERNS.length);
  const number = String(index + 1).padStart(2, "0");

  const chevron = cn(
    "flex size-7 cursor-pointer items-center justify-center rounded-full text-text-muted transition-colors duration-200 hover:bg-bg hover:text-text-primary active:bg-fill-hover",
    FOCUS,
    "focus-visible:ring-offset-fill",
  );

  return (
    <div
      ref={stage}
      className="@container relative grid aspect-8/5 min-h-56 w-full select-none place-items-center overflow-hidden rounded-[inherit] bg-fill px-6 ring-1 ring-stroke ring-inset"
    >
      <Copy nodes={nodes} />
      <canvas
        ref={canvas}
        className="pointer-events-none absolute inset-0 size-full"
      />
      <p className="sr-only">{COPY}</p>
      <p role="status" aria-live="polite" className="sr-only">
        {`Pattern ${index + 1} of ${PATTERNS.length}, ${pattern.id}`}
      </p>

      {/*
       * The pattern picker sits in the stage under the copy, quiet until it is
       * pointed at: two chevrons and the current pattern between them, which is
       * the site's mode selector with a way back as well as forward. The name
       * replays its own pattern, since pressing what is playing is the obvious
       * place to ask for it again.
       */}
      <TooltipProvider>
        <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-1">
          <Tooltip label="Previous pattern" side="bottom">
            <button
              type="button"
              aria-label="Previous pattern"
              onClick={() => step(-1)}
              className={chevron}
            >
              <CaretLeftIcon aria-hidden="true" className="size-3" />
            </button>
          </Tooltip>
          <Tooltip label="Replay" side="bottom">
            <button
              type="button"
              aria-label="Replay the reveal"
              onClick={play}
              className={cn(
                "flex h-7 min-w-24 cursor-pointer items-center justify-center gap-1.5 rounded-full px-2.5 text-meta text-text-secondary transition-colors duration-200 hover:bg-bg hover:text-text-primary active:bg-fill-hover",
                FOCUS,
                "focus-visible:ring-offset-fill",
              )}
            >
              <span className="font-mono text-text-muted tabular-nums">
                <TextMorph duration={MORPH.duration} ease={MORPH.ease}>
                  {number}
                </TextMorph>
              </span>
              <TextMorph duration={MORPH.duration} ease={MORPH.ease}>
                {pattern.id}
              </TextMorph>
            </button>
          </Tooltip>
          <Tooltip label="Next pattern" side="bottom">
            <button
              type="button"
              aria-label="Next pattern"
              onClick={() => step(1)}
              className={chevron}
            >
              <CaretRightIcon aria-hidden="true" className="size-3" />
            </button>
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>
  );
}
