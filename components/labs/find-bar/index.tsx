"use client";

import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import {
  type KeyboardEvent,
  type MouseEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { TextMorph } from "torph/react";
import {
  CaretDownIcon,
  CaretUpIcon,
  MagnifyingGlassIcon,
  XIcon,
} from "@/components/icons";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { findAll } from "./find";
import { Page } from "./page";

/** The bar stands on the page and the field is cut into the bar */
const RAISED =
  "inset 0 1px 0 rgb(255 255 255), inset 0 -1px 0 rgb(0 0 0 / 0.04), 0 1px 2px rgb(0 0 0 / 0.08), 0 6px 12px -4px rgb(0 0 0 / 0.1), 0 20px 36px -14px rgb(0 0 0 / 0.16)";
const WELL =
  "inset 0 1px 3px rgb(0 0 0 / 0.13), inset 0 1px 1px rgb(0 0 0 / 0.05), 0 1px 0 rgb(255 255 255)";
/** the current match, scoped here with the highlight colours in globals.css */
const CURRENT = "#fdba74";
const MATCH = "#fde68a";
const TICK = "#e3a008";
const TICK_CURRENT = "#ea580c";
const GLIDE = { type: "spring", visualDuration: 0.28, bounce: 0.12 } as const;
/** a step that also scrolls: the box and the page share this one spring */
const TRAVEL = { type: "spring", visualDuration: 0.42, bounce: 0.06 } as const;
/** the current match pops as the box lands on it, Safari's bounce */
const POP = {
  scale: [1, 1.2, 1],
  times: [0, 0.35, 1],
  duration: 0.32,
} as const;
/** the room the bar takes over the top of the page, kept clear of a match */
const CLEAR_TOP = 64;
const CLEAR_BOTTOM = 24;
/** how close a press on the rail has to land to a tick to take it */
const TICK_REACH = 6;
const START = "cafe";

const BUTTON =
  "grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-text-secondary transition-all duration-150 hover:bg-fill hover:text-text-primary active:bg-fill-hover disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2";

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Match {
  range: Range;
  /** its line boxes, relative to the page, which scrolls with them */
  rects: Box[];
  /** the shut section it is folded inside, which has no boxes to measure */
  fold: HTMLDetailsElement | null;
  /** where it sits down the page, for the rail: the fold's summary if folded */
  mid: number;
}

/**
 * Where a step goes. `step` is a reader moving to a match, which pops it,
 * `glide` is a new query landing, and `jump` is a remeasure, which moves nothing.
 */
type Move = "step" | "glide" | "jump";

const highlights = (): HighlightRegistry | null =>
  typeof CSS !== "undefined" && "highlights" in CSS ? CSS.highlights : null;

/** A range's line boxes, relative to the page element that scrolls with them */
function rectsOf(range: Range, page: HTMLElement): Box[] {
  const c = page.getBoundingClientRect();
  const out: Box[] = [];
  for (const r of range.getClientRects()) {
    if (r.width <= 0.5) continue;
    const box = {
      x: r.left - c.left,
      y: r.top - c.top,
      w: r.width,
      h: r.height,
    };
    // a match that crosses an element returns a box per element, and the ones
    // on one line are merged, so only a wrapped match has more than one
    const line = out.find((b) => Math.abs(b.y - box.y) < 2);
    if (line) {
      const right = Math.max(line.x + line.w, box.x + box.w);
      line.x = Math.min(line.x, box.x);
      line.w = right - line.x;
    } else out.push(box);
  }
  return out;
}

function measure(range: Range, root: HTMLElement): Match {
  // Chrome lays out a shut <details> and reports boxes for it, so whether a
  // match is folded is read off the element and never off empty rects. The
  // summary is the one part of a shut section on screen
  const details = range.startContainer.parentElement?.closest("details");
  const summary = details?.querySelector("summary");
  const fold =
    details && !details.open && !summary?.contains(range.startContainer)
      ? details
      : null;
  const rects = fold ? [] : rectsOf(range, root);
  let mid = rects[0] ? rects[0].y + rects[0].h / 2 : 0;
  if (fold && summary) {
    const s = summary.getBoundingClientRect();
    mid = s.top + s.height / 2 - root.getBoundingClientRect().top;
  }
  return { range, rects, fold, mid };
}

/** The rail's thumb, written to the node so scrolling renders nothing */
function paintThumb(s: HTMLElement | null, t: HTMLElement | null) {
  if (!s || !t) return;
  t.style.top = `${(s.scrollTop / s.scrollHeight) * 100}%`;
  t.style.height = `${(s.clientHeight / s.scrollHeight) * 100}%`;
}

export default function FindBar() {
  const reduce = useReducedMotion();
  const stage = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const well = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const thumb = useRef<HTMLSpanElement>(null);
  const reopen = useRef<HTMLButtonElement>(null);
  /** whether the pointer is over the demo, which is when ⌘F is ours */
  const over = useRef(false);
  /** what the next paint does: glide to the match and bring it into view, or only jump */
  const move = useRef<Move>("jump");
  /** the move a fold was opened for, carried across the remeasure it causes */
  const unfold = useRef<Move | null>(null);
  /** the page's own glide, stopped by any scroll of the reader's */
  const scrolling = useRef<{ stop: () => void } | null>(null);
  const boxShown = useRef(false);
  /** the match the box is on, and a count of paints so a stale landing is ignored */
  const sat = useRef<Range | null>(null);
  const flights = useRef(0);
  /** amber stand-ins for the two words the box is moving between */
  const ghosts = useRef<HTMLDivElement>(null);
  const focusField = useRef(false);
  const handBack = useRef(false);
  const wasMiss = useRef(false);

  const [query, setQuery] = useState(START);
  const [open, setOpen] = useState(true);
  const [matches, setMatches] = useState<Match[]>([]);
  const [index, setIndex] = useState(-1);
  /** where the page sits in its scroller, to place the ticks */
  const [extent, setExtent] = useState({ scroll: 1, off: 0 });

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const w = useMotionValue(0);
  const h = useMotionValue(0);
  const opacity = useMotionValue(0);
  const scale = useMotionValue(1);

  const n = matches.length;
  const typed = query.trim() !== "";
  const miss = typed && n === 0;

  // A new query finds again, and starts on the first match at or below the top
  // of what is on screen, the way a browser does
  useLayoutEffect(() => {
    const root = content.current;
    const s = scroller.current;
    if (!root || !s) return;
    const found = findAll(root, query).map((range) => measure(range, root));
    const top = s.scrollTop;
    const off = root.offsetTop;
    const first = found.findIndex((m) => off + m.mid >= top);
    move.current = "glide";
    setMatches(found);
    setIndex(found.length ? Math.max(first, 0) : -1);
    setExtent({ scroll: s.scrollHeight, off });
  }, [query]);

  // A resize or a late font moves every line, so the boxes are measured again
  // where the ranges already are, and nothing scrolls
  useEffect(() => {
    const root = content.current;
    const s = scroller.current;
    if (!root || !s) return;
    const ro = new ResizeObserver(() => {
      // a fold opened for a match is still a move to it, so it keeps its glide
      move.current = unfold.current ?? "jump";
      unfold.current = null;
      setMatches((prev) => prev.map((m) => measure(m.range, root)));
      setExtent({ scroll: s.scrollHeight, off: root.offsetTop });
      paintThumb(s, thumb.current);
    });
    ro.observe(root);
    return () => ro.disconnect();
  }, []);

  // the highlights, the gliding box and the scroll, all off one index
  useEffect(() => {
    const reg = highlights();
    const cur = open ? matches[index] : undefined;
    const single = cur?.rects.length === 1;
    const flight = ++flights.current;
    // every match is amber but the ones in `skip`, which the box is on or on
    // its way off. The highlight paints over the box, so a word left in it
    // would cover the orange the moment the box arrived or left
    const light = (skip: Range[]) => {
      if (!reg) return;
      if (!open) {
        reg.delete("find-bar-match");
        reg.delete("find-bar-current");
        return;
      }
      reg.set(
        "find-bar-match",
        new Highlight(
          ...matches.map((m) => m.range).filter((r) => !skip.includes(r)),
        ),
      );
      // a match that wraps a line has two boxes, and the highlight paints both
      if (cur && !single) reg.set("find-bar-current", new Highlight(cur.range));
      else reg.delete("find-bar-current");
    };
    // during a glide the box's two words leave the highlight and are drawn here
    // in the same amber, under the box, so the orange slides over them
    const ghost = (rects: Box[]) => {
      const layer = ghosts.current;
      if (!layer) return;
      layer.replaceChildren(
        ...rects.map((r) => {
          const el = document.createElement("span");
          el.style.cssText = `position:absolute;left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px;background:${MATCH}`;
          return el;
        }),
      );
    };
    const settled = cur && single ? [cur.range] : [];
    light(settled);
    ghost([]);

    const mode = move.current;
    move.current = "jump";

    // a match in a shut section opens it, the way a browser opens a <details>.
    // The ResizeObserver then measures it and carries this move on
    if (cur?.fold && mode !== "jump") {
      unfold.current = mode;
      cur.fold.open = true;
      return;
    }

    // whether the page has to move for the match, worked out first, since a
    // step that scrolls puts the box and the page on one spring
    const s = scroller.current;
    const root = content.current;
    let target: number | null = null;
    if (mode !== "jump" && cur?.rects[0] && s && root) {
      const r = cur.rects[0];
      const top = root.offsetTop + r.y;
      if (
        top < s.scrollTop + CLEAR_TOP ||
        top + r.h > s.scrollTop + s.clientHeight - CLEAR_BOTTOM
      ) {
        const max = s.scrollHeight - s.clientHeight;
        target = Math.min(max, Math.max(0, top - (s.clientHeight - r.h) / 2));
      }
    }
    const spring = target === null ? GLIDE : TRAVEL;

    if (!cur || !single) {
      boxShown.current = false;
      sat.current = null;
      opacity.jump(0);
    } else {
      const r = cur.rects[0];
      const to = { x: r.x - 1, y: r.y, w: r.w + 2, h: r.h };
      if (!boxShown.current || mode === "jump" || reduce) {
        x.jump(to.x);
        y.jump(to.y);
        w.jump(to.w);
        h.jump(to.h);
      } else {
        animate(x, to.x, spring);
        animate(w, to.w, spring);
        animate(h, to.h, spring);
        const from = sat.current;
        // the word the box is leaving keeps its orange until the box has slid
        // off it, and gets its amber back once the box lands
        const left = matches.find((m) => m.range === from);
        if (left && from !== cur.range) {
          light([cur.range, left.range]);
          ghost([...left.rects, ...cur.rects]);
        }
        animate(y, to.y, spring).then(() => {
          if (flight !== flights.current) return;
          light(settled);
          ghost([]);
        });
      }
      if (mode === "step" && !reduce) {
        const { scale: frames, ...timing } = POP;
        animate(scale, [...frames], {
          ...timing,
          times: [...timing.times],
          // lands with the box, so the bounce is on the match and not on the way
          delay: target === null ? 0.06 : 0.18,
        });
      }
      boxShown.current = true;
      sat.current = cur.range;
      opacity.jump(1);
    }

    if (target !== null && s) {
      scrolling.current?.stop();
      if (reduce) s.scrollTop = target;
      else
        scrolling.current = animate(s.scrollTop, target, {
          ...spring,
          onUpdate: (v) => {
            s.scrollTop = v;
          },
        });
    }
  }, [matches, index, open, reduce, x, y, w, h, opacity, scale]);

  useEffect(
    () => () => {
      highlights()?.delete("find-bar-match");
      highlights()?.delete("find-bar-current");
    },
    [],
  );

  // a miss shakes the field once, on the way into it
  useEffect(() => {
    if (miss && !wasMiss.current) shake();
    wasMiss.current = miss;
  });

  useEffect(() => {
    if (open && focusField.current) {
      focusField.current = false;
      field.current?.focus();
      field.current?.select();
    }
    if (!open && handBack.current) {
      handBack.current = false;
      reopen.current?.focus();
    }
  }, [open]);

  const shake = () => {
    if (reduce || !well.current) return;
    well.current.animate(
      [
        { translate: "0" },
        { translate: "-4px" },
        { translate: "3px" },
        { translate: "-2px" },
        { translate: "0" },
      ],
      { duration: 280, easing: "ease-out" },
    );
  };

  const step = (by: number) => {
    if (!n) {
      if (typed) shake();
      return;
    }
    move.current = "step";
    setIndex((i) => (i + by + n) % n);
  };

  const show = () => {
    if (open) {
      field.current?.focus();
      field.current?.select();
      return;
    }
    focusField.current = true;
    setOpen(true);
  };

  const close = (keyboard: boolean) => {
    handBack.current = keyboard;
    setOpen(false);
  };

  // ⌘F, ⌘E, ⌘G and Escape are the demo's while the pointer or the focus is in it,
  // and the browser's everywhere else
  // ⌘E finds the words selected on the page, the way a Mac browser does
  const seek = () => {
    const sel = window.getSelection();
    const text = sel?.toString().replace(/\s+/g, " ").trim();
    if (!text || !content.current?.contains(sel?.anchorNode ?? null))
      return false;
    setQuery(text);
    sel?.removeAllRanges();
    show();
    return true;
  };

  const keys = useRef({ show, step, close, open, seek });
  useLayoutEffect(() => {
    keys.current = { show, step, close, open, seek };
  });
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const enter = () => {
      over.current = true;
    };
    const leave = () => {
      over.current = false;
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      const ours = over.current || el.contains(document.activeElement);
      if (!ours) return;
      const k = e.key.toLowerCase();
      const mod = e.metaKey || e.ctrlKey;
      if (mod && k === "f") {
        e.preventDefault();
        keys.current.show();
      } else if (mod && k === "e") {
        if (keys.current.seek()) e.preventDefault();
      } else if (mod && k === "g") {
        e.preventDefault();
        keys.current.step(e.shiftKey ? -1 : 1);
      } else if (
        k === "escape" &&
        keys.current.open &&
        el.contains(document.activeElement)
      ) {
        e.preventDefault();
        keys.current.close(true);
      }
    };
    el.addEventListener("pointerenter", enter);
    el.addEventListener("pointerleave", leave);
    window.addEventListener("keydown", onKey);
    return () => {
      el.removeEventListener("pointerenter", enter);
      el.removeEventListener("pointerleave", leave);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // the rail is a scrollbar: a press near a tick goes to that match, and a
  // press anywhere else scrolls there
  const tickAt = matches.map((m) => (extent.off + m.mid) / extent.scroll);
  const ticks = useRef<number[]>([]);
  useLayoutEffect(() => {
    ticks.current = tickAt;
  });
  useEffect(() => {
    const el = rail.current;
    const s = scroller.current;
    if (!el || !s) return;
    paintThumb(s, thumb.current);
    const onScroll = () => paintThumb(s, thumb.current);
    const onDown = (e: PointerEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const f = (e.clientY - r.top) / r.height;
      let best = -1;
      let gap = TICK_REACH;
      ticks.current.forEach((t, i) => {
        const d = Math.abs(t - f) * r.height;
        if (d <= gap) {
          gap = d;
          best = i;
        }
      });
      if (best >= 0 && keys.current.open) {
        move.current = "step";
        setIndex(best);
      } else {
        scrolling.current?.stop();
        s.scrollTo({
          top: f * s.scrollHeight - s.clientHeight / 2,
          behavior: "smooth",
        });
      }
    };
    // the reader scrolling takes the page back from a glide in progress
    const stop = () => scrolling.current?.stop();
    const hand = ["wheel", "touchstart", "pointerdown", "keydown"] as const;
    s.addEventListener("scroll", onScroll, { passive: true });
    for (const t of hand) s.addEventListener(t, stop, { passive: true });
    el.addEventListener("pointerdown", onDown);
    return () => {
      s.removeEventListener("scroll", onScroll);
      for (const t of hand) s.removeEventListener(t, stop);
      el.removeEventListener("pointerdown", onDown);
      stop();
    };
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      step(e.shiftKey ? -1 : 1);
    }
  };

  const onClose = (e: MouseEvent<HTMLButtonElement>) => close(e.detail === 0);

  const count = !typed ? "" : n ? `${index + 1} of ${n}` : "0 of 0";
  const status = !open || !typed ? "" : n ? `Match ${count}` : "No matches";

  return (
    <div
      ref={stage}
      className="h-[25rem] w-full rounded-lg bg-fill p-4 ring-1 ring-stroke ring-inset sm:p-6"
    >
      <TooltipProvider delayDuration={500}>
        <div
          className="relative size-full overflow-clip rounded-xl bg-bg outline outline-stroke"
          style={{ boxShadow: RAISED }}
        >
          <section
            ref={scroller}
            aria-label="Page"
            // biome-ignore lint/a11y/noNoninteractiveTabindex: a scroll region needs focus for the arrow and page keys to scroll it
            tabIndex={0}
            className="peer relative size-full overflow-y-auto overscroll-contain px-6 pt-16 pb-10 outline-none [scrollbar-width:none] sm:px-10 [&::-webkit-scrollbar]:hidden"
          >
            <div ref={content} className="relative mx-auto max-w-112">
              <div
                ref={ghosts}
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
              />
              <motion.div
                aria-hidden="true"
                className="pointer-events-none absolute top-0 left-0 rounded-[3px]"
                style={{
                  x,
                  y,
                  width: w,
                  height: h,
                  opacity,
                  scale,
                  backgroundColor: CURRENT,
                }}
              />
              <div className="relative">
                <Page />
              </div>
            </div>
          </section>
          {/* an inset ring on a scroller paints under its own children */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-xl opacity-0 ring-2 ring-text-secondary ring-inset peer-focus-visible:opacity-100"
          />

          <div
            ref={rail}
            aria-hidden="true"
            className="absolute top-3 right-0.5 bottom-3 w-4 cursor-pointer"
          >
            <div className="absolute inset-y-0 left-1/2 w-1.5 -translate-x-1/2 rounded-full bg-fill">
              <span
                ref={thumb}
                className="absolute inset-x-0 rounded-full bg-stroke-strong"
              />
              {open &&
                tickAt.map((t, i) => (
                  <span
                    // biome-ignore lint/suspicious/noArrayIndexKey: ticks are positions
                    key={i}
                    data-tick={i}
                    className="absolute -inset-x-0.5 h-0.5 -translate-y-1/2 rounded-full"
                    style={{
                      top: `${t * 100}%`,
                      backgroundColor: i === index ? TICK_CURRENT : TICK,
                    }}
                  />
                ))}
            </div>
          </div>

          <AnimatePresence initial={false}>
            {open ? (
              <motion.div
                key="bar"
                initial={{ opacity: 0, y: -6 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.16, ease: [0.23, 1, 0.32, 1] },
                }}
                exit={{ opacity: 0, y: -6, transition: { duration: 0.11 } }}
                // concentric: the field and the buttons are rounded-lg, 6.4px,
                // and the bar is that plus its own 3.2px of padding
                className="absolute top-3 right-5 z-20 flex items-center gap-0.5 rounded-[0.6rem] bg-bg p-1 outline outline-stroke"
                style={{ boxShadow: RAISED }}
              >
                <div
                  ref={well}
                  style={miss ? undefined : { boxShadow: WELL }}
                  className={cn(
                    "mr-0.5 flex h-8 items-center gap-2 rounded-lg px-2.5 transition-colors duration-200",
                    miss ? "bg-danger/10" : "bg-fill",
                  )}
                >
                  <input
                    ref={field}
                    aria-label="Find in page"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    placeholder="Find in page"
                    value={query}
                    onChange={(e) => setQuery(e.currentTarget.value)}
                    onKeyDown={onKeyDown}
                    className="w-24 min-w-0 bg-transparent text-body text-text-primary caret-text-primary outline-none transition-all duration-200 placeholder:text-body placeholder:text-text-muted sm:w-36"
                  />
                  <span
                    aria-hidden="true"
                    className={cn(
                      "shrink-0 text-meta tabular-nums leading-tight",
                      miss ? "text-danger" : "text-text-muted",
                    )}
                  >
                    <TextMorph
                      duration={160}
                      ease="cubic-bezier(0.4, 0, 0.2, 1)"
                    >
                      {count}
                    </TextMorph>
                  </span>
                </div>
                <Tooltip label="Previous match (Shift+Enter)">
                  <button
                    type="button"
                    aria-label="Previous match"
                    disabled={!n}
                    onClick={() => step(-1)}
                    className={BUTTON}
                  >
                    <CaretUpIcon className="size-4" />
                  </button>
                </Tooltip>
                <Tooltip label="Next match (Enter)">
                  <button
                    type="button"
                    aria-label="Next match"
                    disabled={!n}
                    onClick={() => step(1)}
                    className={BUTTON}
                  >
                    <CaretDownIcon className="size-4" />
                  </button>
                </Tooltip>
                <Tooltip label="Close (Esc)">
                  <button
                    type="button"
                    aria-label="Close find bar"
                    onClick={onClose}
                    className={BUTTON}
                  >
                    <XIcon className="size-4" />
                  </button>
                </Tooltip>
              </motion.div>
            ) : (
              <motion.div
                key="reopen"
                initial={{ opacity: 0, y: -6 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.16, ease: [0.23, 1, 0.32, 1] },
                }}
                exit={{ opacity: 0, transition: { duration: 0.11 } }}
                className="absolute top-3 right-5 z-20"
              >
                <Tooltip label="Find in page (⌘F)">
                  <button
                    ref={reopen}
                    type="button"
                    aria-label="Find in page"
                    onClick={show}
                    className={cn(BUTTON, "bg-bg outline outline-stroke")}
                    style={{ boxShadow: RAISED }}
                  >
                    <MagnifyingGlassIcon className="size-4" />
                  </button>
                </Tooltip>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </TooltipProvider>
      <span role="status" className="sr-only">
        {status}
      </span>
    </div>
  );
}
