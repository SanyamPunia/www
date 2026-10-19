"use client";

import { useReducedMotion } from "motion/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { TextMorph } from "torph/react";
import { approach, lerp } from "@/lib/lerp";
import { CALM, keyframes, paint, STOPS, sample } from "./depth";
import { CHAPTER, PARAGRAPHS, TITLE, WORDS, WPM } from "./story";

/*
 * A page of a story with depth. Every line's look comes from where that line
 * sits on the page: it arrives faint at the foot, sharpens through the reading
 * band, and shrinks, blurs and fades as it rises out at the head. `depth.ts` is
 * the curve and `story.ts` the words. This file splits the paragraphs into the
 * lines the browser actually draws, and keeps the rail and the time left.
 *
 * **The depth runs on the compositor where it can.** Each line is a CSS
 * animation on a view timeline, so scrolling costs nothing on the main thread
 * and cannot stutter. A browser without scroll timelines gets the same curve
 * from `sample`, written on scroll.
 */

/** the reading band, as a share of the page's height from the top */
const BAND = 0.5;

/*
 * The page's type, shared by the lines and the copy they are measured in, so a
 * split can never be taken at a different size from the one it is drawn at.
 * 16px with an open leading, off the type scale on purpose: this is a page of a
 * book, the standing `foil-card` gives type printed on a drawn object.
 */
const TEXT = "text-[1rem] leading-[1.75]";

/*
 * The wheel's glide, as a time constant in seconds. A wheel sets where the page
 * is heading and the page eases there, the way Lenis does, which is its 0.1 of
 * the gap per frame at 60Hz held to one speed on every display.
 */
const GLIDE = 0.16;

const STYLE = [
  keyframes("rd-depth", STOPS),
  keyframes("rd-calm", CALM),
  ".rd-line{transform-origin:50% 50%}",
  "@supports (animation-timeline: view()){.rd-line{animation:rd-depth linear both;animation-timeline:view();animation-range:cover 0% cover 100%}}",
  "@media (prefers-reduced-motion: reduce){.rd-line{animation-name:rd-calm}}",
].join("");

/** what the readout says, in four steps rather than a ticking count */
function remaining(progress: number): string {
  const seconds = (WORDS * (1 - progress) * 60) / WPM;
  if (progress >= 0.995) return "The end";
  if (seconds > 45) return "1 min left";
  if (seconds > 15) return "Under a minute";
  return "Almost there";
}

/**
 * Split a paragraph into the lines the browser breaks it into, by setting its
 * words in a hidden copy at the same width and reading where each word lands.
 * Splitting by sentence or by a character count would show its seams.
 */
function splitLines(el: HTMLElement, text: string): string[] {
  el.textContent = "";
  const words = text.split(" ");
  const spans = words.map((w, i) => {
    const s = document.createElement("span");
    s.textContent = w;
    el.appendChild(s);
    if (i < words.length - 1) el.appendChild(document.createTextNode(" "));
    return s;
  });
  const lines: string[][] = [];
  let top = Number.NaN;
  spans.forEach((s, i) => {
    if (s.offsetTop !== top) {
      lines.push([]);
      top = s.offsetTop;
    }
    lines[lines.length - 1].push(words[i]);
  });
  el.textContent = "";
  return lines.map((l) => l.join(" "));
}

