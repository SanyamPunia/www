"use client";

import {
  AnimatePresence,
  animate,
  type MotionValue,
  motion,
  motionValue,
  useReducedMotion,
} from "motion/react";
import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { TextMorph } from "torph/react";
import { ArrowCounterClockwiseIcon, PlusIcon, XIcon } from "@/components/icons";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  canOpen,
  NARROW,
  NEW_TAB,
  PAGES,
  type Page,
  ROOMY,
  SITE,
  START,
  START_ACTIVE,
  tabWidth,
} from "./tabs";

interface Tab {
  id: number;
  page: Page;
}

/**
 * The window's three controls, in the colours macOS gives them. Scoped here,
 * not tokens: they are the platform's, the way a brand mark's colour is.
 */
const LIGHTS = ["#ff5f57", "#febc2e", "#28c840"] as const;
const WIDTH = { duration: 0.2, ease: [0.23, 1, 0.32, 1] } as const;
/** how tabs slide out of a dragged tab's way and how it lands */
const SLIDE = { type: "spring", stiffness: 520, damping: 42 } as const;
/** a press has to travel this far sideways before it drags */
const SLOP = 4;
/** how long a reopened tab spins before its page arrives */
const LOAD = 700;
/** a pointer resting on a tab this long opens its hover card */
const CARD_DELAY = 500;
/** a card closed this recently opens again without the wait */
const WARM = 300;
/**
 * A pointer resting this long on a close button hides the card, before the
 * button's own tooltip opens. One only passing over it on the way to the next
 * tab keeps the card, so the card slides instead of closing and opening again.
 */
const CLOSE_REST = 350;
const CARD_W = 176;

/** The bar stands on the stage and the address is cut into the bar */
const RAISED =
  "inset 0 1px 0 rgb(255 255 255), 0 1px 2px rgb(0 0 0 / 0.08), 0 6px 12px -4px rgb(0 0 0 / 0.1), 0 20px 36px -14px rgb(0 0 0 / 0.16)";
const LIFT = "0 1px 2px rgb(0 0 0 / 0.08), 0 10px 24px -8px rgb(0 0 0 / 0.2)";
const WELL =
  "inset 0 1px 3px rgb(0 0 0 / 0.13), inset 0 1px 1px rgb(0 0 0 / 0.05), 0 1px 0 rgb(255 255 255)";

/**
 * The concave corner where the front tab meets the toolbar. A square of the
 * toolbar's colour with a circle cut out of its outer corner.
 */
function Flare({ side }: { side: "left" | "right" }) {
  const at = side === "left" ? "0 0" : "100% 0";
  return (
    <span
      aria-hidden="true"
      className={cn(
        "absolute bottom-0 size-2 bg-bg",
        side === "left" ? "-left-2" : "-right-2",
      )}
      style={{
        maskImage: `radial-gradient(circle at ${at}, transparent 0.4rem, black calc(0.4rem + 0.5px))`,
      }}
    />
  );
}

/** A ring with one arc on it, which is what a loading favicon looks like */
function Spinner() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
      className="size-4 motion-safe:animate-spin"
    >
      <circle cx="8" cy="8" r="6" opacity={0.2} />
      <path d="M8 2a6 6 0 0 1 6 6" />
    </svg>
  );
}

