"use client";

import {
  ArrowCounterClockwiseIcon,
  ArrowRightIcon,
} from "@phosphor-icons/react";
import { useInView, useReducedMotion } from "motion/react";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { caveat } from "@/app/fonts";
import { Pill } from "@/components/lab/controls";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { type Rect, type Shape, type Stroke, strokes } from "./doodle";
import { INK, type Ink, type Mark, NOTES, plain, type Segment } from "./notes";

/*
 * A note that types itself out a letter at a time in a hand, and a pen that goes
 * back over it: once the typing passes the end of a marked run, the pen circles,
 * underlines, strikes or highlights it, and the typing waits for most of that
 * stroke before it carries on.
 *
 * Every character is laid out from the first frame and only its opacity
 * changes, so nothing reflows as the note is written, and every mark can be
 * measured before the first letter appears.
 */

/** how long each mark takes to draw, seconds */
const DRAW: Record<Shape, number> = {
  circle: 0.85,
  underline: 0.45,
  double: 0.7,
  strike: 0.32,
  zigzag: 0.6,
  highlight: 0.55,
};

/** the reference's pen curve: fast off the mark, a long soft landing */
const EASE = "cubic-bezier(0.3, 0.9, 0.1, 1)";

/** the share of a mark's drawing the typing waits out before it carries on */
const HOLD = 0.7;

/** the pause before the first letter, ms */
const LEAD = 450;

/** the gap between letters, ms, with a little hand in it */
function pace(ch: string): number {
  if (ch === "." || ch === "!" || ch === "?") return 380;
  if (ch === ",") return 200;
  if (ch === " ") return 45 + Math.random() * 45;
  return 30 + Math.random() * 40;
}

interface Drawn {
  shape: Shape;
  ink: Ink;
  strokes: Stroke[];
}

function marksOf(note: readonly Segment[]): Mark[] {
  return note.flatMap((s) => (typeof s === "string" ? [] : [s.mark]));
}

/** the index of the last character of each mark, mapped to that mark */
function endsOf(note: readonly Segment[]): Map<number, number> {
  const out = new Map<number, number>();
  let at = 0;
  let k = 0;
  for (const s of note) {
    const text = typeof s === "string" ? s : s.text;
    at += text.length;
    if (typeof s !== "string") out.set(at - 1, k++);
  }
  return out;
}

/**
 * A run's rects merged to one per line, in the box's own coordinates. Chrome
 * returns a rect for every character span inside the run as well as for every
 * line, and a mark drawn from those is ten small marks in a row.
 */
function lines(list: Iterable<DOMRect>, origin: DOMRect): Rect[] {
  const out: Rect[] = [];
  for (const r of list) {
    if (r.width < 1) continue;
    const y = r.top - origin.top;
    const row = out.find((o) => Math.abs(o.y - y) < r.height / 2);
    const x = r.left - origin.left;
    if (!row) {
      out.push({ x, y, w: r.width, h: r.height });
      continue;
    }
    const right = Math.max(row.x + row.w, x + r.width);
    row.x = Math.min(row.x, x);
    row.w = right - row.x;
  }
  return out;
}

/** a stroke's hidden dash state: the whole length offset, plus its cap */
function hidden(el: SVGPathElement): number {
  return el.getTotalLength() + Number(el.getAttribute("stroke-width"));
}

function prime(el: SVGPathElement, show: boolean) {
  for (const a of el.getAnimations()) a.cancel();
  const len = el.getTotalLength();
  const w = Number(el.getAttribute("stroke-width"));
  el.style.strokeDasharray = `${len} ${len + 2 * w}`;
  el.style.strokeDashoffset = show ? "0" : `${len + w}`;
}

