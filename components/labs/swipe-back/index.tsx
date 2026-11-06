"use client";

import {
  type AnimationPlaybackControls,
  animate,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { TextMorph } from "torph/react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowsLeftRightIcon,
} from "@/components/icons";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { HOST, PAGES, type PageId, START, type Stop } from "./pages";
import { armSound, buzz, detent, swish } from "./swipe-sound";

/** The window stands on the stage and the address is cut into its bar */
const RAISED =
  "inset 0 1px 0 rgb(255 255 255), inset 0 -1px 0 rgb(0 0 0 / 0.04), 0 1px 2px rgb(0 0 0 / 0.08), 0 6px 12px -4px rgb(0 0 0 / 0.1), 0 20px 36px -14px rgb(0 0 0 / 0.16)";
const WELL =
  "inset 0 1px 3px rgb(0 0 0 / 0.13), inset 0 1px 1px rgb(0 0 0 / 0.05), 0 1px 0 rgb(255 255 255)";
/** the shadow a page casts on the one under it, seen only while it slides */
const EDGE = "-14px 0 28px -10px rgb(0 0 0 / 0.22)";
/** a predictive back card lifted off the page it is about to uncover */
const CARD = "0 10px 30px -8px rgb(0 0 0 / 0.3), 0 2px 6px rgb(0 0 0 / 0.08)";

/** The three back gestures, each a different reading of the same position */
const MODES = ["safari", "chrome", "android"] as const;
type Mode = (typeof MODES)[number];
const LABEL: Record<Mode, string> = {
  safari: "Safari",
  chrome: "Chrome",
  android: "Android",
};

/** how far a page behind sits to the left in Safari, as a share of the width */
const PARALLAX = 0.28;
/** the share of a page the hand has to cover for the swipe to arm, and to let go */
const ARM = 0.32;
const DISARM = 0.26;
/** a release faster than this, in pages a second, commits however short it was */
const FLICK = 1.1;
/** a wheel gesture ends after this long with no event */
const GAP = 140;
/** a press becomes a swipe past this many px, if it is mostly sideways */
const SLOP = 6;
/** how long Back or Forward is held before its history opens */
const HOLD = 450;
/** near critical, so a page lands without bouncing off the edge it slides to */
const SPRING = {
  type: "spring",
  stiffness: 340,
  damping: 34,
  restDelta: 0.0005,
  restSpeed: 0.005,
} as const;
/** the arrow's colour step, and its fade once the hand lets go */
const STEP = "background-color 150ms, color 150ms";
const FADE = `${STEP}, opacity 220ms ease-out, transform 220ms ease-out`;
/** the address and the buttons let go of a preview on this */
const SETTLE = "opacity 200ms ease-out, transform 200ms ease-out";
/** the address swapping on the detent, quick enough to answer it */
const SWAP = "opacity 120ms ease-out, transform 120ms ease-out";

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2";
const BUTTON = cn(
  "group relative grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-text-secondary transition-all duration-150 hover:bg-fill hover:text-text-primary active:bg-fill-hover aria-expanded:bg-fill aria-expanded:text-text-primary data-[armed=true]:text-text-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent touch-none select-none [-webkit-touch-callout:none]",
  FOCUS,
);

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

/** the UIScrollView rubber band, in pages, past either end of what one swipe may reach */
function band(raw: number, lo: number, hi: number): number {
  const rub = (x: number) => (1 - 1 / ((x * 0.55) / 0.4 + 1)) * 0.4;
  if (raw < lo) return lo - rub(lo - raw);
  if (raw > hi) return hi + rub(raw - hi);
  return raw;
}

interface Sample {
  t: number;
  p: number;
}

/** pages a second over the last 100ms before `at`, and none from a hand that stopped */
function velocity(samples: Sample[], at: number): number {
  const recent = samples.filter((s) => s.t >= at - 100);
  const first = recent[0];
  const last = recent.at(-1);
  if (!first || !last || last.t < at - 60) return 0;
  const dt = (last.t - first.t) / 1000;
  return dt > 0.01 ? (last.p - first.p) / dt : 0;
}

interface Hand {
  /** the entry the swipe started on */
  base: number;
  /** the position before the rubber band */
  raw: number;
  samples: Sample[];
  armed: boolean;
}