function TabItem({
  tab,
  width,
  x,
  active,
  carried,
  loading,
  lone,
  reduce,
  onSelect,
  onClose,
  onGrab,
  onMove,
  onHover,
  onCloseHover,
}: {
  tab: Tab;
  width: number;
  /** the tab's offset from its place in the row, for a drag and its landing */
  x: MotionValue<number>;
  active: boolean;
  carried: boolean;
  loading: boolean;
  /** the only tab left and a new tab, which cannot be closed */
  lone: boolean;
  reduce: boolean;
  onSelect: () => void;
  onClose: (byPointer: boolean) => void;
  onGrab: (e: ReactPointerEvent) => void;
  onMove: (step: -1 | 1) => void;
  onHover: (over: boolean, node: HTMLElement) => void;
  onCloseHover: (over: boolean) => void;
}) {
  const { page } = tab;
  const narrow = width < NARROW;

  return (
    <motion.div
      data-tab=""
      data-tab-id={tab.id}
      data-active={active || undefined}
      initial={{ width: 0 }}
      animate={{ width }}
      exit={{ width: 0, opacity: 0 }}
      transition={reduce ? { duration: 0 } : WIDTH}
      style={{ x }}
      onPointerEnter={(e) => {
        if (e.pointerType !== "touch") onHover(true, e.currentTarget);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType !== "touch") onHover(false, e.currentTarget);
      }}
      onAuxClick={(e) => {
        // a middle click closes, as in every browser
        if (e.button === 1 && !lone) onClose(true);
      }}
      className={cn(
        "group relative h-11 shrink-0 touch-pan-y",
        active && "z-10 rounded-t-lg bg-bg",
        carried && "z-20",
      )}
    >
      {active && (
        <>
          <Flare side="left" />
          <Flare side="right" />
        </>
      )}
      <span
        data-divider=""
        aria-hidden="true"
        className="absolute top-3 bottom-3 left-0 w-px bg-stroke-strong transition-opacity duration-150"
      />
      {/* the content sits in a box at the tab's own width, pinned to its left
          edge and clipped, so a tab growing or closing uncovers it or covers
          it and nothing inside moves sideways, the close button included */}
      <div className="absolute inset-0 overflow-hidden rounded-t-lg">
        <div className="absolute inset-y-0 left-0" style={{ width }}>
          {!active && (
            <span
              aria-hidden="true"
              className="absolute inset-x-1 inset-y-1.5 rounded-md transition-colors duration-150 group-hover:bg-surface"
            />
          )}
          <button
            type="button"
            role="tab"
            data-select=""
            aria-selected={active}
            aria-label={page.title}
            onClick={onSelect}
            onPointerDown={onGrab}
            onKeyDown={(e) => {
              // Chrome's own keys for moving a tab, plus an arrow pair for a
              // keyboard with no page keys
              const back =
                (e.ctrlKey && e.shiftKey && e.key === "PageUp") ||
                (e.altKey && e.shiftKey && e.key === "ArrowLeft");
              const ahead =
                (e.ctrlKey && e.shiftKey && e.key === "PageDown") ||
                (e.altKey && e.shiftKey && e.key === "ArrowRight");
              if (back || ahead) {
                e.preventDefault();
                onMove(back ? -1 : 1);
                return;
              }
              if (!lone && (e.key === "Delete" || e.key === "Backspace")) {
                e.preventDefault();
                onClose(false);
              }
            }}
            className={cn(
              "absolute inset-0 flex cursor-pointer items-center gap-2 rounded-t-lg pl-3.5 text-left text-action [font-kerning:none] [font-variant-ligatures:none]",
              // a hover reveals the close button, so the title gives up its room
              active || width >= ROOMY
                ? "pr-9"
                : "pr-2.5 transition-[padding] duration-150",
              !narrow &&
                !active &&
                width < ROOMY &&
                "group-focus-within:pr-9 group-hover:pr-9",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-inset",
              active ? "text-text-primary" : "text-text-secondary",
              narrow && "justify-center px-0",
            )}
          >
            {/* keyed by page, so a tab that changes page in place, the last
                one closing into a new tab, swaps its face rather than its box */}
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                key={page.title}
                initial={{ opacity: 0, y: 3 }}
                animate={{
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.1, ease: [0.23, 1, 0.32, 1] },
                }}
                exit={{ opacity: 0, transition: { duration: 0.06 } }}
                className="flex min-w-0 items-center gap-2"
              >
                <span
                  className={cn(
                    "relative grid size-4 shrink-0 translate-y-[0.09em] transition-opacity duration-150",
                    narrow && active && "opacity-0",
                    narrow && !active && "group-hover:opacity-0",
                  )}
                >
                  {/* the page's icon arrives in the spinner's place */}
                  <AnimatePresence initial={false} mode="popLayout">
                    <motion.span
                      key={loading ? "loading" : "icon"}
                      initial={{ opacity: 0, scale: 0.6 }}
                      animate={{
                        opacity: 1,
                        scale: 1,
                        transition: {
                          duration: 0.18,
                          ease: [0.23, 1, 0.32, 1],
                        },
                      }}
                      exit={{
                        opacity: 0,
                        scale: 0.6,
                        transition: { duration: 0.1 },
                      }}
                      className="grid size-4 place-items-center"
                    >
                      {loading ? <Spinner /> : <page.Icon className="size-4" />}
                    </motion.span>
                  </AnimatePresence>
                </span>
                {!narrow && (
                  <span className="min-w-0 overflow-hidden whitespace-nowrap [mask-image:linear-gradient(to_right,black_70%,transparent)]">
                    {page.title}
                  </span>
                )}
              </motion.span>
            </AnimatePresence>
          </button>
          <Tooltip label="Close tab" side="bottom">
            <button
              type="button"
              data-close=""
              aria-label={`Close ${page.title}`}
              onClick={(e) => onClose(e.detail > 0)}
              onPointerEnter={() => onCloseHover(true)}
              onPointerLeave={() => onCloseHover(false)}
              className={cn(
                "absolute top-1/2 grid size-6 -translate-y-1/2 cursor-pointer place-items-center rounded-md text-text-secondary transition-all duration-150",
                "hover:bg-fill-hover hover:text-text-primary active:bg-fill-active",
                "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15",
                narrow ? "left-1/2 -translate-x-1/2" : "right-2",
                lone && "hidden",
                active || width >= ROOMY
                  ? "opacity-100"
                  : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100",
              )}
            >
              <XIcon className="size-3 translate-y-[0.09em]" />
            </button>
          </Tooltip>
        </div>
      </div>
    </motion.div>
  );
}

