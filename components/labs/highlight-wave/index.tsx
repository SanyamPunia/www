"use client";

import { EraserIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  type CSSProperties,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { FOCUS } from "@/components/lab/controls";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  cut,
  type Highlight,
  HUES,
  NOTES,
  SEED,
  segments,
  snap,
} from "./notes";
import { CLEAR, drawBars, type Paint, playWave, type Under } from "./wave";

/*
 * A page of notes. Select a run of text and a palette comes up over it, pick a
 * colour and a wave runs along the selection: each character swells, glows in
 * that colour and settles into it while the bar fills in behind it. Pressing a
 * mark opens the palette on it, and picking again recolours it with the same
 * wave, from the old colour to the new one.
 */

/** 200ms on the strongest ease-out in the lab, the call `region-comment` makes */
const ENTER = { duration: 0.2, ease: [0.23, 1, 0.32, 1] } as const;
const LEAVE = { duration: 0.12, ease: [0.4, 0, 1, 1] } as const;

const LIFT = [
  "0 1px 2px rgb(0 0 0 / 0.06)",
  "0 8px 16px -6px rgb(0 0 0 / 0.1)",
  "0 20px 40px -16px rgb(0 0 0 / 0.14)",
].join(", ");

/** gap between the palette and the text it is about, px */
const GAP = 12;
/** the palette keeps this far inside the stage, px */
const EDGE = 8;

interface Anchor {
  x: number;
  top: number;
  bottom: number;
}

type Pop =
  | {
      kind: "new";
      para: number;
      start: number;
      end: number;
      anchor: Anchor;
    }
  | { kind: "edit"; id: number; viaKey: boolean };

interface Wave {
  id: number;
  from: Paint;
  /** marks the new one was laid over, which keep their colour until the wave reaches them */
  under: Under[];
  hue: number;
  /** bumped per request, so the same mark can wave twice in a row */
  nonce: number;
}

/** a rect list's bounds, in the stage's own coordinates */
function bounds(rects: Iterable<DOMRect>, stage: DOMRect): Anchor | null {
  let l = Number.POSITIVE_INFINITY;
  let r = Number.NEGATIVE_INFINITY;
  let t = Number.POSITIVE_INFINITY;
  let b = Number.NEGATIVE_INFINITY;
  for (const rect of rects) {
    if (rect.width < 1) continue;
    l = Math.min(l, rect.left);
    r = Math.max(r, rect.right);
    t = Math.min(t, rect.top);
    b = Math.max(b, rect.bottom);
  }
  if (!Number.isFinite(l)) return null;
  return {
    x: (l + r) / 2 - stage.left,
    top: t - stage.top,
    bottom: b - stage.top,
  };
}

/** characters of text in `root` before a DOM position */
function offsetIn(root: Node, node: Node, offset: number): number {
  const range = document.createRange();
  range.setStart(root, 0);
  range.setEnd(node, offset);
  return range.toString().length;
}