export default function ReadingDepth() {
  const scroller = useRef<HTMLElement>(null);
  const measurer = useRef<HTMLDivElement>(null);
  const marker = useRef<HTMLSpanElement>(null);
  const paragraphs = useRef<(HTMLParagraphElement | null)[]>([]);
  const ticks = useRef<(HTMLButtonElement | null)[]>([]);
  const width = useRef(0);
  const frame = useRef(0);
  const reduceValue = useReducedMotion() ?? false;
  const reduce = useRef(reduceValue);
  reduce.current = reduceValue;

  const [lines, setLines] = useState<string[][] | null>(null);
  const [left, setLeft] = useState(() => remaining(0));
  const leftRef = useRef(left);
  /** a browser that runs scroll timelines, decided once on mount */
  const native = useRef(true);
  /** sends the page gliding to a scroll position, set up by the glide effect */
  const glideTo = useRef<(top: number) => void>(() => {});

  /* ------------------------------------------------------------- the lines */

  const measure = useCallback(() => {
    const m = measurer.current;
    if (!m) return;
    width.current = m.offsetWidth;
    setLines(PARAGRAPHS.map((p) => splitLines(m, p)));
  }, []);

  useLayoutEffect(() => {
    native.current =
      typeof CSS !== "undefined" && CSS.supports("animation-timeline: view()");
    measure();
    const m = measurer.current;
    if (!m) return;
    // a new width rebreaks the lines, so they are split again
    const ro = new ResizeObserver(() => {
      if (m.offsetWidth !== width.current) measure();
    });
    ro.observe(m);
    // the first split may have used the fallback face
    void document.fonts?.ready.then(measure);
    return () => ro.disconnect();
  }, [measure]);

  /* ---------------------------------------------------- the scroll's work */

  /** where a paragraph sits on the rail: the scroll that puts it in the band */
  const targetOf = useCallback((i: number) => {
    const sc = scroller.current;
    const p = paragraphs.current[i];
    if (!sc || !p) return 0;
    return Math.max(0, p.offsetTop - sc.clientHeight * BAND);
  }, []);

  const update = useCallback(() => {
    frame.current = 0;
    const sc = scroller.current;
    if (!sc) return;
    const max = Math.max(1, sc.scrollHeight - sc.clientHeight);
    const progress = Math.min(1, sc.scrollTop / max);

    // the rail's marker and which ticks it has passed, written to the nodes
    const m = marker.current;
    if (m) m.style.top = `${(progress * 100).toFixed(2)}%`;
    ticks.current.forEach((t, i) => {
      if (!t) return;
      const at = Math.min(1, targetOf(i) / max);
      t.style.top = `${(at * 100).toFixed(2)}%`;
      t.dataset.passed = String(at <= progress + 0.005);
    });

    const next = remaining(progress);
    if (next !== leftRef.current) {
      leftRef.current = next;
      setLeft(next);
    }

    // the fallback paints the curve itself, line by line
    if (native.current) return;
    const h = sc.clientHeight;
    const stops = reduce.current ? CALM : STOPS;
    for (const el of sc.querySelectorAll<HTMLElement>(".rd-line")) {
      const top = el.offsetTop - sc.scrollTop;
      const p = (h - top) / (h + el.offsetHeight);
      const v = paint(sample(stops, p));
      el.style.opacity = v.opacity;
      el.style.transform = v.transform;
      el.style.filter = v.filter;
    }
  }, [targetOf]);

  const schedule = useCallback(() => {
    if (!frame.current) frame.current = requestAnimationFrame(update);
  }, [update]);

  // the lines changed, so the rail and the fallback are painted again
  // biome-ignore lint/correctness/useExhaustiveDependencies: `lines` is the trigger
  useLayoutEffect(() => {
    update();
  }, [lines, update]);

  useEffect(() => {
    const f = frame;
    return () => cancelAnimationFrame(f.current);
  }, []);

  /*
   * The glide. The wheel moves a target and one loop eases the page toward it,
   * so a run of notches is one movement rather than a stair. Only the wheel and
   * the rail glide: a thumb, a key or the scrollbar is the browser's own, and
   * any of them landing mid-glide stops it where it is.
   */
  useEffect(() => {
    const sc = scroller.current;
    if (!sc) return;
    let aim = 0;
    // the page's position as a float, since scrollTop rounds to the pixel grid
    let pos = 0;
    let glide = 0;
    let at = 0;
    const max = () => Math.max(0, sc.scrollHeight - sc.clientHeight);
    const stop = () => {
      cancelAnimationFrame(glide);
      glide = 0;
    };
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - at) / 1000);
      at = now;
      pos = lerp(pos, aim, approach(GLIDE, dt));
      if (Math.abs(aim - pos) < 0.5) {
        pos = aim;
        glide = 0;
      } else glide = requestAnimationFrame(tick);
      sc.scrollTop = pos;
    };
    const go = (top: number) => {
      aim = Math.min(max(), Math.max(0, top));
      if (reduce.current) {
        stop();
        sc.scrollTop = pos = aim;
        return;
      }
      if (glide) return;
      pos = sc.scrollTop;
      at = performance.now();
      glide = requestAnimationFrame(tick);
    };
    glideTo.current = go;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || reduce.current) return;
      const unit =
        e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? sc.clientHeight : 1;
      const from = glide ? aim : sc.scrollTop;
      const next = Math.min(max(), Math.max(0, from + e.deltaY * unit));
      // nothing left to scroll this way, so the wheel is not taken
      if (next === from) return;
      e.preventDefault();
      go(next);
    };
    // a scroll the glide did not write is someone else's, so it lets go
    const onScroll = () => {
      if (glide && Math.abs(sc.scrollTop - pos) > 2) stop();
    };
    sc.addEventListener("wheel", onWheel, { passive: false });
    sc.addEventListener("scroll", onScroll, { passive: true });
    sc.addEventListener("touchstart", stop, { passive: true });
    return () => {
      sc.removeEventListener("wheel", onWheel);
      sc.removeEventListener("scroll", onScroll);
      sc.removeEventListener("touchstart", stop);
      stop();
    };
  }, []);

  const goTo = (i: number) => glideTo.current(targetOf(i));

  /* ---------------------------------------------------------------- render */

  return (
    <div className="relative flex h-[30rem] w-full select-none flex-col items-center justify-center gap-4 overflow-hidden rounded-lg bg-fill">
      <style>{STYLE}</style>
      <div
        className="relative h-[25rem] w-[min(30rem,calc(100%-2rem))] overflow-hidden rounded-[1.75rem] bg-bg"
        style={{
          boxShadow:
            "0 1px 2px rgba(0,0,0,0.04), 0 14px 36px -14px rgba(0,0,0,0.16)",
        }}
      >
        {/* the page, which scrolls natively with no visible bar */}
        <section
          ref={scroller}
          aria-label={`${TITLE}, ${CHAPTER}`}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: a scroll region needs focus for the arrow and page keys to scroll it
          tabIndex={0}
          onScroll={schedule}
          className="peer absolute inset-0 overflow-y-auto overscroll-y-contain [scrollbar-width:none] focus-visible:outline-none [&::-webkit-scrollbar]:hidden"
        >
          {/* room above and below, as shares of the page, so the first line
              starts in the reading band and the last one can reach it */}
          <div aria-hidden="true" style={{ height: "38%" }} />
          <header className="pr-10 pl-16">
            <span className="rd-line block text-meta text-text-muted">
              {CHAPTER}
            </span>
            <h3 className="rd-line block pt-1 pb-7 text-[1.25rem] text-text-primary leading-tight">
              {TITLE}
            </h3>
          </header>
          <div className="pr-10 pl-16">
            {PARAGRAPHS.map((text, i) => (
              <p
                key={text.slice(0, 24)}
                ref={(el) => {
                  paragraphs.current[i] = el;
                }}
                className={`mb-6 text-text-primary ${TEXT}`}
              >
                {lines
                  ? lines[i].map((line, j) => (
                      <span
                        // the same line text can occur twice in a paragraph
                        // biome-ignore lint/suspicious/noArrayIndexKey: a line is its position
                        key={j}
                        className="rd-line block whitespace-nowrap"
                      >
                        {line}
                      </span>
                    ))
                  : text}
              </p>
            ))}
          </div>
          <div aria-hidden="true" style={{ height: "46%" }} />
        </section>

        {/* the measuring copy, at the text column's width, never seen */}
        <div
          aria-hidden="true"
          className={`pointer-events-none invisible absolute top-0 right-10 left-16 ${TEXT}`}
        >
          <div ref={measurer} />
        </div>

        {/* the rail: one tick per paragraph, and a marker for where you are.
            A tick is a button, so it can be pressed to go there */}
        <div className="absolute top-12 bottom-12 left-8 w-px bg-stroke">
          {PARAGRAPHS.map((text, i) => (
            <button
              key={text.slice(0, 24)}
              ref={(el) => {
                ticks.current[i] = el;
              }}
              type="button"
              aria-label={`Go to paragraph ${i + 1}`}
              onClick={() => goTo(i)}
              className="group absolute left-1/2 grid size-4 -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-secondary"
            >
              <span className="size-1.5 rounded-full bg-stroke-strong transition-[background-color,scale] duration-200 group-hover:scale-125 group-data-[passed=true]:bg-text-secondary" />
            </button>
          ))}
          <span
            ref={marker}
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 h-4 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-text-primary"
          />
        </div>

        {/* the page's focus ring, on a layer of its own over the text, since
            an inset ring on the scroller paints under its own children */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 ring-2 ring-text-secondary ring-inset transition-opacity duration-150 peer-focus-visible:opacity-100"
        />
      </div>

      {/* the time left, in four steps, under the page rather than on it, so it
          never sits on the line arriving at the foot */}
      <span className="whitespace-nowrap text-meta text-text-muted">
        <TextMorph duration={220} ease="cubic-bezier(0.4, 0, 0.2, 1)">
          {left}
        </TextMorph>
      </span>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-lg ring-1 ring-stroke ring-inset"
      />
    </div>
  );
}