/** one visit in history. The key is per visit, so a page visited twice is two entries */
interface Entry {
  key: number;
  id: PageId;
}

const FIRST: Entry[] = START.map((id, key) => ({ key, id }));

export default function SwipeBack() {
  const reduce = useReducedMotion();
  const stage = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const layers = useRef<(HTMLDivElement | null)[]>([]);
  const shades = useRef<(HTMLSpanElement | null)[]>([]);
  const scrollers = useRef<(HTMLElement | null)[]>([]);
  const arrows = useRef<(HTMLSpanElement | null)[]>([null, null]);
  const buttons = useRef<(HTMLButtonElement | null)[]>([null, null]);
  const presses = useRef<(HTMLSpanElement | null)[]>([null, null]);
  const current = useRef<HTMLSpanElement>(null);
  const preview = useRef<HTMLSpanElement>(null);
  const menuEl = useRef<HTMLDivElement>(null);
  const width = useRef(1);
  const height = useRef(1);
  /** where the hand is down the page, so an arrow can ride beside it */
  const handY = useRef<number | null>(null);
  const hand = useRef<Hand | null>(null);
  const anim = useRef<AnimationPlaybackControls | null>(null);
  const wheel = useRef<{ axis: "x" | "y"; timer: number; done: boolean }>(null);
  const ptr = useRef<{
    id: number;
    x0: number;
    y0: number;
    p0: number;
    started: boolean;
  } | null>(null);
  /** a drag ends in a click on whatever it started on, which must do nothing */
  const dragged = useRef(false);
  const inside = useRef(false);
  /** a jump through several pages ticks at each one it passes */
  const jumping = useRef(false);
  const cell = useRef(0);
  const hold = useRef(0);
  /** a hold that opened history also ends in a click on its button */
  const swallow = useRef(false);
  /** history opened by a hold picks the entry the hand lets go on */
  const held = useRef(false);
  const pending = useRef<number | null>(null);
  const keySeq = useRef(FIRST.length);

  const [entries, setEntries] = useState(FIRST);
  const entriesRef = useRef(FIRST);
  const last = FIRST.length - 1;
  /** the position in history, in entries. Every page, arrow and preview reads it */
  const pos = useMotionValue(last);
  const [index, setIndex] = useState(last);
  const indexRef = useRef(last);
  const [mode, setMode] = useState<Mode>("safari");
  const modeRef = useRef<Mode>("safari");
  const [menu, setMenu] = useState<{ dir: -1 | 1; keys: boolean } | null>(null);
  /** a committed swipe already showed the new address, so it lands without a morph */
  const [addrKey, setAddrKey] = useState(0);
  const [status, setStatus] = useState("");
  /** which button's tooltip Radix wants open. None opens over its own menu */
  const [tip, setTip] = useState<-1 | 1 | null>(null);

  const paint = useCallback(() => {
    const p = pos.get();
    const w = width.current;
    const n = entriesRef.current.length;
    const m = modeRef.current;
    const h = hand.current;

    if (jumping.current) {
      const c = Math.round(p);
      if (c !== cell.current) {
        cell.current = c;
        detent(false);
      }
    }

    for (let i = 0; i < n; i++) {
      const el = layers.current[i];
      if (!el) continue;
      const d = i - p;
      let shown = d > -0.999 && d < 0.999;
      let x = 0;
      let scale = 1;
      let radius = 0;
      let opacity = 1;
      let shade = 0;
      let shadow = "none";
      if (m === "safari") {
        // a page ahead slides over at the hand's speed, a page behind trails it
        x = d >= 0 ? d * w : d * PARALLAX * w;
        shade = d < 0 ? Math.min(1, -d) : 0;
        shadow = EDGE;
      } else if (m === "chrome") {
        // the page holds still under the hand, and a release swaps it
        if (h) shown = i === h.base;
        else opacity = d > 0 ? 1 - d : 1;
      } else if (d >= 0) {
        // the page leaving shrinks into a card that follows the hand, then flies
        const e = 1 - (1 - Math.min(d / 0.5, 1)) ** 2;
        scale = 1 - 0.1 * e;
        radius = 26 * e;
        x = w * (0.1 * d + 0.9 * d ** 3);
        shadow = d > 0.001 ? CARD : "none";
      } else {
        scale = 1 + 0.05 * d;
        shade = -d * 0.8;
      }
      el.style.visibility = shown ? "visible" : "hidden";
      if (!shown) continue;
      el.style.transform = `translate3d(${x}px, 0, 0) scale(${scale})`;
      el.style.borderRadius = `${radius}px`;
      el.style.opacity = String(opacity);
      el.style.boxShadow = shadow;
      const s = shades.current[i];
      if (s) s.style.opacity = String(shade);
    }

    if (!h) return;
    const f = h.base - p;
    const dir = f > 0 ? -1 : 1;
    const target = h.base + dir;
    const valid = target >= 0 && target < n;
    const reach = valid ? clamp(Math.abs(f) / ARM, 0, 1) : 0;

    // the bar answers the swipe: the button it stands for presses down as the
    // hand goes, and the address swaps to where it is going on the detent.
    // A continuous crossfade drew both paths at half strength over each other,
    // and two paths that share a prefix read as neither
    const cur = current.current;
    const pre = preview.current;
    if (cur && pre) {
      const goal = valid ? entriesRef.current[target] : undefined;
      const swap = h.armed && goal ? 1 : 0;
      if (goal) pre.textContent = PAGES[goal.id].path;
      pre.style.opacity = String(swap);
      pre.style.transform = `translateX(${dir * 6 * (1 - swap)}px)`;
      cur.style.opacity = String(1 - swap);
      cur.style.transform = `translateX(${-dir * 6 * swap}px)`;
    }
    for (const side of [0, 1] as const) {
      const on = (side === 0) === dir < 0;
      const layer = presses.current[side];
      if (layer) layer.style.opacity = String(on ? reach : 0);
      const b = buttons.current[side];
      if (b) b.dataset.armed = String(on && h.armed);
    }

    // Chrome and Android draw an arrow beside the hand. Safari leaves the page
    // to say it
    for (const side of [0, 1] as const) {
      const a = arrows.current[side];
      if (!a) continue;
      const sign = side === 0 ? -1 : 1;
      const open = side === 0 ? h.base > 0 : h.base < n - 1;
      const amount = open ? Math.max(0, side === 0 ? f : -f) : 0;
      const r = m === "safari" ? 0 : clamp(amount / ARM, 0, 1);
      const chrome = m === "chrome";
      const size = chrome ? 40 : 32;
      // Chrome's arrow keeps stretching toward the page once it has armed
      const stretch = chrome ? clamp((amount - ARM) / 0.35, 0, 1) : 0;
      const travel = chrome ? [44, 58] : [36, 44];
      const y = handY.current ?? height.current / 2;
      a.style.top = `${clamp(y, 48, height.current - 48)}px`;
      a.style.height = `${size}px`;
      a.style.width = `${size + 20 * stretch}px`;
      a.style.opacity = String(r);
      a.style.transform = `translate(${sign * (travel[0] - r * travel[1])}px, -50%) scale(${0.6 + 0.4 * r})`;
      a.dataset.armed = String(h.armed && amount > 0);
    }
  }, [pos]);

  useEffect(() => pos.on("change", paint), [pos, paint]);

  /** the page goes where it was sent, and the address follows on the release */
  const go = useCallback(
    (target: number, v: number) => {
      const from = pos.get();
      jumping.current = Math.abs(target - from) > 1.5;
      cell.current = Math.round(from);
      if (target !== indexRef.current) {
        indexRef.current = target;
        setIndex(target);
        const e = entriesRef.current[target];
        if (e) setStatus(PAGES[e.id].title);
        swish();
      }
      anim.current?.stop();
      if (reduce) {
        jumping.current = false;
        pos.set(target);
        return;
      }
      anim.current = animate(pos, target, {
        ...SPRING,
        velocity: v,
        onComplete: () => {
          jumping.current = false;
        },
      });
    },
    [pos, reduce],
  );

  const begin = useCallback(() => {
    anim.current?.stop();
    jumping.current = false;
    armSound();
    setMenu(null);
    const p = pos.get();
    hand.current = {
      base: Math.round(p),
      raw: p,
      samples: [{ t: performance.now(), p }],
      armed: false,
    };
    for (const a of arrows.current) if (a) a.style.transition = STEP;
    for (const el of presses.current) if (el) el.style.transition = "none";
    for (const el of [current.current, preview.current])
      if (el) el.style.transition = SWAP;
    if (stage.current) stage.current.dataset.carry = "true";
  }, [pos]);

  const move = useCallback(
    (raw: number) => {
      const h = hand.current;
      if (!h) return;
      h.raw = raw;
      const top = entriesRef.current.length - 1;
      // one swipe reaches one page either way, and stretches past that
      const p = band(raw, Math.max(0, h.base - 1), Math.min(top, h.base + 1));
      const now = performance.now();
      h.samples.push({ t: now, p });
      while (h.samples.length > 2 && h.samples[0].t < now - 120)
        h.samples.shift();
      const f = h.base - p;
      const open = f > 0 ? h.base > 0 : h.base < top;
      const amount = Math.abs(f);
      const armed = open && amount >= (h.armed ? DISARM : ARM);
      if (armed !== h.armed) {
        h.armed = armed;
        detent(armed);
        if (armed) buzz(8);
      }
      pos.set(p);
      paint();
    },
    [pos, paint],
  );

  const end = useCallback(
    (v: number) => {
      const h = hand.current;
      if (!h) return;
      hand.current = null;
      if (stage.current) delete stage.current.dataset.carry;
      for (const a of arrows.current) {
        if (!a) continue;
        a.style.transition = FADE;
        a.style.opacity = "0";
      }
      const f = h.base - pos.get();
      const dir = f > 0 ? -1 : 1;
      const flick =
        Math.abs(v) > FLICK && Math.sign(v) === dir && Math.abs(f) > 0.03;
      const target = clamp(
        h.armed || flick ? h.base + dir : h.base,
        0,
        entriesRef.current.length - 1,
      );

      // the preview lets go: kept, it becomes the address, refused, it fades
      const cur = current.current;
      const pre = preview.current;
      for (const el of [cur, pre, ...presses.current])
        if (el) el.style.transition = SETTLE;
      if (cur) {
        cur.style.opacity = "1";
        cur.style.transform = "none";
      }
      if (pre) {
        pre.style.opacity = "0";
        pre.style.transform = "none";
      }
      for (const el of presses.current) if (el) el.style.opacity = "0";
      for (const b of buttons.current) if (b) b.dataset.armed = "false";
      if (target !== h.base) setAddrKey((k) => k + 1);
      go(target, v);
    },
    [go, pos],
  );

  /** the buttons, the keys and the history menu: the same slide, from a kick */
  const goTo = useCallback(
    (target: number) => {
      if (hand.current) return;
      if (target < 0 || target >= entriesRef.current.length) return;
      if (target === indexRef.current) return;
      armSound();
      setMenu(null);
      go(target, Math.sign(target - indexRef.current) * 2.5);
    },
    [go],
  );
  const nav = useCallback(
    (dir: -1 | 1) => goTo(indexRef.current + dir),
    [goTo],
  );

  /** a link drops every page ahead of this one and pushes its own */
  const follow = useCallback((id: PageId) => {
    if (hand.current) return;
    armSound();
    const i = indexRef.current;
    const next = [
      ...entriesRef.current.slice(0, i + 1),
      { key: keySeq.current++, id },
    ];
    entriesRef.current = next;
    pending.current = i + 1;
    setEntries(next);
  }, []);

  // the new page has a layer once it renders, and only then can it slide in
  useLayoutEffect(() => {
    const t = pending.current;
    if (t === null || entries.length <= t) return;
    pending.current = null;
    paint();
    go(t, 2.5);
  }, [entries, go, paint]);

  // every page but the last was left at the links that led on from it, so
  // going back finds each where it was
  useLayoutEffect(() => {
    for (const [i, s] of scrollers.current.entries())
      if (s && i < last) s.scrollTop = s.scrollHeight;
    paint();
  }, [paint, last]);

  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      width.current = el.clientWidth || 1;
      height.current = el.clientHeight || 1;
      paint();
    });
    ro.observe(el);

    // a trackpad swipe is wheel events with no start and no end. The first
    // event of a run picks its axis, a vertical run scrolls the page natively,
    // and a sideways one is the swipe, kept from the browser's own back
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return;
      const unit =
        e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? width.current : 1;
      const dx = e.deltaX * unit;
      const dy = e.deltaY * unit;
      // a run ends when its own timer fires, never by measuring the gap on
      // the next event: a stalled frame can deliver that event before the
      // timer, and a new run then began while the old timer was still due,
      // which ended the new swipe a moment in
      let w = wheel.current;
      if (!w || w.done) {
        const sideways = Math.abs(dx) > Math.abs(dy) && !ptr.current?.started;
        w = { axis: sideways ? "x" : "y", timer: 0, done: false };
        wheel.current = w;
        if (sideways) begin();
      }
      const run = w;
      window.clearTimeout(run.timer);
      run.timer = window.setTimeout(() => {
        run.done = true;
        const s = hand.current?.samples.at(-1);
        if (run.axis === "x" && hand.current && s)
          end(velocity(hand.current.samples, s.t));
      }, GAP);
      if (run.axis !== "x") return;
      e.preventDefault();
      const h = hand.current;
      if (!h) return;
      // fingers moving right report a negative delta, which is back
      move(h.raw + dx / width.current);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      ro.disconnect();
      el.removeEventListener("wheel", onWheel);
      window.clearTimeout(wheel.current?.timer);
    };
  }, [begin, move, end, paint]);

  // Cmd+[ and Cmd+], or Alt and the arrows, while the demo has the pointer or focus
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = stage.current;
      if (!s || !(inside.current || s.contains(document.activeElement))) return;
      const back =
        (e.altKey && e.key === "ArrowLeft") || (e.metaKey && e.key === "[");
      const fwd =
        (e.altKey && e.key === "ArrowRight") || (e.metaKey && e.key === "]");
      if (!back && !fwd) return;
      e.preventDefault();
      nav(back ? -1 : 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nav]);

  // a hold that opened history picks whatever the hand lets go over, the way
  // Chrome's does, and a press anywhere else closes it
  useEffect(() => {
    if (!menu) return;
    const up = (e: PointerEvent) => {
      if (!held.current) return;
      held.current = false;
      const hit = document
        .elementFromPoint(e.clientX, e.clientY)
        ?.closest<HTMLElement>("[data-entry]");
      if (hit) goTo(Number(hit.dataset.entry));
    };
    const down = (e: PointerEvent) => {
      const t = e.target as Node;
      if (menuEl.current?.contains(t)) return;
      if (buttons.current.some((b) => b?.contains(t))) return;
      setMenu(null);
    };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointerdown", down);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointerdown", down);
    };
  }, [menu, goTo]);

  // history opened from the keyboard starts on its first entry
  useEffect(() => {
    if (menu?.keys)
      menuEl.current?.querySelector<HTMLElement>("[data-entry]")?.focus();
  }, [menu]);

  const openMenu = (dir: -1 | 1, keys: boolean) => {
    if (hand.current) return;
    armSound();
    detent(true);
    buzz(10);
    setMenu({ dir, keys });
  };

  const closeMenu = (refocus: boolean) => {
    const dir = menu?.dir;
    setMenu(null);
    if (refocus && dir) buttons.current[dir < 0 ? 0 : 1]?.focus();
  };

  const pick = (j: number, keys: boolean) => {
    held.current = false;
    goTo(j);
    // the button that opened it may now be disabled, so the page takes focus
    if (keys)
      requestAnimationFrame(() =>
        scrollers.current[j]?.focus({ preventScroll: true }),
      );
  };

  const onMenuKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = [
      ...(menuEl.current?.querySelectorAll<HTMLElement>("[data-entry]") ?? []),
    ];
    const at = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") {
      e.preventDefault();
      closeMenu(true);
    } else if (e.key === "Tab") {
      closeMenu(false);
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      items[(at + step + items.length) % items.length]?.focus();
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      (e.key === "Home" ? items[0] : items.at(-1))?.focus();
    }
  };

  /** press for one page, hold for the whole history that way */
  const holdHandlers = (dir: -1 | 1) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
      // a hold that ended over the menu never clicked this button, so its
      // flag is cleared here rather than by the click it was waiting for
      swallow.current = false;
      if (e.button !== 0) return;
      window.clearTimeout(hold.current);
      hold.current = window.setTimeout(() => {
        swallow.current = true;
        held.current = true;
        openMenu(dir, false);
      }, HOLD);
    },
    onPointerUp: () => window.clearTimeout(hold.current),
    onPointerLeave: () => window.clearTimeout(hold.current),
    onPointerCancel: () => window.clearTimeout(hold.current),
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      window.clearTimeout(hold.current);
      openMenu(dir, false);
    },
    onKeyDown: (e: ReactKeyboardEvent) => {
      if (
        e.key === "ContextMenu" ||
        (e.shiftKey && e.key === "F10") ||
        (e.altKey && e.key === "ArrowDown")
      ) {
        e.preventDefault();
        openMenu(dir, true);
      }
    },
    onClick: () => {
      if (swallow.current) {
        swallow.current = false;
        return;
      }
      nav(dir);
    },
  });

  const cycleMode = () => {
    if (hand.current) return;
    const next = MODES[(MODES.indexOf(mode) + 1) % MODES.length] ?? "safari";
    modeRef.current = next;
    setMode(next);
    setStatus(`${LABEL[next]} back gesture`);
    anim.current?.stop();
    jumping.current = false;
    pos.set(indexRef.current);
    paint();
  };

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragged.current = false;
    if (e.button !== 0 || hand.current) return;
    ptr.current = {
      id: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      p0: pos.get(),
      started: false,
    };
  };

  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const box = viewport.current?.getBoundingClientRect();
    if (box) handY.current = e.clientY - box.top;
    const q = ptr.current;
    if (!q || q.id !== e.pointerId) return;
    if (!q.started) {
      const dx = e.clientX - q.x0;
      const dy = e.clientY - q.y0;
      if (Math.hypot(dx, dy) < SLOP) return;
      // a press that sets off vertically is a scroll, and is left alone
      if (Math.abs(dx) <= Math.abs(dy) * 1.2) {
        ptr.current = null;
        return;
      }
      q.started = true;
      q.x0 = e.clientX;
      e.currentTarget.setPointerCapture(e.pointerId);
      begin();
      q.p0 = pos.get();
    }
    move(q.p0 - (e.clientX - q.x0) / width.current);
  };

  const onUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const q = ptr.current;
    if (!q || q.id !== e.pointerId) return;
    ptr.current = null;
    if (!q.started) return;
    dragged.current = true;
    const h = hand.current;
    end(h ? velocity(h.samples, performance.now()) : 0);
  };

  const here = entries[index] ?? entries[entries.length - 1];
  const stop = PAGES[here.id];
  const menuItems = menu
    ? menu.dir < 0
      ? entries
          .slice(0, index)
          .map((e, j) => ({ e, j }))
          .reverse()
      : entries.slice(index + 1).map((e, k) => ({ e, j: index + 1 + k }))
    : [];

  return (
    <div
      ref={stage}
      onPointerEnter={() => {
        inside.current = true;
      }}
      onPointerLeave={() => {
        inside.current = false;
        handY.current = null;
      }}
      className="flex h-[32rem] w-full min-w-0 flex-col gap-3 rounded-lg bg-fill p-4 ring-1 ring-stroke ring-inset [overscroll-behavior-x:none] data-[carry=true]:cursor-grabbing sm:p-6 sm:pb-4"
    >
      <TooltipProvider delayDuration={500}>
        <div
          className="relative flex min-h-0 flex-1 flex-col overflow-clip rounded-xl bg-bg outline outline-stroke"
          style={{ boxShadow: RAISED }}
        >
          <div className="flex h-12 shrink-0 items-center gap-1 border-stroke border-b px-2.5">
            <Tooltip
              label="Back (⌘[). Hold for history"
              open={tip === -1 && !menu}
              onOpenChange={(o) => setTip(o ? -1 : null)}
            >
              <button
                ref={(el) => {
                  buttons.current[0] = el;
                }}
                type="button"
                aria-label="Back"
                aria-haspopup="menu"
                aria-expanded={menu?.dir === -1}
                disabled={index === 0}
                className={BUTTON}
                {...holdHandlers(-1)}
              >
                <Press
                  ref={(el) => {
                    presses.current[0] = el;
                  }}
                />
                <ArrowLeftIcon className="relative size-4" />
              </button>
            </Tooltip>
            <Tooltip
              label="Forward (⌘]). Hold for history"
              open={tip === 1 && !menu}
              onOpenChange={(o) => setTip(o ? 1 : null)}
            >
              <button
                ref={(el) => {
                  buttons.current[1] = el;
                }}
                type="button"
                aria-label="Forward"
                aria-haspopup="menu"
                aria-expanded={menu?.dir === 1}
                disabled={index === entries.length - 1}
                className={BUTTON}
                {...holdHandlers(1)}
              >
                <Press
                  ref={(el) => {
                    presses.current[1] = el;
                  }}
                />
                <ArrowRightIcon className="relative size-4" />
              </button>
            </Tooltip>
            <div
              className="ml-1 flex h-8 min-w-0 flex-1 items-center rounded-lg bg-fill px-3"
              style={{ boxShadow: WELL }}
            >
              <span className="flex min-w-0 items-center overflow-hidden whitespace-nowrap text-body leading-tight [font-kerning:none]">
                <span className="text-text-primary">{HOST}</span>
                <span className="grid text-text-muted">
                  <span ref={current} className="[grid-area:1/1]">
                    <TextMorph
                      key={addrKey}
                      duration={220}
                      ease="cubic-bezier(0.4, 0, 0.2, 1)"
                    >
                      {stop.path}
                    </TextMorph>
                  </span>
                  <span
                    ref={preview}
                    aria-hidden="true"
                    className="opacity-0 [grid-area:1/1]"
                  />
                </span>
              </span>
            </div>
          </div>

          {menu && menuItems.length > 0 && (
            <div
              ref={menuEl}
              role="menu"
              aria-label={menu.dir < 0 ? "Back history" : "Forward history"}
              onKeyDown={onMenuKey}
              className={cn(
                "absolute top-11 z-[60] flex w-64 max-w-[calc(100%-1.25rem)] flex-col rounded-xl bg-bg p-1 outline outline-stroke",
                menu.dir < 0 ? "left-2.5" : "left-11",
              )}
              style={{
                boxShadow:
                  "0 2px 6px rgb(0 0 0 / 0.06), 0 12px 28px -8px rgb(0 0 0 / 0.22)",
              }}
            >
              {menuItems.map(({ e, j }) => {
                const s = PAGES[e.id];
                return (
                  <button
                    key={e.key}
                    type="button"
                    role="menuitem"
                    data-entry={j}
                    onClick={() => pick(j, menu.keys)}
                    className="flex h-9 cursor-pointer items-center gap-2.5 rounded-lg px-2.5 text-left outline-none transition-colors duration-150 hover:bg-fill focus-visible:bg-fill active:bg-fill-hover"
                  >
                    <span
                      aria-hidden="true"
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: s.tone[1] }}
                    />
                    <span className="min-w-0 flex-1 truncate text-action text-text-primary">
                      {s.title}
                    </span>
                    <span className="shrink-0 text-meta text-text-muted [text-transform:none]">
                      {s.path.split("/").at(-1)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div
            ref={viewport}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onClickCapture={(e) => {
              if (!dragged.current) return;
              e.preventDefault();
              e.stopPropagation();
              dragged.current = false;
            }}
            className="relative min-h-0 flex-1 touch-pan-y overflow-clip bg-fill"
          >
            {entries.map((entry, i) => {
              const page = PAGES[entry.id];
              return (
                <div
                  key={entry.key}
                  ref={(el) => {
                    layers.current[i] = el;
                  }}
                  inert={i !== index}
                  className="absolute inset-0 overflow-hidden bg-bg"
                  style={{
                    zIndex: i,
                    visibility: i === index ? "visible" : "hidden",
                  }}
                >
                  <section
                    ref={(el) => {
                      scrollers.current[i] = el;
                    }}
                    aria-label={page.title}
                    // biome-ignore lint/a11y/noNoninteractiveTabindex: a scroll region needs focus for the arrow and page keys to scroll it
                    tabIndex={0}
                    className="peer size-full touch-pan-y select-none overflow-y-auto overscroll-contain px-5 pt-5 pb-8 outline-none [scrollbar-width:thin] sm:px-8"
                  >
                    <Page stop={page} onFollow={follow} />
                  </section>
                  {/* an inset ring on a scroller paints under its own children */}
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 rounded-b-xl opacity-0 ring-2 ring-text-secondary ring-inset peer-focus-visible:opacity-100"
                  />
                  <span
                    ref={(el) => {
                      shades.current[i] = el;
                    }}
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-text-primary/12 opacity-0"
                  />
                </div>
              );
            })}
            <Arrow
              ref={(el) => {
                arrows.current[0] = el;
              }}
              side="left"
            />
            <Arrow
              ref={(el) => {
                arrows.current[1] = el;
              }}
              side="right"
            />
          </div>
        </div>
      </TooltipProvider>

      {/* The site's own mode selector: the label is the gesture, and the arrows
          say a press swaps it */}
      <button
        type="button"
        aria-label={`Gesture ${LABEL[mode]}, press to change`}
        onClick={cycleMode}
        className={cn(
          "mx-auto flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-fill-hover px-2.5 text-meta text-text-primary transition-colors duration-200 hover:bg-fill-active active:bg-stroke-strong focus-visible:ring-offset-fill",
          FOCUS,
        )}
      >
        <ArrowsLeftRightIcon
          aria-hidden="true"
          className="size-3 shrink-0 text-text-muted"
        />
        <TextMorph duration={200} ease="cubic-bezier(0.4, 0, 0.2, 1)">
          {LABEL[mode]}
        </TextMorph>
      </button>

      <span role="status" className="sr-only">
        {status}
      </span>
    </div>
  );
}

/** the press a swipe puts on the button it stands for, written by `paint` */
function Press({ ref }: { ref: React.Ref<HTMLSpanElement> }) {
  return (
    <span
      ref={ref}
      aria-hidden="true"
      className="absolute inset-0 rounded-lg bg-fill-active opacity-0"
    />
  );
}

function Arrow({
  ref,
  side,
}: {
  ref: React.Ref<HTMLSpanElement>;
  side: "left" | "right";
}) {
  const Icon = side === "left" ? ArrowLeftIcon : ArrowRightIcon;
  return (
    <span
      ref={ref}
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute top-1/2 z-50 grid size-10 place-items-center rounded-full bg-bg text-text-secondary opacity-0 outline outline-stroke data-[armed=true]:bg-text-primary data-[armed=true]:text-bg",
        side === "left" ? "left-0" : "right-0",
      )}
      style={{
        transition: STEP,
        boxShadow:
          "0 1px 2px rgb(0 0 0 / 0.08), 0 6px 14px -6px rgb(0 0 0 / 0.2)",
      }}
    >
      <Icon className="size-4" />
    </span>
  );
}

function Page({
  stop,
  onFollow,
}: {
  stop: Stop;
  onFollow: (id: PageId) => void;
}) {
  return (
    <article className="mx-auto flex max-w-[30rem] flex-col gap-3">
      <p className="text-meta text-text-muted">{stop.area}</p>
      <h2 className="-mt-1 text-lead text-text-primary leading-tight">
        {stop.title}
      </h2>
      <div
        aria-hidden="true"
        className="relative aspect-[16/7] w-full overflow-hidden rounded-lg shadow-[inset_0_0_0_1px_rgb(0_0_0/0.06)]"
        style={{ background: stop.tone[0] }}
      >
        <span
          className="absolute inset-x-0 bottom-0 h-[38%]"
          style={{ background: stop.tone[1] }}
        />
        <span
          className="absolute bottom-[32%] left-[18%] aspect-square w-[12%] rounded-full opacity-60"
          style={{ background: "rgb(255 255 255 / 0.7)" }}
        />
      </div>
      {stop.paragraphs.map((p) => (
        <p key={p} className="text-body text-text-secondary">
          {p}
        </p>
      ))}
      {stop.links.length > 0 ? (
        <div className="mt-2 flex flex-col gap-2">
          <p className="text-meta text-text-muted">Where next</p>
          <div className="flex flex-wrap gap-2">
            {stop.links.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => onFollow(id)}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-2 rounded-full bg-fill px-3.5 py-2 text-action text-text-primary transition-all duration-150 hover:bg-fill-hover active:bg-fill-active",
                  FOCUS,
                )}
              >
                {PAGES[id].title}
                <ArrowRightIcon className="size-[0.9em] translate-y-[0.09em]" />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-2 text-meta text-text-muted">
          End of the walk. Hold Back to see where you came from.
        </p>
      )}
    </article>
  );
}
