"use client";

import { useReducedMotion } from "motion/react";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useTextMorph } from "torph/react";
import { ArrowDownIcon, ArrowUpIcon } from "@/components/icons";
import { approach } from "@/lib/lerp";
import { cn } from "@/lib/utils";
import {
  change,
  DAYS,
  formatDay,
  formatMoney,
  linePath,
  nearest,
  type Placed,
  POINTS,
  place,
  yAt,
} from "./chart";
import { paintDither } from "./dither";
import { THEMES } from "./themes";

/** Cuelume, loaded on the first touch so it never weighs on the page's first load */
type Cuelume = typeof import("cuelume");
let cuelume: Promise<Cuelume> | null = null;
const loadCuelume = () => (cuelume ??= import("cuelume"));

/*
 * A month of balances as a line you scrub. Point at the chart, or press and
 * drag on a touch screen, and a crosshair snaps to the nearest day, the big
 * number morphs to that day's value, and the fill under the line stops at the
 * crosshair while the line past it goes quiet. Let go and it all runs back to
 * the latest day.
 *
 * **Nothing renders while it moves.** The crosshair's place is one number in a
 * ref, eased toward the snapped point by one frame loop, and the loop writes
 * the clip, the crosshair, the dot and the date chip straight to their nodes.
 * The number, the change and the range are written when the snapped day
 * changes, which is once per day crossed.
 */

/*
 * Room inside the chart: the date chip above the plot, and on the right the
 * resting dot and its ring, since the chart runs to both edges of the stage
 * and the stage clips. The line starts on the left edge itself (px).
 */
const PAD = { top: 26, bottom: 8, left: 0, right: 8 };
/** How fast the crosshair reaches a snapped point, and how fast it runs home on a leave (s) */
const GLIDE = { snap: 0.035, home: 0.12 };
/*
 * The big number morphs through torph. 160ms rather than the site's usual 200,
 * since a scrub changes the day faster than that and a morph still running as
 * the next one starts is a smear, `the-card-flinches`' number.
 */
const MORPH = { duration: 160, ease: "cubic-bezier(0.32, 0.72, 0, 1)" };
/*
 * The wake: the crosshair's speed, read as 0 at rest and 1 at `FAST` px/s,
 * rising quickly and dying slowly, so a scrub leaves a trail of dots that
 * settles back into the plain screen once the hand stops.
 */
const WAKE = { fast: 900, rise: 0.12, fall: 0.3 };
/** A day's tick is never closer than this to the last (ms) */
const TICK_GAP = 28;
const LAST = DAYS - 1;

interface Geometry {
  w: number;
  h: number;
  placed: Placed;
  line: string;
  base: number;
}

function geometry(w: number, h: number): Geometry {
  const plot = {
    left: PAD.left,
    top: PAD.top,
    width: Math.max(1, w - PAD.left - PAD.right),
    height: Math.max(1, h - PAD.top - PAD.bottom),
  };
  const placed = place(plot);
  return {
    w,
    h,
    placed,
    line: linePath(placed),
    base: placed.ys[0],
  };
}