export default function TabStrip() {
  const [tabs, setTabs] = useState<Tab[]>(() =>
    START.map((page, id) => ({ id, page: PAGES[page] })),
  );
  const [active, setActive] = useState(START_ACTIVE);
  const [room, setRoom] = useState(0);
  /** the width tabs hold while a pointer is closing them, or null */
  const [frozen, setFrozen] = useState<number | null>(null);
  const [closed, setClosed] = useState<{ tab: Tab; index: number }[]>([]);
  const nextId = useRef(START.length);
  const strip = useRef<HTMLDivElement>(null);
  const focusAfter = useRef<number | null>(null);
  const reduce = useReducedMotion() ?? false;
  const bar = useRef<HTMLDivElement>(null);

  /** each tab's offset from its place, owned here so a reorder can rebase it */
  const offsets = useRef(new Map<number, MotionValue<number>>());
  const offsetOf = (id: number) => {
    let value = offsets.current.get(id);
    if (!value) {
      value = motionValue(0);
      offsets.current.set(id, value);
    }
    return value;
  };
  /** the id of the tab in the hand, for what renders differently */
  const [carry, setCarry] = useState<number | null>(null);
  const drag = useRef<{
    id: number;
    pointer: number;
    startX: number;
    startY: number;
    from: number;
    to: number;
    live: boolean;
  } | null>(null);

  const [loading, setLoading] = useState<ReadonlySet<number>>(new Set());
  const loadTimers = useRef(new Set<number>());

  const [card, setCard] = useState<{
    id: number;
    left: number;
    top: number;
  } | null>(null);
  const cardTimer = useRef(0);
  const cardClosedAt = useRef(-Infinity);

  useEffect(() => {
    const timers = loadTimers.current;
    return () => {
      for (const t of timers) clearTimeout(t);
      clearTimeout(cardTimer.current);
    };
  }, []);

  useLayoutEffect(() => {
    const node = strip.current;
    if (!node) return;
    // the tabs get what is left once the padding, the window controls and the
    // plus have taken theirs, all read off the strip so none is restated here
    const read = () => {
      const style = getComputedStyle(node);
      let fixed =
        parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      for (const child of node.querySelectorAll<HTMLElement>("[data-fixed]")) {
        const margin = getComputedStyle(child);
        fixed +=
          child.offsetWidth +
          parseFloat(margin.marginLeft) +
          parseFloat(margin.marginRight);
      }
      setRoom(node.clientWidth - fixed);
    };
    read();
    const observer = new ResizeObserver(() => {
      setFrozen(null);
      read();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // a keyboard close hands focus to the tab that took its place
  useEffect(() => {
    const id = focusAfter.current;
    if (id === null) return;
    focusAfter.current = null;
    strip.current
      ?.querySelector<HTMLElement>(`[data-tab-id="${id}"] [data-select]`)
      ?.focus();
  });

  const width = frozen ?? tabWidth(room, tabs.length);
  const current = tabs.find((t) => t.id === active)?.page ?? NEW_TAB;
  // read by the window listeners, which outlive the render they were bound in
  const live = useRef({ tabs, width });
  live.current = { tabs, width };

  const hideCard = () => {
    clearTimeout(cardTimer.current);
    setCard((c) => {
      if (c) cardClosedAt.current = performance.now();
      return null;
    });
  };

  const hover = (id: number, over: boolean, node: HTMLElement) => {
    clearTimeout(cardTimer.current);
    if (!over) {
      cardTimer.current = window.setTimeout(hideCard, 120);
      return;
    }
    if (drag.current?.live) return;
    const place = () => {
      const frame = bar.current?.getBoundingClientRect();
      const box = node.getBoundingClientRect();
      if (!frame) return;
      const left = Math.max(
        8,
        Math.min(box.left - frame.left, frame.width - CARD_W - 8),
      );
      setCard({ id, left, top: box.bottom - frame.top + 4 });
    };
    // a card already up, or just closed, moves to the next tab at once
    const warm =
      card !== null || performance.now() - cardClosedAt.current < WARM;
    if (warm) place();
    else cardTimer.current = window.setTimeout(place, CARD_DELAY);
  };

  /**
   * Puts the tabs in a new order and rebases every offset by how far its tab
   * moved in the row, so nothing jumps on the commit, then lets each one
   * spring home. The dragged tab's offset is where the hand left it.
   */
  const reorder = (next: Tab[]) => {
    const { tabs: before, width: w } = live.current;
    const was = new Map(before.map((t, i) => [t.id, i]));
    flushSync(() => setTabs(next));
    next.forEach((t, i) => {
      const value = offsetOf(t.id);
      const moved = (i - (was.get(t.id) ?? i)) * w;
      value.jump(value.get() - moved);
      if (value.get() !== 0) {
        animate(value, 0, reduce ? { duration: 0 } : SLIDE);
      }
    });
  };

  const move = (id: number, step: -1 | 1) => {
    const from = tabs.findIndex((t) => t.id === id);
    const to = from + step;
    if (from < 0 || to < 0 || to >= tabs.length) return;
    const next = [...tabs];
    next.splice(to, 0, ...next.splice(from, 1));
    focusAfter.current = id;
    reorder(next);
  };

  /** where every tab but the dragged one stands while `to` is the target */
  const shiftOthers = (from: number, to: number) => {
    const { tabs: row, width: w } = live.current;
    row.forEach((t, i) => {
      if (i === from) return;
      let shift = 0;
      if (from < to && i > from && i <= to) shift = -w;
      if (to < from && i >= to && i < from) shift = w;
      animate(offsetOf(t.id), shift, reduce ? { duration: 0 } : SLIDE);
    });
  };

  const endDrag = (commit: boolean) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    window.removeEventListener("pointermove", onDragMove);
    window.removeEventListener("pointerup", onDragUp);
    window.removeEventListener("pointercancel", onDragCancel);
    window.removeEventListener("keydown", onDragKey);
    window.removeEventListener("blur", onDragUp);
    if (!d.live) return;
    strip.current?.removeAttribute("data-carry");
    setCarry(null);
    const row = live.current.tabs;
    if (commit && d.to !== d.from) {
      const next = [...row];
      next.splice(d.to, 0, ...next.splice(d.from, 1));
      reorder(next);
      return;
    }
    for (const t of row) {
      animate(offsetOf(t.id), 0, reduce ? { duration: 0 } : SLIDE);
    }
  };

  // window listeners are plain functions read through refs, so they can be
  // removed by identity whatever render bound them
  const handlers = useRef({
    move: (_e: PointerEvent) => {},
    up: () => {},
    cancel: () => {},
    key: (_e: KeyboardEvent) => {},
  });
  handlers.current.move = (e) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointer) return;
    if (e.buttons === 0) {
      endDrag(true);
      return;
    }
    const dx = e.clientX - d.startX;
    if (!d.live) {
      if (Math.abs(e.clientY - d.startY) > Math.abs(dx) + SLOP) {
        endDrag(false);
        return;
      }
      if (Math.abs(dx) < SLOP) return;
      d.live = true;
      strip.current?.setAttribute("data-carry", "");
      hideCard();
      setFrozen(null);
      setActive(d.id);
      setCarry(d.id);
    }
    const { tabs: row, width: w } = live.current;
    const clamped = Math.max(
      -d.from * w,
      Math.min((row.length - 1 - d.from) * w, dx),
    );
    offsetOf(d.id).set(clamped);
    const to = Math.round(d.from + clamped / w);
    if (to !== d.to) {
      d.to = to;
      shiftOthers(d.from, to);
    }
  };
  handlers.current.up = () => endDrag(true);
  handlers.current.cancel = () => endDrag(false);
  handlers.current.key = (e) => {
    if (e.key === "Escape") endDrag(false);
  };
  const onDragMove = useRef((e: PointerEvent) =>
    handlers.current.move(e),
  ).current;
  const onDragUp = useRef(() => handlers.current.up()).current;
  const onDragCancel = useRef(() => handlers.current.cancel()).current;
  const onDragKey = useRef((e: KeyboardEvent) =>
    handlers.current.key(e),
  ).current;

  const grab = (id: number, e: ReactPointerEvent) => {
    if (e.button !== 0 || drag.current || tabs.length < 2) return;
    hideCard();
    const from = tabs.findIndex((t) => t.id === id);
    drag.current = {
      id,
      pointer: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      from,
      to: from,
      live: false,
    };
    window.addEventListener("pointermove", onDragMove);
    window.addEventListener("pointerup", onDragUp);
    window.addEventListener("pointercancel", onDragCancel);
    window.addEventListener("keydown", onDragKey);
    window.addEventListener("blur", onDragUp);
  };

  const close = (id: number, byPointer: boolean) => {
    const index = tabs.findIndex((t) => t.id === id);
    if (index < 0) return;
    const tab = tabs[index];
    hideCard();
    // a last tab holding a page gives way to a new tab. A last new tab
    // stays, since there is no window to close
    if (tabs.length === 1 && tab.page === NEW_TAB) return;
    // the last page closes in place: the same tab turns into a new tab, so
    // there is never a frame with one tab leaving and another arriving
    if (tabs.length === 1) {
      setTabs([{ id, page: NEW_TAB }]);
      setClosed((c) => [
        ...c,
        { tab: { ...tab, id: nextId.current++ }, index },
      ]);
      return;
    }
    const rest = tabs.filter((t) => t.id !== id);
    // the widths hold until the pointer leaves the strip, so the tab that
    // slides into this one's place brings its own close button under the hand
    if (byPointer && room > 0) setFrozen(width);
    const neighbour = rest[Math.min(index, rest.length - 1)];
    if (id === active) setActive(neighbour.id);
    if (!byPointer) focusAfter.current = neighbour.id;
    setTabs(rest);
    if (tab.page !== NEW_TAB) setClosed((c) => [...c, { tab, index }]);
  };

  const open = () => {
    if (!canOpen(room, tabs.length)) return;
    const tab = { id: nextId.current++, page: NEW_TAB };
    setFrozen(null);
    setTabs((t) => [...t, tab]);
    setActive(tab.id);
  };

  const reopen = () => {
    const last = closed.at(-1);
    if (!last || !canOpen(room, tabs.length)) return;
    setFrozen(null);
    setClosed((c) => c.slice(0, -1));
    setTabs((t) => {
      const next = [...t];
      next.splice(Math.min(last.index, next.length), 0, last.tab);
      return next;
    });
    setActive(last.tab.id);
    // a restored tab fetches its page again, so it spins before its icon
    if (reduce) return;
    const id = last.tab.id;
    setLoading((l) => new Set(l).add(id));
    const timer = window.setTimeout(() => {
      loadTimers.current.delete(timer);
      setLoading((l) => {
        const next = new Set(l);
        next.delete(id);
        return next;
      });
    }, LOAD);
    loadTimers.current.add(timer);
  };

  const cardPage = card && tabs.find((t) => t.id === card.id)?.page;
  const address = current.path === null ? null : `${SITE}${current.path}`;
  const full = !canOpen(room, tabs.length);

  return (
    <div className="grid aspect-8/5 min-h-56 w-full select-none place-items-center rounded-lg bg-linear-to-b from-surface to-fill-hover p-3 ring-1 ring-stroke ring-inset sm:p-6">
      <TooltipProvider delayDuration={600}>
        <div
          ref={bar}
          className="relative w-full rounded-xl bg-fill outline outline-stroke"
          style={{ boxShadow: RAISED }}
        >
          <div
            ref={strip}
            role="tablist"
            aria-label="Tabs"
            onPointerLeave={() => {
              setFrozen(null);
              hideCard();
            }}
            className={cn(
              "flex items-center px-2 pt-2 text-action",
              "data-carry:cursor-grabbing data-carry:[&_*]:cursor-grabbing",
              // a divider hides beside the front tab and beside a hovered one
              "[&>[data-fixed]+[data-tab]_[data-divider]]:opacity-0",
              "[&>[data-tab]:hover_[data-divider]]:opacity-0",
              "[&>[data-tab]:hover+[data-tab]_[data-divider]]:opacity-0",
              "[&>[data-active]_[data-divider]]:opacity-0",
              "[&>[data-active]+[data-tab]_[data-divider]]:opacity-0",
            )}
          >
            <div
              data-fixed=""
              aria-hidden="true"
              className="mr-2.5 ml-1.5 flex shrink-0 translate-y-[0.09em] gap-1.5"
            >
              {LIGHTS.map((colour) => (
                <span
                  key={colour}
                  className="size-3 rounded-full"
                  style={{
                    backgroundColor: colour,
                    boxShadow: "inset 0 0 0 0.5px rgb(0 0 0 / 0.18)",
                  }}
                />
              ))}
            </div>
            <AnimatePresence initial={false}>
              {tabs.map((tab) => (
                <TabItem
                  key={tab.id}
                  tab={tab}
                  width={width}
                  x={offsetOf(tab.id)}
                  active={tab.id === active}
                  carried={tab.id === carry}
                  loading={loading.has(tab.id)}
                  lone={tabs.length === 1 && tab.page === NEW_TAB}
                  reduce={reduce}
                  onSelect={() => setActive(tab.id)}
                  onClose={(byPointer) => close(tab.id, byPointer)}
                  onGrab={(e) => grab(tab.id, e)}
                  onMove={(step) => move(tab.id, step)}
                  onHover={(over, node) => hover(tab.id, over, node)}
                  onCloseHover={(over) => {
                    clearTimeout(cardTimer.current);
                    if (over) {
                      cardTimer.current = window.setTimeout(
                        hideCard,
                        CLOSE_REST,
                      );
                    }
                  }}
                />
              ))}
            </AnimatePresence>
            <Tooltip label="New tab" side="bottom">
              <button
                type="button"
                data-new=""
                data-fixed=""
                aria-label="New tab"
                aria-disabled={full || undefined}
                onClick={open}
                className={cn(
                  "ml-1 grid size-8 shrink-0 cursor-pointer place-items-center rounded-md text-text-secondary transition-all duration-150",
                  "hover:bg-fill-hover hover:text-text-primary active:bg-fill-active",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15",
                  full && "cursor-not-allowed opacity-50",
                )}
              >
                <PlusIcon className="size-3.5 translate-y-[0.09em]" />
              </button>
            </Tooltip>
          </div>

          <div className="flex items-center gap-2 rounded-b-xl bg-bg p-2">
            <Tooltip label="Reopen closed tab" side="bottom">
              <button
                type="button"
                data-reopen=""
                aria-label="Reopen closed tab"
                aria-disabled={closed.length === 0 || undefined}
                onClick={reopen}
                className={cn(
                  "grid size-11 shrink-0 cursor-pointer place-items-center rounded-lg text-action text-text-secondary transition-all duration-150",
                  "hover:bg-surface hover:text-text-primary active:bg-fill",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15",
                  closed.length === 0 &&
                    "cursor-not-allowed opacity-50 hover:bg-transparent hover:text-text-secondary",
                )}
              >
                <ArrowCounterClockwiseIcon className="size-4 translate-y-[0.09em]" />
              </button>
            </Tooltip>
            <div
              style={{ boxShadow: WELL }}
              className="flex h-11 min-w-0 flex-1 items-center gap-2.5 overflow-hidden whitespace-nowrap rounded-lg bg-fill px-3.5 text-action [font-kerning:none] [font-variant-ligatures:none] [text-transform:none]"
            >
              <current.Icon className="size-4 shrink-0 translate-y-[0.09em] text-text-secondary" />
              <span
                className={address ? "text-text-secondary" : "text-text-muted"}
              >
                <TextMorph duration={200} ease="cubic-bezier(0.4, 0, 0.2, 1)">
                  {address ?? "Search or type a URL"}
                </TextMorph>
              </span>
            </div>
          </div>
          <AnimatePresence>
            {card && cardPage && (
              <motion.div
                key="card"
                aria-hidden="true"
                data-card=""
                initial={{ opacity: 0, y: -4, x: card.left }}
                animate={{ opacity: 1, y: 0, x: card.left }}
                exit={{ opacity: 0, y: -2, transition: { duration: 0.1 } }}
                transition={
                  reduce
                    ? { duration: 0 }
                    : {
                        opacity: { duration: 0.15 },
                        y: { duration: 0.15, ease: [0.23, 1, 0.32, 1] },
                        x: SLIDE,
                      }
                }
                style={{ top: card.top, width: CARD_W, boxShadow: LIFT }}
                className="pointer-events-none absolute left-0 z-30 flex flex-col gap-0.5 rounded-lg bg-bg px-3 py-2.5 outline outline-stroke"
              >
                <span className="truncate text-action text-text-primary">
                  {cardPage.title}
                </span>
                <span className="truncate text-meta text-text-muted [text-transform:none]">
                  {cardPage.path === null
                    ? "New tab"
                    : `${SITE}${cardPage.path || "/"}`}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
          <span role="status" className="sr-only">
            {current.title}
          </span>
        </div>
      </TooltipProvider>
    </div>
  );
}
