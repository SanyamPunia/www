"use client";

import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import {
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { TextMorph } from "torph/react";
import { cn } from "@/lib/utils";
import {
  change,
  HUE,
  initialStocks,
  MODE_LABEL,
  MODES,
  type Mode,
  POINTS,
  percent,
  pill,
  price,
  type Stock,
  spark,
  step,
} from "./market";
import { age, HOLD, LOAD_MS, rubberband, THRESHOLD, unband } from "./pull";
import { armSound, arrive, buzz, detent, notch } from "./pull-sound";
import { Spinner } from "./spinner";

/*
 * Pull to refresh on a watchlist, the way iOS does it. `pull.ts` is the pull's
 * numbers, `market.ts` the prices, `spinner.tsx` the activity indicator and
 * `pull-sound.ts` the two sounds. This file is the scroller, the gesture and
 * the refresh.
 *
 * **The list scrolls freely, and the pull is what happens past its top.** The
 * watchlist is longer than the card and scrolls natively, with the browser's
 * own momentum for touch, trackpads and the keyboard. A pull only starts when
 * the list is already at the top and the hand keeps going down, the way iOS
 * turns an overscroll into a refresh. A mouse has no native drag to scroll, so
 * a mouse drag scrolls the list with momentum of its own and turns into a pull
 * at the top, in one gesture.
 *
 * **The refresh starts while the hand is still down**, on the frame the pull
 * crosses the threshold, with a detent you hear and feel. Letting go then only
 * decides where the list rests.
 */

type Phase = "idle" | "refreshing" | "landing";

/** the card's height, which the rubber band is measured against */
const ROOM = 230;

/** how far apart the rows take their new prices, top to bottom */
const WAVE_MS = 45;

/** a wheel gesture has ended once no event has come for this long */
const WHEEL_IDLE_MS = 140;

/** the sparkline's box */
const SPARK = { w: 56, h: 24 } as const;

/** room either side of the sparkline that still catches a scrub */
const SPARK_PAD = 6;

const SETTLE = { type: "spring", bounce: 0, visualDuration: 0.38 } as const;

/** the last 80ms of motion, for a release velocity */
type Sample = [t: number, v: number];

function velocityOf(samples: Sample[]): number {
  const now = performance.now();
  const recent = samples.filter(([t]) => now - t < 80);
  if (recent.length < 2) return 0;
  const [t0, v0] = recent[0];
  const [t1, v1] = recent[recent.length - 1];
  return t1 > t0 ? ((v1 - v0) / (t1 - t0)) * 1000 : 0;
}

interface MouseDrag {
  pointer: number;
  y0: number;
  last: number;
  /** past the slop, so this is a drag and not a click on a pill */
  live: boolean;
  pulling: boolean;
  raw: number;
}

/** px a mouse must travel before a press is a drag rather than a click */
const SLOP = 4;

export default function PullRefresh() {
  const stage = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const mouse = useRef<MouseDrag | null>(null);
  const touch = useRef({ active: false, last: 0, pulling: false, raw: 0 });
  const wheel = useRef({
    lastAt: 0,
    fromTop: false,
    pulling: false,
    raw: 0,
    timer: 0,
  });
  const pullSamples = useRef<Sample[]>([]);
  const scrollSamples = useRef<Sample[]>([]);
  const inertia = useRef(0);
  const phaseRef = useRef<Phase>("idle");
  /** the refresh finished while a hand was still pulling */
  const pending = useRef(false);
  const round = useRef(1);
  const timers = useRef<number[]>([]);
  const reduce = useReducedMotion() ?? false;

  const y = useMotionValue(0);
  /** how far the list is scrolled, which the collapsing title reads */
  const scrollY = useMotionValue(0);

  const [stocks, setStocks] = useState<Stock[]>(initialStocks);
  const stocksRef = useRef(stocks);
  stocksRef.current = stocks;
  const [phase, setPhaseState] = useState<Phase>("idle");
  const [updatedAt, setUpdatedAt] = useState(() => Date.now() - 3 * 60000);
  const [now, setNow] = useState(() => Date.now());
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<Mode>("percent");

  /** a tap on any pill moves every pill to the next thing it can show */
  const cycleMode = useCallback(() => {
    setMode((m) => {
      const next = MODES[(MODES.indexOf(m) + 1) % MODES.length];
      setMessage(`Showing ${MODE_LABEL[next]}.`);
      return next;
    });
    detent();
    buzz(6);
  }, []);

  /*
   * The large title collapses into the bar the way it does on iOS. The bar's
   * material comes up as the list starts to scroll, and the small title only
   * once the large one has gone under it, so the two are never both on screen.
   * Pulling down grows the large title a touch, anchored at its left, which is
   * the rubber band showing on the type itself.
   */
  const barOpacity = useTransform(scrollY, [6, 28], [0, 1]);
  const smallTitle = useTransform(scrollY, [30, 44], [0, 1]);
  const smallTitleY = useTransform(smallTitle, [0, 1], [4, 0]);
  const largeScale = useTransform(y, [0, 120], [1, 1.06], { clamp: true });

  const setPhase = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  const settle = useCallback(
    (to: number, velocity = 0) => {
      if (reduce) y.set(to);
      else animate(y, to, { ...SETTLE, velocity });
    },
    [reduce, y],
  );

  // the age line ticks over on its own, the way Mail's toolbar does
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);

  /* ---------------------------------------------------------- the refresh */

  /**
   * The new prices land, in a wave from the top: each row takes its price
   * 45ms after the one above it, so the refresh reads as one movement down the
   * list rather than every number changing on one frame.
   */
  const land = useCallback(() => {
    pending.current = false;
    const next = step(stocksRef.current, round.current);
    round.current += 1;
    next.forEach((s, i) => {
      const apply = () =>
        setStocks((list) => list.map((x, j) => (j === i ? s : x)));
      if (reduce || i === 0) apply();
      else later(apply, i * WAVE_MS);
    });
    setPhase("landing");
    setUpdatedAt(Date.now());
    setNow(Date.now());
    arrive();
    setMessage("Prices updated.");
    settle(0);
    later(() => setPhase("idle"), 260);
  }, [later, reduce, setPhase, settle]);

  const finish = useCallback(() => {
    // a hand still pulling keeps the list where it is, and the release lands it
    if (
      mouse.current?.pulling ||
      touch.current.pulling ||
      wheel.current.pulling
    ) {
      pending.current = true;
      return;
    }
    land();
  }, [land]);

  /** the threshold is crossed: the refresh starts now, hand down or not */
  const begin = useCallback(() => {
    if (phaseRef.current !== "idle") return;
    setPhase("refreshing");
    detent();
    buzz(10);
    setMessage("Checking prices.");
    later(finish, LOAD_MS);
  }, [finish, later, setPhase]);

  /* ---------------------------------------------------- the pull, shared */

  const pullTo = useCallback(
    (raw: number) => {
      const v = rubberband(raw, ROOM);
      y.set(v);
      pullSamples.current.push([performance.now(), v]);
      if (pullSamples.current.length > 12) pullSamples.current.shift();
      if (v >= THRESHOLD) begin();
    },
    [begin, y],
  );

  const startPull = useCallback(() => {
    y.stop();
    pullSamples.current = [];
    return unband(y.get(), ROOM);
  }, [y]);

  const endPull = useCallback(() => {
    if (pending.current) {
      land();
      return;
    }
    const velocity = velocityOf(pullSamples.current);
    settle(phaseRef.current === "refreshing" ? HOLD : 0, velocity);
  }, [land, settle]);

  /* ----------------------------------------------------------- mouse drag */

  const stopInertia = useCallback(() => {
    cancelAnimationFrame(inertia.current);
    inertia.current = 0;
  }, []);

  /**
   * A mouse drag that was scrolling keeps going when it is let go, decaying
   * like a scroll view, `0.325s` being UIScrollView's normal rate. It stops at
   * either end of the list rather than bouncing.
   */
  const coast = (velocity: number) => {
    const el = scroller.current;
    if (!el || reduce || Math.abs(velocity) < 60) return;
    let v = velocity;
    let last = performance.now();
    const frame = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      v *= Math.exp(-dt / 0.325);
      const before = el.scrollTop;
      el.scrollTop = before + v * dt;
      if (Math.abs(v) < 20 || el.scrollTop === before) {
        inertia.current = 0;
        return;
      }
      inertia.current = requestAnimationFrame(frame);
    };
    inertia.current = requestAnimationFrame(frame);
  };

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    // touch scrolls natively and is handled by the touch listeners below
    if (e.pointerType === "touch" || e.button !== 0 || mouse.current) return;
    armSound();
    stopInertia();
    // no capture yet: a press that never moves is a click, and a capture
    // would send that click to the scroller instead of the pill under it
    mouse.current = {
      pointer: e.pointerId,
      y0: e.clientY,
      last: e.clientY,
      live: false,
      pulling: false,
      raw: 0,
    };
    scrollSamples.current = [];
  };

  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    const d = mouse.current;
    const el = scroller.current;
    if (!d || !el || e.pointerId !== d.pointer) return;
    if (!d.live) {
      if (Math.abs(e.clientY - d.y0) < SLOP) return;
      d.live = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      const st = stage.current;
      if (st) st.dataset.carry = "true";
      if (y.get() > 0.5) {
        d.pulling = true;
        d.raw = startPull();
      }
    }
    const dy = e.clientY - d.last;
    d.last = e.clientY;
    if (d.pulling) {
      d.raw += dy;
      if (d.raw > 0) {
        pullTo(d.raw);
        return;
      }
      // pushed back past the top: the rest of the hand scrolls the list
      d.pulling = false;
      y.set(0);
      el.scrollTop -= d.raw;
      return;
    }
    if (el.scrollTop <= 0 && dy > 0) {
      d.pulling = true;
      d.raw = startPull() + dy;
      pullTo(d.raw);
      return;
    }
    el.scrollTop -= dy;
    scrollSamples.current.push([performance.now(), el.scrollTop]);
    if (scrollSamples.current.length > 12) scrollSamples.current.shift();
  };

  const onPointerEnd = (e: PointerEvent<HTMLElement>) => {
    const d = mouse.current;
    if (!d || e.pointerId !== d.pointer) return;
    mouse.current = null;
    if (!d.live) return;
    const el = stage.current;
    if (el) el.dataset.carry = "false";
    if (d.pulling) endPull();
    else coast(velocityOf(scrollSamples.current));
  };

  /* ---------------------------------------------------- touch and wheel */

  /*
   * Bound by hand, since a listener that calls `preventDefault` cannot be
   * passive and React's are. The list keeps native scrolling for both: only
   * the part of a gesture that goes past the top is taken.
   */
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const t = touch.current;
    const w = wheel.current;

    const onTouchStart = (e: TouchEvent) => {
      armSound();
      stopInertia();
      t.active = true;
      t.last = e.touches[0].clientY;
      t.pulling = y.get() > 0.5;
      if (t.pulling) t.raw = startPull();
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!t.active) return;
      const cy = e.touches[0].clientY;
      const dy = cy - t.last;
      t.last = cy;
      if (!t.pulling) {
        if (el.scrollTop > 0 || dy <= 0) return;
        t.pulling = true;
        t.raw = startPull();
      }
      if (e.cancelable) e.preventDefault();
      t.raw += dy;
      if (t.raw <= 0) {
        t.pulling = false;
        y.set(0);
        return;
      }
      pullTo(t.raw);
    };
    const onTouchEnd = () => {
      if (!t.active) return;
      t.active = false;
      if (t.pulling) {
        t.pulling = false;
        endPull();
      }
    };

    /*
     * A trackpad or a wheel scrolls the list natively, and turns into a pull
     * only when the gesture began with the list already at its top. A fling
     * that reaches the top carries on as momentum events with the same sign,
     * and starting a pull off those would refresh a list nobody pulled.
     */
    const onWheel = (e: WheelEvent) => {
      const now = performance.now();
      if (now - w.lastAt > 160) w.fromTop = el.scrollTop <= 0;
      w.lastAt = now;
      const scale = e.deltaMode === 1 ? 16 : 1;
      if (!w.pulling) {
        if (!w.fromTop || el.scrollTop > 0 || e.deltaY >= 0) return;
        w.pulling = true;
        w.raw = startPull();
      }
      e.preventDefault();
      w.raw -= e.deltaY * scale;
      clearTimeout(w.timer);
      if (w.raw <= 0) {
        w.pulling = false;
        y.set(0);
        return;
      }
      pullTo(w.raw);
      w.timer = window.setTimeout(() => {
        w.pulling = false;
        endPull();
      }, WHEEL_IDLE_MS);
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      el.removeEventListener("wheel", onWheel);
      clearTimeout(w.timer);
    };
  }, [endPull, pullTo, startPull, stopInertia, y]);

  /** the keyboard's pull: the list opens to the spinner's room and refreshes */
  const refreshByKey = () => {
    if (phaseRef.current !== "idle") return;
    armSound();
    scroller.current?.scrollTo({ top: 0 });
    settle(HOLD);
    begin();
  };

  useEffect(() => {
    const ts = timers;
    return () => {
      ts.current.forEach(clearTimeout);
      cancelAnimationFrame(inertia.current);
    };
  }, []);

  /* ---------------------------------------------------------------- render */

  const status =
    phase === "refreshing" ? "Checking prices" : age(updatedAt, now);
  const today = new Date(now).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });

  return (
    <div
      ref={stage}
      className={cn(
        "relative flex aspect-8/5 min-h-96 w-full select-none flex-col items-center justify-center gap-4 overflow-hidden rounded-lg bg-fill",
        "data-[carry=true]:cursor-grabbing data-[carry=true]:[&_*]:cursor-grabbing",
      )}
    >
      <div
        ref={card}
        className="group/card relative h-72 w-[min(22rem,calc(100%-2rem))] overflow-hidden rounded-[1.25rem] bg-bg"
        style={{
          boxShadow:
            "0 1px 2px rgba(0,0,0,0.04), 0 14px 36px -14px rgba(0,0,0,0.16)",
        }}
      >
        <Spinner
          y={y}
          spinning={phase === "refreshing"}
          leaving={phase === "landing"}
        />

        {/* the keyboard's way in, shown only while it has focus */}
        <button
          type="button"
          onClick={refreshByKey}
          className="sr-only z-20 cursor-pointer rounded-full bg-text-primary px-3 py-1.5 text-meta focus-visible:not-sr-only focus-visible:absolute focus-visible:top-2 focus-visible:left-1/2 focus-visible:-translate-x-1/2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2"
          style={{ color: "#fff" }}
        >
          Refresh
        </button>

        {/* the scroller: native scrolling, no visible bar, and an overscroll
            that stays in the card rather than scrolling the page */}
        <section
          ref={scroller}
          aria-label="Watchlist"
          // biome-ignore lint/a11y/noNoninteractiveTabindex: a scroll region needs focus for the arrow and page keys to scroll it
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onScroll={(e) => {
            // written to the node, so scrolling renders nothing
            const el = card.current;
            const sc = e.currentTarget;
            scrollY.set(sc.scrollTop);
            if (!el) return;
            // the foot's fade goes once the last row is fully in view, since
            // there is nothing left under it to soften
            el.dataset.end = String(
              sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 4,
            );
          }}
          className="absolute inset-0 cursor-grab touch-pan-y overflow-y-auto overscroll-y-contain [scrollbar-width:none] peer focus-visible:outline-none [&::-webkit-scrollbar]:hidden"
        >
          {/* room under the last row, so it does not sit on the card's
              rounded foot */}
          <motion.div className="min-h-full bg-bg pb-3" style={{ y }}>
            {/* the large title, which the pull carries down with the list */}
            <div className="flex items-baseline justify-between px-4 pt-4 pb-2">
              <motion.h3
                className="origin-left font-medium text-[1.375rem] text-text-primary leading-tight tracking-[-0.01em]"
                style={{ scale: largeScale }}
              >
                Stocks
              </motion.h3>
              <span className="text-meta text-text-muted">{today}</span>
            </div>
            <ul>
              {stocks.map((s, i) => (
                <Quote
                  key={s.ticker}
                  stock={s}
                  last={i === stocks.length - 1}
                  mode={mode}
                  onMode={cycleMode}
                />
              ))}
            </ul>
          </motion.div>
        </section>

        {/* the bar the large title collapses into. Its material is the scroll
            edge at the top, so it only comes up once content sits under it.
            It carries the card's own top corners, since a `backdrop-filter`
            escapes an ancestor's rounded clip in Chrome and the blurred list
            showed square in the card's top corners */}
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-10 rounded-t-[1.25rem] border-stroke border-b bg-bg/80 backdrop-blur-md"
          style={{ opacity: barOpacity }}
        />
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 z-10 flex h-10 items-center justify-center font-medium text-body text-text-primary"
          style={{ opacity: smallTitle, y: smallTitleY }}
        >
          Stocks
        </motion.span>
        {/* the list runs out under a soft edge at the card's foot, the way iOS
            lets content scroll under its edges */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-linear-to-t from-bg to-transparent transition-opacity duration-200 group-data-[end=true]/card:opacity-0"
        />
        {/*
         * The scroller's focus ring, on a layer of its own over the list. An
         * inset ring on the scroller paints under its own children, and the
         * list's white covered it completely, the trap the album cover and the
         * lab cards document. It follows the card's corners and is
         * `text-secondary`, 5.3:1, since the declared `text-primary/15` is
         * 1.2:1 and a ring that faint round a whole card is not there at all.
         */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit] ring-2 ring-text-secondary ring-inset opacity-0 transition-opacity duration-150 peer-focus-visible:opacity-100"
        />
      </div>

      {/* the age line, which says what the spinner is doing in words */}
      <span className="whitespace-nowrap text-meta text-text-muted">
        <TextMorph duration={200} ease="cubic-bezier(0.4, 0, 0.2, 1)">
          {status}
        </TextMorph>
      </span>

      <span aria-live="polite" className="sr-only">
        {message}
      </span>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-lg ring-1 ring-stroke ring-inset"
      />
    </div>
  );
}