export default function ScrubChart() {
  const reduced = useReducedMotion() ?? false;
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  const uid = useId().replace(/:/g, "");

  const chart = useRef<HTMLDivElement>(null);
  const morph = useTextMorph({ duration: MORPH.duration, ease: MORPH.ease });
  const shown = useRef<string | null>(null);
  const delta = useRef<HTMLSpanElement>(null);
  const deltaText = useRef<HTMLSpanElement>(null);
  const range = useRef<HTMLSpanElement>(null);
  const clip = useRef<SVGRectElement>(null);
  const cross = useRef<SVGGElement>(null);
  const dot = useRef<SVGGElement>(null);
  const chip = useRef<HTMLSpanElement>(null);
  const screen = useRef<HTMLCanvasElement>(null);
  const ink = useRef({ ahead: "", behind: "" });
  const dpr = useRef(1);

  const [geo, setGeo] = useState<Geometry | null>(null);
  const [themeIndex, setThemeIndex] = useState(0);
  const theme = THEMES[themeIndex];
  const geoRef = useRef<Geometry | null>(null);
  geoRef.current = geo;

  // where the crosshair is drawn, where it is heading, and which day it shows
  const pos = useRef({ x: 0, target: 0, day: LAST, active: false });
  // how stirred the dither is
  const stir = useRef({ wake: 0 });
  const touch = useRef<number | null>(null);
  const frame = useRef(0);
  const last = useRef(0);
  const tick = useRef({ at: 0, sound: null as Cuelume | null });

  const arm = () => {
    if (!tick.current.sound)
      void loadCuelume().then((m) => {
        tick.current.sound = m;
      });
  };

  /* ---------------------------------------------------------- the readout */

  /** Writes the header and the slider's value for a day */
  const show = (day: number) => {
    pos.current.day = day;
    const { value, at } = POINTS[day];
    const text = formatMoney(value);
    if (text !== shown.current) {
      shown.current = text;
      morph.update(text);
    }
    const c = change(day);
    if (delta.current) delta.current.dataset.up = String(c.up);
    if (deltaText.current) deltaText.current.textContent = c.text;
    if (range.current)
      range.current.textContent = `${formatDay(POINTS[0].at)} – ${formatDay(at)}`;
    if (chip.current) chip.current.textContent = formatDay(at);
    const el = chart.current;
    if (el) {
      el.setAttribute("aria-valuenow", String(day));
      el.setAttribute(
        "aria-valuetext",
        `${formatDay(at)}, ${formatMoney(value)}, ${c.up ? "up" : "down"} ${c.text}`,
      );
    }
  };

  /* ---------------------------------------------------------------- paint */

  const paint = () => {
    const g = geoRef.current;
    if (!g) return;
    const { x } = pos.current;
    clip.current?.setAttribute("width", String(Math.max(0, x + 8)));
    cross.current?.setAttribute("transform", `translate(${x} 0)`);
    dot.current?.setAttribute(
      "transform",
      `translate(${x} ${yAt(g.placed, x)})`,
    );
    const c = chip.current;
    if (c) {
      const half = c.offsetWidth / 2;
      const left = Math.min(g.w - half, Math.max(half, x));
      c.style.transform = `translateX(${left - half}px)`;
    }
    const ctx = screen.current?.getContext("2d");
    if (ctx) {
      ctx.setTransform(dpr.current, 0, 0, dpr.current, 0, 0);
      paintDither(ctx, {
        placed: g.placed,
        w: g.w,
        h: g.h,
        x,
        wake: stir.current.wake,
        ink: ink.current,
      });
    }
  };

  const step = (now: number) => {
    frame.current = 0;
    const dt = Math.min(50, last.current ? now - last.current : 16.7) / 1000;
    last.current = now;
    const p = pos.current;
    const from = p.x;
    const tau = p.active ? GLIDE.snap : GLIDE.home;
    p.x += (p.target - p.x) * approach(tau, dt);
    if (Math.abs(p.target - p.x) < 0.05) p.x = p.target;

    const s = stir.current;
    const speed = Math.min(1, Math.abs(p.x - from) / dt / WAKE.fast);
    s.wake +=
      (speed - s.wake) * approach(speed > s.wake ? WAKE.rise : WAKE.fall, dt);
    if (s.wake < 0.01 && speed === 0) s.wake = 0;

    paint();
    if (p.x !== p.target || s.wake > 0) run();
    else last.current = 0;
  };
  const stepRef = useRef(step);
  stepRef.current = step;

  const run = () => {
    if (reducedRef.current) {
      pos.current.x = pos.current.target;
      paint();
      return;
    }
    if (frame.current) return;
    frame.current = requestAnimationFrame((now) => stepRef.current(now));
  };

  /* ---------------------------------------------------------- the scrub */

  const setActive = (on: boolean) => {
    const p = pos.current;
    if (p.active === on) return;
    p.active = on;
    if (chart.current) chart.current.dataset.active = String(on);
  };

  /** Snaps the crosshair to a day and scrubs there */
  const scrubTo = (day: number, haptic = false) => {
    const g = geoRef.current;
    if (!g) return;
    setActive(true);
    const p = pos.current;
    p.target = g.placed.xs[day];
    if (day !== p.day) {
      show(day);
      const now = performance.now();
      const t = tick.current;
      if (t.sound && now - t.at > TICK_GAP) {
        t.at = now;
        t.sound.play("select", {
          theme: "mech",
          emphasis: "subtle",
          volume: 0.25,
        });
      }
      if (haptic) navigator.vibrate?.(4);
    }
    run();
  };

  /** Lets go: the crosshair runs home to the latest day and the number rolls back */
  const rest = () => {
    const g = geoRef.current;
    if (!g) return;
    setActive(false);
    pos.current.target = g.placed.xs[LAST];
    if (pos.current.day !== LAST) show(LAST);
    run();
  };

  const dayAt = (clientX: number) => {
    const g = geoRef.current;
    const el = chart.current;
    if (!g || !el) return LAST;
    return nearest(g.placed, clientX - el.getBoundingClientRect().left);
  };

  // a mouse or a pen scrubs on hover, a finger scrubs while it is down
  const enter = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "touch") arm();
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch") {
      if (touch.current === e.pointerId) scrubTo(dayAt(e.clientX), true);
      return;
    }
    scrubTo(dayAt(e.clientX));
  };
  const leave = (e: ReactPointerEvent<HTMLDivElement>) => {
    // a touch leave is the finger lifting, which `up` already heard
    if (e.pointerType !== "touch") rest();
  };
  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    arm();
    if (e.pointerType !== "touch") return;
    touch.current = e.pointerId;
    scrubTo(dayAt(e.clientX), true);
  };
  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (touch.current !== e.pointerId) return;
    touch.current = null;
    rest();
  };

  const key = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const p = pos.current;
    const from = p.active ? p.day : LAST;
    let to: number;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") to = from - 1;
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") to = from + 1;
    else if (e.key === "PageDown") to = from - 7;
    else if (e.key === "PageUp") to = from + 7;
    else if (e.key === "Home") to = 0;
    else if (e.key === "End") to = LAST;
    else if (e.key === "Escape" && p.active) {
      e.preventDefault();
      rest();
      return;
    } else return;
    e.preventDefault();
    arm();
    scrubTo(Math.min(LAST, Math.max(0, to)));
  };

  /* ------------------------------------------------------- size and first */

  useEffect(() => {
    const el = chart.current;
    if (!el) return;
    const css = getComputedStyle(document.documentElement);
    const token = (name: string) => css.getPropertyValue(name).trim();
    ink.current = {
      ahead: "",
      behind: `color-mix(in srgb, ${token("--color-text-muted")} 45%, transparent)`,
    };
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && height > 0) setGeo(geometry(width, height));
    };
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(el);
    return () => {
      resize.disconnect();
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, []);

  // a new size puts the crosshair straight on its day, with no glide
  // biome-ignore lint/correctness/useExhaustiveDependencies: paint and show read refs
  useLayoutEffect(() => {
    if (!geo) return;
    const p = pos.current;
    p.target = p.x = geo.placed.xs[p.active ? p.day : LAST];
    const c = screen.current;
    if (c) {
      dpr.current = Math.min(2, window.devicePixelRatio || 1);
      c.width = Math.round(geo.w * dpr.current);
      c.height = Math.round(geo.h * dpr.current);
    }
    if (shown.current === null) show(LAST);
    paint();
  }, [geo]);

  // a new theme repaints the screen in its dither, once
  // biome-ignore lint/correctness/useExhaustiveDependencies: paint reads refs
  useLayoutEffect(() => {
    ink.current.ahead = `color-mix(in srgb, ${theme.dither} 70%, transparent)`;
    paint();
  }, [theme]);

  /* --------------------------------------------------------------- render */

  const ahead = `scrub-chart-clip-${uid}`;

  return (
    <div className="@container relative flex aspect-8/5 min-h-110 w-full sm:min-h-78 min-w-0 select-none flex-col gap-5 overflow-hidden rounded-lg bg-bg p-6 sm:p-8">
      <div className="flex flex-col gap-1.5">
        <span className="text-meta text-text-muted">Balance</span>
        <span
          ref={morph.ref as React.RefObject<HTMLSpanElement>}
          className="whitespace-nowrap font-medium text-[clamp(1.75rem,7.4cqw,2.5rem)] text-text-primary tabular-nums leading-none tracking-tight"
        />
        <span
          ref={delta}
          data-up="true"
          className="group flex items-center gap-1.5 text-body text-text-secondary tabular-nums"
        >
          <ArrowUpIcon className="size-3.5 shrink-0 translate-y-[0.09em] group-data-[up=false]:hidden" />
          <ArrowDownIcon className="size-3.5 shrink-0 translate-y-[0.09em] group-data-[up=true]:hidden" />
          <span ref={deltaText} />
          <span
            aria-hidden="true"
            className="inline-block size-1 shrink-0 rounded-full bg-stroke-strong"
          />
          <span ref={range} className="text-text-muted" />
        </span>
      </div>

      <div
        ref={chart}
        role="slider"
        tabIndex={0}
        aria-label="Balance over the past month"
        aria-valuemin={0}
        aria-valuemax={LAST}
        aria-valuenow={LAST}
        aria-describedby={`scrub-chart-how-${uid}`}
        data-active="false"
        onPointerEnter={enter}
        onPointerMove={move}
        onPointerLeave={leave}
        onPointerDown={down}
        onPointerUp={up}
        onPointerCancel={up}
        onKeyDown={key}
        onBlur={rest}
        className="group/chart relative -mx-6 min-h-0 flex-1 cursor-crosshair touch-pan-y transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-inset sm:-mx-8"
      >
        <canvas
          ref={screen}
          className="pointer-events-none absolute inset-0 size-full"
        />
        {geo && (
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 size-full overflow-visible"
          >
            <defs>
              <clipPath id={ahead}>
                <rect ref={clip} x="-8" y="-8" height={geo.h + 16} />
              </clipPath>
            </defs>

            {/* where the month opened */}
            <line
              x1={0}
              x2={geo.w}
              y1={geo.base}
              y2={geo.base}
              className="text-stroke-strong"
              stroke="currentColor"
              strokeDasharray="2 4"
              strokeLinecap="round"
            />

            {/* the line past the crosshair, quiet */}
            <path
              d={geo.line}
              fill="none"
              className="text-text-muted"
              stroke="currentColor"
              strokeOpacity="0.4"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            <g clipPath={`url(#${ahead})`}>
              <path
                d={geo.line}
                fill="none"
                style={{ stroke: theme.line }}
                className="transition-[stroke] duration-200"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </g>

            <g
              ref={cross}
              className="opacity-0 transition-opacity duration-150 group-data-[active=true]/chart:opacity-100"
            >
              <line
                x1={0}
                x2={0}
                y1={PAD.top - 4}
                y2={geo.h}
                className="text-stroke-strong"
                stroke="currentColor"
              />
            </g>

            <g ref={dot}>
              <circle
                r="9"
                style={{ fill: theme.line }}
                className="opacity-0 transition-[fill,opacity] duration-150 group-data-[active=true]/chart:opacity-10"
              />
              <circle
                r="4.5"
                style={{ fill: theme.line }}
                className="stroke-bg transition-[fill] duration-200"
                strokeWidth="2"
              />
            </g>
          </svg>
        )}

        <span
          ref={chip}
          aria-hidden="true"
          className="absolute top-0 left-0 whitespace-nowrap rounded-full bg-fill px-2 py-0.5 text-meta text-text-secondary tabular-nums opacity-0 transition-opacity duration-150 group-data-[active=true]/chart:opacity-100"
        />
      </div>

      <fieldset className="flex items-center justify-center gap-2.5">
        <legend className="sr-only">Theme</legend>
        {THEMES.map((t, i) => (
          <label
            key={t.slug}
            className={cn(
              "relative size-5 cursor-pointer rounded-full transition-all duration-200",
              "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-text-primary/15 has-[:focus-visible]:outline-offset-4",
              i === themeIndex
                ? "ring-2 ring-stroke-strong ring-offset-2 ring-offset-bg"
                : "opacity-70 hover:opacity-100",
            )}
            style={{
              background: `linear-gradient(135deg, ${t.line} 50%, ${t.dither} 50%)`,
            }}
          >
            <input
              type="radio"
              name={`scrub-chart-theme-${uid}`}
              value={t.slug}
              checked={i === themeIndex}
              onChange={() => setThemeIndex(i)}
              className="sr-only"
            />
            <span className="sr-only">{t.name}</span>
          </label>
        ))}
      </fieldset>

      <span id={`scrub-chart-how-${uid}`} className="sr-only">
        Use the arrow keys to move a day, Page Up and Page Down to move a week,
        and Escape to go back to the latest day.
      </span>
      <div className="pointer-events-none absolute inset-0 rounded-lg ring-1 ring-stroke ring-inset" />
    </div>
  );
}