export default function ScribbleType() {
  const reduce = useReducedMotion();
  const stage = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const para = useRef<HTMLParagraphElement>(null);
  const caret = useRef<HTMLSpanElement>(null);
  const blink = useRef<Animation | null>(null);
  /** marks the pen has started, which a relayout must leave drawn */
  const drawn = useRef(new Set<number>());

  const seen = useInView(stage, { once: true, amount: 0.5 });
  const [note, setNote] = useState(0);
  const [run, setRun] = useState(0);
  const [marks, setMarks] = useState<Drawn[]>([]);
  const [width, setWidth] = useState(0);
  const [fonts, setFonts] = useState(0);
  const [rules, setRules] = useState<CSSProperties>({});

  useEffect(() => {
    const node = stage.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    observer.observe(node);
    // the hand arrives after the first layout, and every mark was measured in
    // the fallback face until it does
    const loaded = () => setFonts((n) => n + 1);
    document.fonts.ready.then(loaded);
    document.fonts.addEventListener("loadingdone", loaded);
    return () => {
      observer.disconnect();
      document.fonts.removeEventListener("loadingdone", loaded);
    };
  }, []);

  /*
   * Measure every mark against the laid-out text, and line the page's rules up
   * under its baselines. Runs on a new note, a resize and the font arriving,
   * which is the only time any of this moves.
   */
  // biome-ignore lint/correctness/useExhaustiveDependencies: `width` and `fonts` are triggers to measure again, not values read here
  useLayoutEffect(() => {
    const box = wrap.current;
    const text = para.current;
    const page = stage.current;
    if (!box || !text || !page || !width) return;
    const origin = box.getBoundingClientRect();
    const style = getComputedStyle(text);
    const size = Number.parseFloat(style.fontSize);
    const lh = Number.parseFloat(style.lineHeight);
    const spans = text.querySelectorAll<HTMLElement>("[data-mark]");
    setMarks(
      marksOf(NOTES[note]).map((m, k) => {
        const rects = lines(spans[k]?.getClientRects() ?? [], origin);
        return { ...m, strokes: strokes(m.shape, rects, size, `${note}:${k}`) };
      }),
    );

    // a zero-size inline block on the baseline says where the first line sits
    const probe = text.querySelector<HTMLElement>("[data-probe]");
    if (probe) {
      const base =
        probe.getBoundingClientRect().top -
        page.getBoundingClientRect().top +
        0.1 * size;
      setRules({
        backgroundSize: `100% ${lh}px`,
        backgroundPositionY: `${base % lh}px`,
      });
    }
  }, [note, width, fonts]);

  const paths = useCallback(
    (k?: number) =>
      [
        ...(stage.current?.querySelectorAll<SVGPathElement>("path[data-k]") ??
          []),
      ].filter((el) => k === undefined || Number(el.dataset.k) === k),
    [],
  );

  // a fresh set of paths starts in the state the pen has them in, before paint,
  // so a new path never flashes drawn
  // biome-ignore lint/correctness/useExhaustiveDependencies: `marks` is the trigger, the paths are read off the DOM it rendered
  useLayoutEffect(() => {
    for (const el of paths()) {
      prime(el, drawn.current.has(Number(el.dataset.k)));
    }
  }, [marks, paths]);

  const draw = useCallback(
    (k: number) => {
      drawn.current.add(k);
      for (const el of paths(k)) {
        const ms = Number(el.dataset.dur);
        const from = hidden(el);
        el.style.strokeDashoffset = "0";
        el.animate([{ strokeDashoffset: from }, { strokeDashoffset: 0 }], {
          duration: ms * Number(el.dataset.span),
          delay: ms * Number(el.dataset.at),
          easing: EASE,
          fill: "backwards",
        });
      }
    },
    [paths],
  );

  /** the caret after character `i`, or before the first one when `i` is -1 */
  const place = useCallback((chars: HTMLElement[], i: number) => {
    const el = caret.current;
    const box = wrap.current;
    if (!el || !box || !chars.length) return;
    const target = chars[Math.max(0, i)];
    const rects = target.getClientRects();
    const r = i < 0 ? rects[0] : rects[rects.length - 1];
    if (!r) return;
    const origin = box.getBoundingClientRect();
    const x = (i < 0 ? r.left : r.right) - origin.left + 1;
    const y = r.top - origin.top + r.height * 0.16;
    el.style.height = `${r.height * 0.7}px`;
    el.style.transform = `translate(${x}px, ${y}px)`;
    el.style.opacity = "1";
  }, []);

  const idle = useCallback(
    (on: boolean) => {
      blink.current?.cancel();
      blink.current = null;
      const el = caret.current;
      if (!el || !on || reduce) return;
      blink.current = el.animate(
        [
          { opacity: 1, offset: 0 },
          { opacity: 1, offset: 0.5 },
          { opacity: 0, offset: 0.5 },
          { opacity: 0, offset: 1 },
        ],
        { duration: 1060, iterations: Number.POSITIVE_INFINITY },
      );
    },
    [reduce],
  );

  /*
   * The writing. One timer chain, and every step is two style writes and one
   * rect read, so nothing renders while the note is being typed.
   */
  // biome-ignore lint/correctness/useExhaustiveDependencies: `run` restarts the same note
  useEffect(() => {
    const text = para.current;
    const box = wrap.current;
    if (!seen || !text || !box) return;
    for (const a of box.getAnimations()) a.cancel();

    const chars = [...text.querySelectorAll<HTMLElement>("[data-c]")];
    const ends = endsOf(NOTES[note]);
    const shapes = marksOf(NOTES[note]).map((m) => m.shape);
    drawn.current.clear();
    for (const el of paths()) prime(el, false);
    for (const c of chars) c.style.opacity = "";

    if (reduce) {
      for (const c of chars) c.style.opacity = "1";
      shapes.forEach((_, k) => {
        drawn.current.add(k);
      });
      for (const el of paths()) prime(el, true);
      place(chars, chars.length - 1);
      return;
    }

    let i = 0;
    let timer = 0;
    place(chars, -1);
    idle(true);
    const step = () => {
      if (i === 0) idle(false);
      chars[i].style.opacity = "1";
      place(chars, i);
      let wait = pace(chars[i].textContent ?? "");
      const k = ends.get(i);
      if (k !== undefined) {
        draw(k);
        wait = Math.max(wait, DRAW[shapes[k]] * 1000 * HOLD);
      }
      i++;
      if (i < chars.length) timer = window.setTimeout(step, wait);
      else idle(true);
    };
    timer = window.setTimeout(step, LEAD);
    return () => {
      window.clearTimeout(timer);
      idle(false);
    };
  }, [seen, note, run, reduce, draw, idle, place, paths]);

  /** fade the page out, then start a note from its first letter */
  const restart = (next: number) => {
    const box = wrap.current;
    const go = () => {
      setNote(next);
      setRun((n) => n + 1);
    };
    if (!box || reduce) return go();
    box
      .animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 180,
        easing: "ease-out",
        fill: "forwards",
      })
      .finished.then(go, () => {});
  };

  const segments = NOTES[note];
  let mark = -1;

  return (
    <TooltipProvider delayDuration={200}>
      <div
        ref={stage}
        className="@container relative flex aspect-8/5 min-h-80 w-full select-none flex-col overflow-hidden rounded-lg bg-bg ring-1 ring-stroke ring-inset"
        style={{
          // ruled paper, lined up under the text's own baselines once measured
          backgroundImage:
            "linear-gradient(to bottom, var(--color-stroke) 1px, transparent 1px)",
          backgroundSize: "100% 0",
          ...rules,
        }}
      >
        <div className="flex flex-1 items-center justify-center px-[9cqw] pt-[5cqw]">
          <div ref={wrap} className="relative w-full max-w-136">
            {/* the marker goes down under the ink */}
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 size-full overflow-visible mix-blend-multiply"
            >
              {marks.map((m, k) =>
                m.shape === "highlight" ? (
                  // biome-ignore lint/suspicious/noArrayIndexKey: a mark's index is its identity within a note
                  <Strokes key={k} k={k} mark={m} />
                ) : null,
              )}
            </svg>

            <p
              ref={para}
              key={note}
              aria-hidden="true"
              className={cn(
                caveat.className,
                "relative font-medium text-text-primary leading-[1.55]",
              )}
              style={{ fontSize: "clamp(1.25rem, 5.6cqw, 2.1rem)" }}
            >
              <span
                data-probe=""
                className="inline-block size-0 align-baseline"
              />
              {segments.map((s, si) => {
                if (typeof s === "string") {
                  // biome-ignore lint/suspicious/noArrayIndexKey: a note's segments never reorder
                  return <Chars key={si} text={s} />;
                }
                mark++;
                return (
                  <span
                    // biome-ignore lint/suspicious/noArrayIndexKey: a note's segments never reorder
                    key={si}
                    data-mark={mark}
                    /*
                     * A loop goes round a run on one line, so the run stays
                     * whole, and it carries a little air each side so the loop
                     * passes between letters rather than through its neighbours.
                     */
                    className={cn(
                      s.mark.shape === "circle" &&
                        "whitespace-nowrap px-[0.1em]",
                    )}
                  >
                    <Chars text={s.text} />
                  </span>
                );
              })}
            </p>

            <svg
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 size-full overflow-visible"
            >
              {marks.map((m, k) =>
                m.shape === "highlight" ? null : (
                  // biome-ignore lint/suspicious/noArrayIndexKey: a mark's index is its identity within a note
                  <Strokes key={k} k={k} mark={m} />
                ),
              )}
            </svg>

            <span
              ref={caret}
              aria-hidden="true"
              className="pointer-events-none absolute top-0 left-0 w-0.5 rounded-full bg-text-primary opacity-0"
            />
          </div>
        </div>

        <p className="sr-only">{plain(segments)}</p>

        <div className="flex justify-end gap-2 p-3">
          <Tooltip label="Write it again">
            <Pill icon label="Write it again" onClick={() => restart(note)}>
              <ArrowCounterClockwiseIcon
                aria-hidden="true"
                className="size-3.5 shrink-0"
              />
            </Pill>
          </Tooltip>
          <Tooltip label="Next note">
            <Pill
              icon
              label="Next note"
              onClick={() => restart((note + 1) % NOTES.length)}
            >
              <ArrowRightIcon
                aria-hidden="true"
                className="size-3.5 shrink-0"
              />
            </Pill>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}

/**
 * A run's characters as plain inline spans. Inline rather than inline-block, so
 * the run still shapes and kerns as one piece of text and nothing about the line
 * changes when a character is shown.
 */
function Chars({ text }: { text: string }) {
  return [...text].map((ch, i) => (
    <span
      // biome-ignore lint/suspicious/noArrayIndexKey: a character's place in its run is its identity
      key={i}
      data-c=""
      className="opacity-0 [transition:opacity_90ms_ease-out]"
    >
      {ch}
    </span>
  ));
}

/** one mark's strokes, each carrying its own timing for the pen to read */
function Strokes({ k, mark }: { k: number; mark: Drawn }) {
  return mark.strokes.map((s, i) => (
    <path
      // biome-ignore lint/suspicious/noArrayIndexKey: a mark's strokes are rebuilt together
      key={i}
      data-k={k}
      data-at={s.at}
      data-span={s.span}
      data-dur={DRAW[mark.shape] * 1000}
      d={s.d}
      fill="none"
      stroke={INK[mark.ink]}
      strokeWidth={s.width}
      strokeOpacity={s.opacity}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ));
}
