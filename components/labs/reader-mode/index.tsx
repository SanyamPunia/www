"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  type CSSProperties,
  type MouseEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import {
  FileTextIcon,
  MinusIcon,
  PlusIcon,
  TextAaIcon,
} from "@/components/icons";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ARTICLE } from "./article";
import {
  DEFAULT_LOOK,
  type Look,
  MOVE_EASE,
  MOVE_MS,
  Page,
  SIZES,
  THEMES,
  WIDTHS,
} from "./page";

/** The window stands on the stage and the address is cut into its bar */
const RAISED =
  "inset 0 1px 0 rgb(255 255 255), inset 0 -1px 0 rgb(0 0 0 / 0.04), 0 1px 2px rgb(0 0 0 / 0.08), 0 6px 12px -4px rgb(0 0 0 / 0.1), 0 20px 36px -14px rgb(0 0 0 / 0.16)";
const WELL =
  "inset 0 1px 3px rgb(0 0 0 / 0.13), inset 0 1px 1px rgb(0 0 0 / 0.05), 0 1px 0 rgb(255 255 255)";
/** the reading line, as a share of the view from its top. It is what holds still */
const LINE = 0.3;
/** the drawer curve, so a block answers the press in its first frames */
const EASE = MOVE_EASE;
const FLIP_MS = MOVE_MS;
/** how far past the view a block may be and still glide rather than fade in */
const REACH = 40;

const BUTTON =
  "grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-text-secondary transition-all duration-150 hover:bg-fill hover:text-text-primary active:bg-fill-hover disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2";

/** a reader's own scrolling, which ends a hold */
const HAND = ["wheel", "touchstart", "pointerdown", "keydown"] as const;

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