/**
 * One row of the watchlist. The sparkline morphs from its last shape to the
 * new one, since every window has the same number of points, and the price
 * and the pill morph their digits. The pill's colour crossfades when the day
 * turns.
 *
 * **Pressing the sparkline scrubs it.** A hairline follows the hand along the
 * chart, the part after it dims, and the price and the pill show that point
 * until the hand lets go. It is a slider for the keyboard, stepped by the
 * arrows. The scrubbed numbers are plain text rather than morphs, since a
 * value changing on every point would morph into a smear.
 */
function Quote({
  stock,
  last,
  mode,
  onMode,
}: {
  stock: Stock;
  last: boolean;
  mode: Mode;
  onMode: () => void;
}) {
  const [scrub, setScrub] = useState<number | null>(null);
  const scrubRef = useRef<number | null>(null);
  const live = useRef(false);

  const c = change(stock, scrub);
  const hue = c >= 0 ? HUE.up : HUE.down;
  const { d, open, points } = spark(stock, SPARK.w, SPARK.h);
  const p = price(stock, scrub);
  const label = pill(stock, mode, scrub);
  const nowUp = change(stock) >= 0;
  const nowPct = percent(change(stock)).replace(/[+-]/, "");
  const nextMode = MODES[(MODES.indexOf(mode) + 1) % MODES.length];

  const set = (k: number | null) => {
    if (k === scrubRef.current) return;
    scrubRef.current = k;
    setScrub(k);
    if (k !== null) {
      notch();
      buzz(3);
    }
  };

  const pointAt = (e: PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const t = (e.clientX - r.left - SPARK_PAD) / SPARK.w;
    return Math.round(Math.min(1, Math.max(0, t)) * (POINTS - 1));
  };

  const onDown = (e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    // the scrub is the sparkline's, never the list's drag or scroll
    e.stopPropagation();
    armSound();
    e.currentTarget.setPointerCapture(e.pointerId);
    live.current = true;
    set(pointAt(e));
  };
  const onMove = (e: PointerEvent<HTMLElement>) => {
    if (live.current) set(pointAt(e));
  };
  const onEnd = () => {
    live.current = false;
    set(null);
  };
  const onKey = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Escape") {
      set(null);
      return;
    }
    const k = scrubRef.current ?? POINTS - 1;
    const to =
      e.key === "ArrowLeft"
        ? k - 1
        : e.key === "ArrowRight"
          ? k + 1
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? POINTS - 1
              : null;
    if (to === null) return;
    e.preventDefault();
    armSound();
    set(Math.min(POINTS - 1, Math.max(0, to)));
  };

  const ago = scrub === null ? 0 : POINTS - 1 - scrub;
  const cut = scrub === null ? SPARK.w : points[scrub][0];

  return (
    <li className="relative flex h-16 items-center gap-3 px-4">
      <span className="sr-only">
        {`${stock.ticker}, ${stock.name}, ${price(stock)}, ${nowUp ? "up" : "down"} ${nowPct}`}
      </span>
      <span
        aria-hidden="true"
        className="flex min-w-0 flex-1 flex-col normal-case"
      >
        <span className="font-medium text-body text-text-primary">
          {stock.ticker}
        </span>
        <span className="truncate text-meta text-text-muted">{stock.name}</span>
      </span>
      <span
        role="slider"
        tabIndex={0}
        aria-label={`${stock.ticker} price history`}
        aria-valuemin={0}
        aria-valuemax={POINTS - 1}
        aria-valuenow={scrub ?? POINTS - 1}
        aria-valuetext={
          scrub === null
            ? `${price(stock)}, now`
            : `${p}, ${ago} ${ago === 1 ? "step" : "steps"} ago`
        }
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onEnd}
        onPointerCancel={onEnd}
        onKeyDown={onKey}
        onBlur={() => set(null)}
        className="-mx-1.5 shrink-0 cursor-ew-resize touch-none rounded-md py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-secondary"
        style={{ paddingInline: SPARK_PAD }}
      >
        <svg
          aria-hidden="true"
          focusable="false"
          width={SPARK.w}
          height={SPARK.h}
          viewBox={`0 0 ${SPARK.w} ${SPARK.h}`}
          className="block overflow-visible"
        >
          <defs>
            <clipPath id={`upto-${stock.ticker}`}>
              <rect x="-2" y="-4" width={cut + 2} height={SPARK.h + 8} />
            </clipPath>
          </defs>
          <line
            x1="0"
            x2={SPARK.w}
            y1={open}
            y2={open}
            strokeDasharray="1.5 2.5"
            strokeWidth="1"
            className="stroke-stroke-strong"
          />
          {/* the whole line, which dims past the hand while scrubbing */}
          <motion.path
            initial={false}
            animate={{ d, stroke: hue, opacity: scrub === null ? 1 : 0.28 }}
            transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
            fill="none"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {scrub !== null && (
            <>
              <path
                d={d}
                clipPath={`url(#upto-${stock.ticker})`}
                fill="none"
                stroke={hue}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <line
                x1={cut}
                x2={cut}
                y1={-4}
                y2={SPARK.h + 4}
                strokeWidth="1"
                className="stroke-text-muted"
              />
              <circle
                cx={cut}
                cy={points[scrub][1]}
                r="2.75"
                fill={hue}
                strokeWidth="1.5"
                className="stroke-bg"
              />
            </>
          )}
        </svg>
      </span>
      <span className="flex w-[4.25rem] shrink-0 flex-col items-end gap-0.5">
        <span
          aria-hidden="true"
          className="text-body text-text-primary tabular-nums"
        >
          {scrub === null ? (
            <TextMorph duration={260} ease="cubic-bezier(0.4, 0, 0.2, 1)">
              {p}
            </TextMorph>
          ) : (
            p
          )}
        </span>
        {/* the pill is a button: a tap moves every pill to the next thing it
            can show, the way Stocks does. One width for every pill, numbers to
            the right, so the change column reads as a column */}
        <button
          type="button"
          onClick={onMode}
          aria-label={`Showing ${MODE_LABEL[mode]}. Show ${MODE_LABEL[nextMode]}`}
          className={cn(
            "relative flex w-[4.25rem] cursor-pointer justify-end rounded-md px-1.5 py-px text-meta tabular-nums transition-colors duration-300",
            // shading a filled control is black at alpha over its own hue
            "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:bg-black/0 after:transition-colors after:duration-150 hover:after:bg-black/10 active:after:bg-black/20 active:after:duration-0",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-secondary focus-visible:ring-offset-2",
          )}
          // the casing is inline, since "505.3B" is data and its unit is its
          // casing, and `button { text-transform: inherit }` in `globals.css`
          // is unlayered and beats a `normal-case` utility
          style={{ backgroundColor: hue, color: "#fff", textTransform: "none" }}
        >
          {scrub === null ? (
            <TextMorph duration={260} ease="cubic-bezier(0.4, 0, 0.2, 1)">
              {label}
            </TextMorph>
          ) : (
            label
          )}
        </button>
      </span>
      {!last && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-0 bottom-0 left-4 h-px bg-stroke"
        />
      )}
    </li>
  );
}