export default function HighlightWave() {
  const reduce = useReducedMotion();
  const stage = useRef<HTMLDivElement>(null);
  const paras = useRef<(HTMLParagraphElement | null)[]>([]);
  const layers = useRef<(HTMLSpanElement | null)[]>([]);
  const pop = useRef<HTMLDivElement>(null);

  const [marks, setMarks] = useState<Highlight[]>(SEED);
  const [open, setOpen] = useState<Pop | null>(null);
  const [wave, setWave] = useState<Wave | null>(null);
  const [width, setWidth] = useState(0);
  const [said, setSaid] = useState("");

  const nextId = useRef(SEED.length + 1);
  const played = useRef(0);
  const nonce = useRef(0);

  const live = useRef({ marks, open });
  live.current = { marks, open };

  useEffect(() => {
    const node = stage.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const base = (para: number): string => {
    const el = paras.current[para];
    return el ? getComputedStyle(el).color : "currentColor";
  };

  /*
   * The bars are redrawn from the marks on every change and every resize, and a
   * pending wave plays on the bars this pass has just drawn. Both before paint,
   * so a fresh mark never shows a frame of its finished colour ahead of the wave.
   */
  // biome-ignore lint/correctness/useExhaustiveDependencies: `width` is the resize, and the bars are measured off the layout it changes
  useLayoutEffect(() => {
    paras.current.forEach((p, i) => {
      const layer = layers.current[i];
      if (p && layer) drawBars(p, layer);
    });

    if (!wave || wave.nonce === played.current) return;
    played.current = wave.nonce;
    if (reduce) return;
    const mark = marks.find((m) => m.id === wave.id);
    const p = mark ? paras.current[mark.para] : null;
    const layer = mark ? layers.current[mark.para] : null;
    if (!mark || !p || !layer) return;
    const hue = HUES[wave.hue];
    playWave(p, layer, mark.id, wave.from, hue, hue.swatch, false, wave.under);
  }, [marks, wave, width, reduce]);

  /*
   * The palette sits over the middle of what it is about, above it where there
   * is room and below it where there is not, and never past the stage's edge.
   * Written to the node, since it needs the palette's own size first.
   */
  // biome-ignore lint/correctness/useExhaustiveDependencies: `marks` and `width` both move the text the palette points at
  useLayoutEffect(() => {
    const el = pop.current;
    const st = stage.current;
    if (!open || !el || !st) return;
    const box = st.getBoundingClientRect();

    let at: Anchor | null = null;
    if (open.kind === "new") at = open.anchor;
    else {
      const mark = st.querySelector<HTMLElement>(`[data-hl="${open.id}"]`);
      if (mark) at = bounds(mark.getClientRects(), box);
    }
    if (!at) return;

    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const above = at.top - GAP - h >= EDGE;
    const top = above ? at.top - GAP - h : at.bottom + GAP;
    const left = Math.min(
      Math.max(at.x - w / 2, EDGE),
      Math.max(box.width - w - EDGE, EDGE),
    );
    const ax = Math.min(Math.max(at.x - left, 16), w - 16);

    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.transformOrigin = `${ax}px ${above ? "100%" : "0%"}`;
    el.style.setProperty("--ax", `${ax}px`);
    el.dataset.side = above ? "top" : "bottom";
  }, [open, marks, width]);

  /** what the reader has selected, snapped to words and held to one paragraph */
  const read = useCallback((): Pop | null => {
    const sel = window.getSelection();
    const st = stage.current;
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed || !st) return null;
    const range = sel.getRangeAt(0);

    const para = paras.current.findIndex(
      (p) => p !== null && range.intersectsNode(p),
    );
    const el = paras.current[para];
    if (!el) return null;
    const text = NOTES[para];

    const s = el.contains(range.startContainer)
      ? offsetIn(el, range.startContainer, range.startOffset)
      : 0;
    const e = el.contains(range.endContainer)
      ? offsetIn(el, range.endContainer, range.endOffset)
      : text.length;
    const [start, end] = snap(text, s, e);
    if (end <= start) return null;

    const same = live.current.marks.find(
      (m) => m.para === para && m.start === start && m.end === end,
    );
    if (same) return { kind: "edit", id: same.id, viaKey: false };

    // only the lines inside this paragraph, for a drag that ran past its end
    const pr = el.getBoundingClientRect();
    const rects = [...range.getClientRects()].filter(
      (r) => r.bottom > pr.top && r.top < pr.bottom,
    );
    const anchor = bounds(rects, st.getBoundingClientRect());
    if (!anchor) return null;
    return { kind: "new", para, start, end, anchor };
  }, []);

  /*
   * A selection is read when the hand lets go, and again a beat after any other
   * change to it, which covers the caret handles, a long press on a phone and the
   * keyboard. A press anywhere but the palette or a handle closes it.
   */
  useEffect(() => {
    const st = stage.current;
    if (!st) return;
    let pressing = false;
    let timer = 0;

    const check = () => {
      const next = read();
      if (next) setOpen(next);
    };
    const down = (e: PointerEvent) => {
      const t = e.target as Element;
      if (pop.current?.contains(t) || t.closest("[data-selection-caret]"))
        return;
      if (live.current.open) setOpen(null);
      pressing = st.contains(t);
    };
    const up = () => {
      if (!pressing) return;
      pressing = false;
      window.clearTimeout(timer);
      timer = window.setTimeout(check, 0);
    };
    const changed = () => {
      if (pressing) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(check, 180);
    };

    document.addEventListener("pointerdown", down, true);
    window.addEventListener("pointerup", up);
    document.addEventListener("selectionchange", changed);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("pointerdown", down, true);
      window.removeEventListener("pointerup", up);
      document.removeEventListener("selectionchange", changed);
    };
  }, [read]);

  const close = useCallback((restore: boolean) => {
    const was = live.current.open;
    setOpen(null);
    if (restore && was?.kind === "edit" && was.viaKey) {
      stage.current
        ?.querySelector<HTMLElement>(`[data-hl="${was.id}"]`)
        ?.focus({ preventScroll: true });
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const key = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") close(true);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open, close]);

  const request = (
    id: number,
    from: Paint,
    hue: number,
    under: Under[] = [],
  ) => {
    nonce.current += 1;
    setWave({ id, from, under, hue, nonce: nonce.current });
  };

  const pick = (hue: number) => {
    if (!open) return;
    if (open.kind === "new") {
      const { para, start, end } = open;
      const id = nextId.current++;
      const under = marks
        .filter((m) => m.para === para && m.start < end && m.end > start)
        .map((m) => ({
          start: Math.max(m.start, start),
          end: Math.min(m.end, end),
          paint: HUES[m.hue],
        }));
      window.getSelection()?.removeAllRanges();
      setMarks((all) => [
        ...cut(all, para, start, end, () => nextId.current++),
        { id, para, start, end, hue },
      ]);
      request(id, { ink: base(para), wash: CLEAR }, hue, under);
      setOpen({ kind: "edit", id, viaKey: false });
    } else {
      const mark = marks.find((m) => m.id === open.id);
      if (!mark) return;
      setMarks((all) => all.map((m) => (m.id === mark.id ? { ...m, hue } : m)));
      request(mark.id, HUES[mark.hue], hue);
    }
    setSaid(`Highlighted in ${HUES[hue].name}`);
  };

  /*
   * Removing a mark is the same wave run back to the paragraph's own tone with
   * the bar swept clear, and the mark leaves the page once it has finished.
   * Nothing is lost that a second pick would not put back, so it does not
   * confirm.
   */
  const remove = () => {
    if (open?.kind !== "edit") return;
    const mark = marks.find((m) => m.id === open.id);
    if (!mark) return;
    close(false);
    setSaid("Highlight removed");
    const drop = () => setMarks((all) => all.filter((m) => m.id !== mark.id));
    const p = paras.current[mark.para];
    const layer = layers.current[mark.para];
    if (reduce || !p || !layer) return drop();
    const hue = HUES[mark.hue];
    const ms = playWave(
      p,
      layer,
      mark.id,
      hue,
      { ink: base(mark.para), wash: CLEAR },
      hue.swatch,
      true,
    );
    window.setTimeout(drop, ms);
  };

  /** a press on a mark that is not the end of a drag opens the palette on it */
  const openMark = (id: number, viaKey: boolean) => {
    if (!viaKey && !window.getSelection()?.isCollapsed) return;
    setOpen({ kind: "edit", id, viaKey });
  };

  // a palette opened from the keyboard takes focus to its current colour
  useEffect(() => {
    if (open?.kind !== "edit" || !open.viaKey) return;
    pop.current
      ?.querySelector<HTMLElement>('[aria-pressed="true"]')
      ?.focus({ preventScroll: true });
  }, [open]);

  const focusPara =
    open?.kind === "new"
      ? open.para
      : open
        ? (marks.find((m) => m.id === open.id)?.para ?? null)
        : null;
  const current =
    open?.kind === "edit" ? marks.find((m) => m.id === open.id) : undefined;
  const ordered = [...marks].sort(
    (a, b) => a.para - b.para || a.start - b.start,
  );

  return (
    <TooltipProvider delayDuration={200}>
      <div
        ref={stage}
        className={cn(
          "@container relative flex min-h-78 w-full flex-col justify-center gap-6 px-8 py-12 sm:px-14",
          // the lab's own grey, with its own hairline, since this fill covers
          // the frame's inset ring
          "rounded-lg bg-surface/60 ring-1 ring-stroke ring-inset",
        )}
      >
        {NOTES.map((text, i) => (
          <p
            // biome-ignore lint/suspicious/noArrayIndexKey: the notes are a fixed list
            key={i}
            ref={(el) => {
              paras.current[i] = el;
            }}
            className={cn(
              "relative isolate transition-opacity duration-200",
              // off the type scale, the standing printed type on a drawn object
              // has: it tracks the stage, so a phone still gets a column worth
              // selecting. On the paragraph, since `cqw` on the container itself
              // would resolve against the one above it
              "text-[clamp(1rem,3.3cqw,1.2rem)] text-text-secondary leading-[1.75]",
              // kerning off, so a run split into characters for the wave sets at
              // exactly the width it had as plain text and nothing reflows
              "[font-kerning:none] [font-variant-ligatures:none]",
              focusPara !== null && focusPara !== i && "opacity-35",
            )}
          >
            <span
              ref={(el) => {
                layers.current[i] = el;
              }}
              aria-hidden="true"
              className="-z-10 pointer-events-none absolute inset-0"
            />
            {segments(
              text,
              marks.filter((m) => m.para === i),
            ).map((seg) =>
              seg.mark ? (
                <Mark
                  key={`m${seg.mark.id}`}
                  mark={seg.mark}
                  text={seg.text}
                  onOpen={openMark}
                />
              ) : (
                seg.text
              ),
            )}
          </p>
        ))}

        <AnimatePresence>
          {open && (
            <motion.div
              ref={pop}
              key="palette"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1, transition: ENTER }}
              exit={{ opacity: 0, scale: 0.98, transition: LEAVE }}
              onPointerDown={(e) => e.preventDefault()}
              className="group absolute z-20 flex select-none items-stretch gap-3 rounded-xl border border-stroke bg-bg p-3"
              style={{ boxShadow: LIFT }}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "-translate-x-1/2 absolute left-(--ax) size-2.5 rotate-45 border-stroke bg-bg",
                  "group-data-[side=top]:-bottom-1.5 group-data-[side=top]:border-r group-data-[side=top]:border-b",
                  "group-data-[side=bottom]:-top-1.5 group-data-[side=bottom]:border-t group-data-[side=bottom]:border-l",
                )}
              />

              <fieldset className="m-0 grid min-w-0 grid-cols-3 content-start gap-4 border-0 p-0">
                <legend className="sr-only">Highlight colour</legend>
                {HUES.map((hue, i) => (
                  <button
                    key={hue.name}
                    type="button"
                    aria-label={hue.name}
                    aria-pressed={current?.hue === i}
                    onClick={() => pick(i)}
                    style={
                      {
                        backgroundColor: hue.swatch,
                        "--hue": hue.swatch,
                      } as CSSProperties
                    }
                    className={cn(
                      "relative size-6 cursor-pointer rounded-full",
                      "outline-2 outline-transparent outline-offset-2 transition-[outline-color] duration-150",
                      "hover:outline-[color-mix(in_srgb,var(--hue)_35%,transparent)] aria-pressed:outline-(--hue)",
                      FOCUS,
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 rounded-full ring-1 ring-text-primary/10 ring-inset"
                    />
                  </button>
                ))}
                <Tooltip label="Remove highlight">
                  <button
                    type="button"
                    aria-label="Remove highlight"
                    disabled={!current}
                    onClick={remove}
                    className={cn(
                      "flex size-6 cursor-pointer items-center justify-center rounded-full border border-stroke-strong text-text-muted",
                      "transition-all duration-150 hover:bg-fill hover:text-text-primary active:bg-fill-hover",
                      "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-text-muted",
                      FOCUS,
                    )}
                  >
                    <EraserIcon aria-hidden="true" className="size-3.5" />
                  </button>
                </Tooltip>
              </fieldset>

              <span aria-hidden="true" className="w-px shrink-0 bg-stroke" />

              <div className="flex w-32 min-w-0 flex-col gap-0.5 sm:w-40">
                {ordered.length === 0 ? (
                  <p className="px-2 py-1 text-meta text-text-muted">
                    No highlights yet
                  </p>
                ) : (
                  <ul className="-mr-1 flex max-h-28 flex-col gap-0.5 overflow-y-auto pr-1">
                    {ordered.map((m) => (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={() => {
                            window.getSelection()?.removeAllRanges();
                            setOpen({ kind: "edit", id: m.id, viaKey: false });
                            request(m.id, HUES[m.hue], m.hue);
                          }}
                          className={cn(
                            "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-left text-meta text-text-secondary",
                            "transition-all duration-150 hover:bg-fill hover:text-text-primary active:bg-fill-hover",
                            m.id === current?.id && "bg-fill text-text-primary",
                            FOCUS,
                          )}
                        >
                          <span
                            aria-hidden="true"
                            className="h-3 w-0.5 shrink-0 rounded-full"
                            style={{ backgroundColor: HUES[m.hue].swatch }}
                          />
                          <span className="truncate">
                            {NOTES[m.para].slice(m.start, m.end)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <p aria-live="polite" className="sr-only">
          {said}
        </p>
      </div>
    </TooltipProvider>
  );
}

/**
 * One mark: an inline span, so its line fragments are what the bars are drawn
 * from, holding its words whole and each word's characters as inline blocks the
 * wave can move. A word is `nowrap` so the line can only break where the prose
 * already could.
 */
function Mark({
  mark,
  text,
  onOpen,
}: {
  mark: Highlight;
  text: string;
  onOpen: (id: number, viaKey: boolean) => void;
}) {
  const hue = HUES[mark.hue];
  // each word with its offset into the paragraph, which the wave reads to find
  // the colour a character had before it
  let cursor = mark.start;
  const words = text.split(/(\s+)/).map((part) => {
    const at = cursor;
    cursor += part.length;
    return { part, at };
  });
  const key = (e: KeyboardEvent) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    onOpen(mark.id, true);
  };
  return (
    // biome-ignore lint/a11y/useSemanticElements: a <button> cannot wrap across lines inside a paragraph the way an inline span does
    <span
      role="button"
      tabIndex={0}
      aria-label={`Highlight in ${hue.name}: ${text}`}
      data-hl={mark.id}
      data-wash={hue.wash}
      onClick={() => onOpen(mark.id, false)}
      onKeyDown={key}
      // the focus mark is an outline in the mark's own ink, since the ring's
      // white offset band would paint over the bar's ends
      className="cursor-pointer rounded-[0.22em] outline-none focus-visible:outline-2 focus-visible:outline-current focus-visible:outline-offset-2"
      style={{ color: hue.ink }}
    >
      {words.map(({ part, at }, i) =>
        /^\s+$/.test(part) || part === "" ? (
          part
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: a mark's words only change when the mark does, and it remounts then
          <span key={i} className="whitespace-nowrap">
            {[...part].map((ch, j) => (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: a character's place in its word is its identity
                key={j}
                data-ch=""
                data-at={at + j}
                className="inline-block origin-[50%_70%]"
                // set on the character, never inherited: Chrome keeps the
                // inherited colour an element had while it was animating, so a
                // mark recoloured mid-wave left its characters in the old ink
                style={{ color: hue.ink }}
              >
                {ch}
              </span>
            ))}
          </span>
        ),
      )}
    </span>
  );
}