export default function ReaderMode() {
  const reduce = useReducedMotion();
  const stage = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const ghosts = useRef<HTMLDivElement>(null);
  const marker = useRef<HTMLSpanElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const aa = useRef<HTMLButtonElement>(null);
  /** stops the frame loop holding the reading line, if one is running */
  const holding = useRef<(() => void) | null>(null);

  const [reader, setReader] = useState(false);
  const [look, setLook] = useState<Look>(DEFAULT_LOOK);
  const [settings, setSettings] = useState(false);
  const [status, setStatus] = useState("");

  /**
   * Every change of layout goes through here: the toggle and all three
   * settings. It finds the block on the reading line and how far down it the
   * line falls, makes the change, and scrolls so that same point is back on the
   * line. Then each block glides from where it was drawn to where it is now.
   */
  const change = (nextReader: boolean, nextLook: Look) => {
    const s = scroller.current;
    const root = inner.current;
    if (!s || !root) return;
    const view = s.getBoundingClientRect();
    const lineY = view.top + s.clientHeight * LINE;
    const blocks = [...root.querySelectorAll<HTMLElement>("[data-read]")];

    const sheet = root.querySelector<HTMLElement>("[data-sheet]");
    const faders = [...root.querySelectorAll<HTMLElement>("[data-clutter]")];

    // measured where they are drawn, mid-glide included, then let go
    const before = blocks.map((b) => b.getBoundingClientRect());
    const sheetBefore = sheet?.getBoundingClientRect();
    const sheetShown = sheet ? Number(getComputedStyle(sheet).opacity) : 0;
    for (const el of [...blocks, ...faders, ...(sheet ? [sheet] : [])])
      for (const a of el.getAnimations()) a.cancel();

    // at the very top there is nothing being read yet, so the top is kept
    let anchor = -1;
    let frac = 0;
    if (s.scrollTop > 2) {
      anchor = before.findIndex((r) => r.bottom > lineY);
      if (anchor >= 0) {
        const r = before[anchor];
        frac = clamp((lineY - r.top) / r.height, 0, 1);
      }
    }

    // what reader mode drops is copied where it stands and faded out, since the
    // real nodes are display: none from the next frame
    const layer = ghosts.current;
    const leaving: HTMLElement[] = [];
    if (nextReader && !reader && layer && !reduce) {
      const lr = layer.getBoundingClientRect();
      for (const c of root.querySelectorAll<HTMLElement>("[data-clutter]")) {
        const r = c.getBoundingClientRect();
        if (!r.width || r.bottom < view.top || r.top > view.bottom) continue;
        const g = c.cloneNode(true) as HTMLElement;
        g.removeAttribute("data-clutter");
        Object.assign(g.style, {
          position: "absolute",
          left: `${r.left - lr.left}px`,
          top: `${r.top - lr.top}px`,
          width: `${r.width}px`,
          height: `${r.height}px`,
          margin: "0",
        });
        leaving.push(g);
      }
    }
    const arriving = !nextReader && reader;

    flushSync(() => {
      setReader(nextReader);
      setLook(nextLook);
    });

    // the point on the reading line goes back on the reading line, and stays
    // there on every frame while the text size and the width are still moving.
    // Read from layout, so the glides' own transforms do not move it
    holding.current?.();
    const el = anchor >= 0 ? blocks[anchor] : null;
    const place = () => {
      if (!el) {
        s.scrollTop = 0;
        return;
      }
      let x = 0;
      let y = 0;
      for (
        let n: HTMLElement | null = el;
        n && n !== s;
        n = n.offsetParent as HTMLElement | null
      ) {
        x += n.offsetLeft;
        y += n.offsetTop;
      }
      const at = y + frac * el.offsetHeight;
      const max = s.scrollHeight - s.clientHeight;
      s.scrollTop = clamp(at - s.clientHeight * LINE, 0, max);
      // the bar beside the held line rides with its paragraph
      const m = marker.current;
      if (m) {
        const lh = Number.parseFloat(getComputedStyle(el).lineHeight) || 22;
        m.style.left = `${x - root.offsetLeft - 10}px`;
        m.style.top = `${at - root.offsetTop - lh / 2}px`;
        m.style.height = `${lh}px`;
      }
    };
    place();
    if (!reduce) {
      const end = performance.now() + FLIP_MS + 80;
      let raf = 0;
      // the reader scrolling takes the page back
      const stop = () => {
        cancelAnimationFrame(raf);
        for (const t of HAND) s.removeEventListener(t, stop);
        holding.current = null;
      };
      const tick = () => {
        place();
        if (performance.now() < end) raf = requestAnimationFrame(tick);
        else stop();
      };
      for (const t of HAND) s.addEventListener(t, stop, { passive: true });
      raf = requestAnimationFrame(tick);
      holding.current = stop;
    }

    if (reduce) return;
    const after = blocks.map((b) => b.getBoundingClientRect());
    const off = (r: DOMRect) =>
      r.bottom < view.top - REACH || r.top > view.bottom + REACH;
    blocks.forEach((b, i) => {
      const a = before[i];
      const z = after[i];
      const dx = a.left - z.left;
      const dy = a.top - z.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && a.width === z.width)
        return;
      if (off(z)) return;
      // a block that comes from out of view would fly across the page, so it
      // rises a little into place instead
      if (off(a)) {
        b.animate(
          [
            { opacity: 0, transform: `translateY(${Math.sign(dy) * 16}px)` },
            { opacity: 1, transform: "none" },
          ],
          { duration: FLIP_MS, easing: EASE },
        );
        return;
      }
      let from = `translate(${dx}px, ${dy}px)`;
      if (b.hasAttribute("data-scale") && z.width && z.height)
        from += ` scale(${a.width / z.width}, ${a.height / z.height})`;
      b.animate(
        [
          { transform: from, transformOrigin: "0 0" },
          { transform: "none", transformOrigin: "0 0" },
        ],
        { duration: FLIP_MS, easing: EASE },
      );
    });

    // the sheet glides from the box it was drawn at to its new one on the same
    // clock, so its edges move with the text inside it. Its insets animate,
    // never a scale, which would stretch its corner and its shadow
    if (sheet && sheetBefore) {
      const z = sheet.getBoundingClientRect();
      const d = [
        sheetBefore.top - z.top,
        z.right - sheetBefore.right,
        z.bottom - sheetBefore.bottom,
        sheetBefore.left - z.left,
      ];
      const inset = d.map((v) => `${v}px`).join(" ");
      const still =
        d.every((v) => Math.abs(v) < 0.5) &&
        sheetShown === (nextReader ? 1 : 0);
      // a theme change moves nothing, and is the colours' transition alone
      if (!still)
        sheet.animate(
          [
            { inset, opacity: sheetShown },
            { inset: "0px", opacity: nextReader ? 1 : 0 },
          ],
          { duration: FLIP_MS, easing: EASE },
        );
    }

    // what arrives with the change, the reading time, fades in on the same clock
    for (const el of root.querySelectorAll<HTMLElement>("[data-appear]"))
      if (!reader && nextReader)
        el.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: FLIP_MS,
          easing: EASE,
        });

    if (layer) {
      for (const g of leaving) {
        layer.append(g);
        g.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: FLIP_MS / 2,
          easing: EASE,
          fill: "forwards",
        }).finished.then(
          () => g.remove(),
          () => g.remove(),
        );
      }
    }

    if (arriving) {
      for (const c of faders) {
        const r = c.getBoundingClientRect();
        if (r.bottom < view.top || r.top > view.bottom) continue;
        c.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: FLIP_MS,
          easing: EASE,
        });
      }
    }

    // a short mark beside the line that held still, so the reader can see it did
    const m = marker.current;
    if (m && anchor >= 0) {
      m.animate(
        [{ opacity: 0 }, { opacity: 1 }, { opacity: 1 }, { opacity: 0 }],
        {
          duration: 1300,
          delay: 220,
          easing: "ease-out",
        },
      );
    }
  };

  const toggle = () => {
    const next = !reader;
    if (!next) setSettings(false);
    change(next, look);
    setStatus(next ? "Reader mode on" : "Reader mode off");
  };

  const set = (patch: Partial<Look>) => change(reader, { ...look, ...patch });

  // the panel closes on Escape and on a press outside it, and a keyboard close
  // hands focus back to the button that opened it
  const panelOpen = useRef(settings);
  useLayoutEffect(() => {
    panelOpen.current = settings;
  });
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key !== "Escape" ||
        !panelOpen.current ||
        !el.contains(document.activeElement)
      )
        return;
      e.preventDefault();
      setSettings(false);
      aa.current?.focus();
    };
    const onDown = (e: PointerEvent) => {
      if (!panelOpen.current) return;
      const t = e.target as Node;
      if (panel.current?.contains(t) || aa.current?.contains(t)) return;
      setSettings(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, []);

  const theme = THEMES[look.theme];
  const vars = {
    "--rd-ink": theme.ink,
    "--rd-soft": theme.soft,
    "--rd-muted": theme.muted,
    "--rd-sheet": theme.sheet,
    "--rd-lift": theme.lift,
  } as CSSProperties;

  const onAa = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setSettings((o) => !o);
  };

  return (
    <div
      ref={stage}
      className="h-[31rem] w-full min-w-0 rounded-lg sm:h-[34rem] bg-fill p-4 ring-1 ring-stroke ring-inset sm:p-6"
    >
      <TooltipProvider delayDuration={500}>
        <div
          className="relative flex size-full flex-col overflow-clip rounded-xl bg-bg outline outline-stroke"
          style={{ boxShadow: RAISED }}
        >
          <div className="flex h-12 shrink-0 items-center gap-1 border-stroke border-b px-2.5">
            <div
              className="mr-1 flex h-8 min-w-0 flex-1 items-center rounded-lg bg-fill px-3"
              style={{ boxShadow: WELL }}
            >
              <span className="min-w-0 truncate text-body leading-tight">
                <span className="text-text-primary">{ARTICLE.host}</span>
                <span className="text-text-muted">{ARTICLE.path}</span>
              </span>
            </div>
            <AnimatePresence initial={false}>
              {reader && (
                <motion.div
                  key="aa"
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: "auto" }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{
                    duration: reduce ? 0 : MOVE_MS / 1000,
                    ease: [0.32, 0.72, 0, 1],
                  }}
                  className="overflow-hidden p-1"
                >
                  <Tooltip label="Reader settings">
                    <button
                      ref={aa}
                      type="button"
                      aria-label="Reader settings"
                      aria-expanded={settings}
                      aria-controls="reader-settings"
                      onClick={onAa}
                      className={cn(
                        BUTTON,
                        "aria-expanded:bg-fill aria-expanded:text-text-primary",
                      )}
                    >
                      <TextAaIcon className="size-4" />
                    </button>
                  </Tooltip>
                </motion.div>
              )}
            </AnimatePresence>

            <Tooltip label={reader ? "Hide reader" : "Show reader"}>
              <button
                type="button"
                aria-label="Reader mode"
                aria-pressed={reader}
                onClick={toggle}
                className={cn(
                  BUTTON,
                  "aria-pressed:bg-text-primary aria-pressed:text-bg aria-pressed:hover:bg-text-primary/85 aria-pressed:active:bg-text-primary/75",
                )}
              >
                <FileTextIcon className="size-4" />
              </button>
            </Tooltip>
            <AnimatePresence>
              {settings && (
                <motion.div
                  ref={panel}
                  id="reader-settings"
                  role="dialog"
                  aria-label="Reader settings"
                  initial={{ opacity: 0, y: -4, scale: 0.97 }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    transition: { duration: 0.18, ease: [0.23, 1, 0.32, 1] },
                  }}
                  exit={{
                    opacity: 0,
                    y: -4,
                    scale: 0.97,
                    transition: { duration: 0.12 },
                  }}
                  className="absolute top-13 right-2.5 z-20 flex w-80 sm:right-14 origin-top-right flex-col gap-3 rounded-xl bg-bg p-3 outline outline-stroke"
                  style={{ boxShadow: RAISED }}
                >
                  <Settings look={look} set={set} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="relative min-h-0 flex-1">
            <section
              ref={scroller}
              aria-label="Page"
              // biome-ignore lint/a11y/noNoninteractiveTabindex: a scroll region needs focus for the arrow and page keys to scroll it
              tabIndex={0}
              style={vars}
              className={cn(
                // grey in both modes, so the cards stand on it and a theme
                // colours the sheet alone
                "peer relative size-full overflow-y-auto overscroll-contain bg-fill px-4 pt-5 pb-10 outline-none [overflow-anchor:none] [scrollbar-width:thin] sm:px-8",
              )}
            >
              <div ref={inner} className="relative">
                <span
                  ref={marker}
                  aria-hidden="true"
                  className="pointer-events-none absolute w-0.5 rounded-full bg-(--rd-muted) opacity-0"
                />
                <Page reader={reader} look={look} />
              </div>
            </section>
            <div
              ref={ghosts}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 overflow-clip"
            />
            {/* an inset ring on a scroller paints under its own children */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-b-xl opacity-0 ring-2 ring-text-secondary ring-inset peer-focus-visible:opacity-100"
            />
          </div>
        </div>
      </TooltipProvider>
      <span role="status" className="sr-only">
        {status}
      </span>
    </div>
  );
}

const SEGMENT =
  "block cursor-pointer rounded-md px-2 py-1 text-meta text-text-secondary transition-all duration-150 hover:text-text-primary peer-checked:bg-bg peer-checked:text-text-primary peer-checked:outline peer-checked:outline-stroke peer-focus-visible:ring-2 peer-focus-visible:ring-text-primary/15";

function Settings({
  look,
  set,
}: {
  look: Look;
  set: (patch: Partial<Look>) => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="text-meta text-text-secondary">Text size</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Smaller text"
            disabled={look.size === 0}
            onClick={() => set({ size: look.size - 1 })}
            className={cn(BUTTON, "size-7")}
          >
            <MinusIcon className="size-3.5" />
          </button>
          <span className="w-9 text-center text-meta text-text-primary tabular-nums">
            {SIZES[look.size]}px
          </span>
          <button
            type="button"
            aria-label="Larger text"
            disabled={look.size === SIZES.length - 1}
            onClick={() => set({ size: look.size + 1 })}
            className={cn(BUTTON, "size-7")}
          >
            <PlusIcon className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span id="reader-width" className="text-meta text-text-secondary">
          Width
        </span>
        <div
          role="radiogroup"
          aria-labelledby="reader-width"
          className="flex gap-0.5 rounded-lg bg-fill p-0.5"
        >
          {WIDTHS.map((wd, i) => (
            <label key={wd.name}>
              <input
                type="radio"
                name="reader-width"
                className="peer sr-only"
                checked={look.width === i}
                onChange={() => set({ width: i })}
              />
              <span className={SEGMENT}>{wd.name}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span id="reader-theme" className="text-meta text-text-secondary">
          Theme
        </span>
        <div
          role="radiogroup"
          aria-labelledby="reader-theme"
          className="flex gap-3 pr-1"
        >
          {THEMES.map((t, i) => (
            <label key={t.name} className="cursor-pointer">
              <input
                type="radio"
                name="reader-theme"
                aria-label={t.name}
                className="peer sr-only"
                checked={look.theme === i}
                onChange={() => set({ theme: i })}
              />
              <span
                className="block size-5 rounded-full ring-1 ring-stroke-strong ring-offset-2 transition-all duration-150 peer-checked:ring-2 peer-checked:ring-text-primary peer-focus-visible:outline-2 peer-focus-visible:outline-text-primary/30 peer-focus-visible:outline-offset-4"
                style={{ background: t.sheet }}
              />
            </label>
          ))}
        </div>
      </div>
    </>
  );
}
