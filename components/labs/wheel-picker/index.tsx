"use client";

import { useReducedMotion } from "motion/react";
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
  band,
  RADIUS,
  REACH,
  ROW,
  release,
  rowsAt,
  type Spec,
  STEP,
  valueAt,
} from "./wheel";
import { armWheel, detent, thud } from "./wheel-sound";

/*
 * The iOS time picker: three drums of numbers you flick, that coast and land
 * on a row with a click. `wheel.ts` is the numbers and `wheel-sound.ts` the
 * click. This file draws the drums, hears the hand and says what the time
 * means.
 *
 * **Nothing renders while a drum turns.** Each drum is one float, and every
 * row's transform and text are written straight to the nodes from it.
 */

const HOUR: Spec = { count: 12, loop: true, label: (v) => String(v + 1) };
const MINUTE: Spec = {
  count: 60,
  loop: true,
  label: (v) => String(v).padStart(2, "0"),
};
const MERIDIEM: Spec = {
  count: 2,
  loop: false,
  label: (v) => (v ? "PM" : "AM"),
};
const WHEELS = [HOUR, MINUTE, MERIDIEM] as const;
const NAMES = ["Hour", "Minute", "AM or PM"] as const;

/** 7:30 AM, the time an alarm is set to */
const START = [6, 30, 0] as const;

/** the drum's height on screen, which is its diameter */
const HEIGHT = Math.round(RADIUS * 2);

/** how long a turn of the trackpad waits before the drum settles on a row */
const SETTLE = 120;

/*
 * A coast counts as arrived, for the landing's click, inside this many rows of
 * its row. The decay's tail runs on well past what an eye can see, and a click
 * that waits for it lands half a second after the drum has visibly stopped.
 */
const ARRIVED = 0.08;

/** the fastest a drum may be thrown, in rows a second */
const FASTEST = 80;

/** how long typed digits wait for the next one */
const TYPE = 900;

/*
 * Each wheel's width and where its text sits, the way iOS sets the three: the
 * hour against the minute's edge, the minute against the hour's, and AM or PM
 * a little apart from both.
 */
const WIDTH = ["w-[4.25rem]", "w-[4.25rem]", "w-20"] as const;
const ALIGN = [
  "justify-end pr-2",
  "justify-start pl-2",
  "justify-start pl-4",
] as const;

/*
 * Above and below the band the rows are grey and fade toward the drum's edge,
 * and inside it they are black. Two copies of every row do that: a grey one
 * with the band cut out of it, and a black one clipped to the band, so the
 * colour changes exactly at the band's edge whatever the row is doing.
 */
const HALF = ROW / 2;
const MUTED_MASK = `linear-gradient(to bottom, transparent 0, #000 16%, #000 calc(50% - ${HALF}px), transparent calc(50% - ${HALF}px), transparent calc(50% + ${HALF}px), #000 calc(50% + ${HALF}px), #000 84%, transparent 100%)`;
const BAND_CLIP = `inset(calc(50% - ${HALF}px) 0 calc(50% - ${HALF}px) 0)`;

interface Drum {
  /** where the drum is drawn, in rows */
  shown: number;
  /** the row a glide is heading for, or null when nothing is moving it */
  land: number | null;
  /** the glide's time constant, in seconds */
  tau: number;
  /** the row last in the band, so a crossing is heard once */
  row: number;
  /** whether a hand has it */
  held: boolean;
  /** whether this glide's landing has been heard */
  heard: boolean;
}

interface Grip {
  index: number;
  id: number;
  y: number;
  from: number;
  moved: boolean;
  samples: [number, number][];
  /** the coast's speed when the hand caught it, in rows a second */
  carry: number;
}

function remaining(values: readonly number[]): string {
  const hour = (values[0] + 1) % 12;
  const at = (hour + values[2] * 12) * 60 + values[1];
  const now = new Date();
  const from = now.getHours() * 60 + now.getMinutes();
  const gap = (at - from + 1440) % 1440 || 1440;
  const h = Math.floor(gap / 60);
  const m = gap % 60;
  if (!h) return `Rings in ${m} min`;
  if (!m) return `Rings in ${h} hr`;
  return `Rings in ${h} hr ${m} min`;
}

export default function WheelPicker() {
  const stage = useRef<HTMLDivElement>(null);
  const columns = useRef<(HTMLDivElement | null)[]>([]);
  // slots[wheel][layer][row], layer 0 the grey drum and 1 the black band
  const slots = useRef<(HTMLDivElement | null)[][][]>(
    WHEELS.map(() => [[], []]),
  );
  const drums = useRef<Drum[]>(
    START.map((v) => ({
      shown: v,
      land: null,
      tau: 0.1,
      row: v,
      held: false,
      heard: true,
    })),
  );
  const grip = useRef<Grip | null>(null);
  const frame = useRef(0);
  const clock = useRef(0);
  const settleTimer = useRef<number[]>([0, 0, 0]);
  const typed = useRef({ index: -1, text: "", at: 0 });
  const armed = useRef(false);
  const buzzed = useRef(0);
  const reduceValue = useReducedMotion() ?? false;
  const reduce = useRef(reduceValue);
  reduce.current = reduceValue;

  const [readout, setReadout] = useState(() => remaining(START));
  const readoutRef = useRef(readout);

  const values = useCallback(
    () => drums.current.map((d, i) => valueAt(WHEELS[i], d.land ?? d.shown)),
    [],
  );

  /* ------------------------------------------------------------- drawing */

  const paint = useCallback((i: number) => {
    const d = drums.current[i];
    const spec = WHEELS[i];
    const base = Math.round(d.shown);
    for (let k = -REACH; k <= REACH; k++) {
      const row = base + k;
      const angle = (row - d.shown) * STEP;
      const inside =
        Math.abs(angle) < 90 && (spec.loop || (row >= 0 && row < spec.count));
      const text = inside ? spec.label(valueAt(spec, row)) : "";
      for (let layer = 0; layer < 2; layer++) {
        const el = slots.current[i][layer][k + REACH];
        if (!el) continue;
        if (!inside) {
          el.style.visibility = "hidden";
          continue;
        }
        el.style.visibility = "visible";
        if (el.textContent !== text) el.textContent = text;
        el.style.transform = `translateZ(${-RADIUS}px) rotateX(${-angle}deg) translateZ(${RADIUS}px)`;
        if (layer === 0)
          el.style.opacity = Math.cos((angle * Math.PI) / 180).toFixed(3);
      }
    }
  }, []);

  /** the value the spinbutton reports, written to the node */
  const announce = useCallback((i: number) => {
    const el = columns.current[i];
    if (!el) return;
    const v = valueAt(WHEELS[i], drums.current[i].shown);
    el.setAttribute("aria-valuenow", String(i === 0 ? v + 1 : v));
    el.setAttribute("aria-valuetext", WHEELS[i].label(v));
  }, []);

  /* --------------------------------------------------------------- motion */

  /*
   * The readout says where the wheels are going, not where they are. A coast
   * knows its row the moment the hand lets go, so the line changes then rather
   * than at the end of a tail nobody is watching.
   */
  const settled = useCallback(() => {
    if (drums.current.some((d) => d.held)) return;
    const next = remaining(values());
    if (next !== readoutRef.current) {
      readoutRef.current = next;
      setReadout(next);
    }
  }, [values]);

  // the loop and `glide` call each other, so both live in refs
  const glideRef = useRef<(i: number, land: number, tau: number) => void>(
    () => {},
  );

  const buzz = useCallback((ms: number, gap: number) => {
    const t = performance.now();
    if (!armed.current || t - buzzed.current < gap) return;
    buzzed.current = t;
    navigator.vibrate?.(ms);
  }, []);

  /**
   * A drum crossing rows: one click, and a buzz on a phone. The hour drum
   * passing between 11 and 12 turns AM and PM over, the way a clock does. The
   * row a coast is landing on stays quiet, since its landing is heard instead.
   */
  const cross = useCallback(
    (i: number) => {
      const d = drums.current[i];
      const r = Math.round(d.shown);
      if (r === d.row) return;
      if (i === 0) {
        const dir = Math.sign(r - d.row);
        for (let x = d.row; x !== r; x += dir) {
          const a = valueAt(HOUR, x);
          const b = valueAt(HOUR, x + dir);
          if ((a === 10 && b === 11) || (a === 11 && b === 10)) {
            const m = drums.current[2];
            const now = valueAt(MERIDIEM, m.land ?? m.shown);
            glideRef.current(2, 1 - now, 0.14);
          }
        }
      }
      d.row = r;
      if (d.land === null || r !== Math.round(d.land)) {
        detent(i);
        buzz(3, 35);
      }
      announce(i);
    },
    [announce, buzz],
  );

  /** a drum arriving on its row: a heavier, lower click and a firmer buzz */
  const arrive = useCallback(
    (i: number) => {
      drums.current[i].heard = true;
      thud(i);
      buzz(8, 0);
    },
    [buzz],
  );

  const loop = useCallback(
    function step(now: number) {
      frame.current = 0;
      const dt = Math.min(0.05, (now - clock.current) / 1000);
      clock.current = now;
      let busy = false;
      drums.current.forEach((d, i) => {
        if (d.land === null) return;
        d.shown = d.land + (d.shown - d.land) * Math.exp(-dt / d.tau);
        if (!d.heard && Math.abs(d.land - d.shown) < ARRIVED) arrive(i);
        if (Math.abs(d.land - d.shown) < 0.01) {
          d.shown = d.land;
          d.land = null;
        } else busy = true;
        paint(i);
        cross(i);
      });
      if (busy) frame.current = requestAnimationFrame(step);
      else settled();
    },
    [paint, cross, settled, arrive],
  );

  const glide = useCallback(
    (i: number, land: number, tau: number) => {
      const d = drums.current[i];
      if (reduce.current) {
        d.shown = land;
        d.land = null;
        paint(i);
        cross(i);
        arrive(i);
        settled();
        return;
      }
      d.land = land;
      d.tau = tau;
      d.heard = false;
      settled();
      if (!frame.current) {
        clock.current = performance.now();
        frame.current = requestAnimationFrame(loop);
      }
    },
    [paint, cross, settled, loop, arrive],
  );
  glideRef.current = glide;

  /** a glide to a value, the short way round on a wheel that loops */
  const goTo = useCallback(
    (i: number, value: number) => {
      const spec = WHEELS[i];
      const d = drums.current[i];
      const from = Math.round(d.land ?? d.shown);
      let delta = value - valueAt(spec, from);
      if (spec.loop) {
        delta = ((delta % spec.count) + spec.count) % spec.count;
        if (delta > spec.count / 2) delta -= spec.count;
      }
      glide(i, from + delta, 0.11);
    },
    [glide],
  );

  /* ----------------------------------------------------------- the hand */

  const arm = () => {
    armed.current = true;
    armWheel();
  };

  const onDown = (i: number) => (e: ReactPointerEvent<HTMLDivElement>) => {
    if (grip.current || e.button !== 0) return;
    arm();
    const d = drums.current[i];
    // a hand on a coasting drum catches it where it is, and keeps its speed
    // for a flick that follows
    const carry = d.land === null ? 0 : (d.land - d.shown) / d.tau;
    d.land = null;
    d.held = true;
    grip.current = {
      index: i,
      id: e.pointerId,
      y: e.clientY,
      from: d.shown,
      moved: false,
      samples: [[e.timeStamp, d.shown]],
      carry,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = grip.current;
    if (!g || g.id !== e.pointerId) return;
    const dy = e.clientY - g.y;
    if (!g.moved && Math.abs(dy) < 3) return;
    if (!g.moved) {
      g.moved = true;
      if (stage.current) stage.current.dataset.carry = "true";
    }
    const raw = g.from - dy / ROW;
    const d = drums.current[g.index];
    d.shown = band(WHEELS[g.index], raw);
    g.samples.push([e.timeStamp, raw]);
    while (g.samples.length > 2 && e.timeStamp - g.samples[0][0] > 100)
      g.samples.shift();
    paint(g.index);
    cross(g.index);
  };

  const onUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = grip.current;
    if (!g || g.id !== e.pointerId) return;
    grip.current = null;
    if (stage.current) stage.current.dataset.carry = "false";
    const i = g.index;
    const spec = WHEELS[i];
    const d = drums.current[i];
    d.held = false;
    if (!g.moved) {
      // a press that only caught a coast stops it on the nearest row
      if (Math.abs(g.carry) > 1) {
        glide(i, Math.round(d.shown), 0.1);
        return;
      }
      // a tap goes to the row drawn under it
      const box = e.currentTarget.getBoundingClientRect();
      const k = Math.round(rowsAt(e.clientY - (box.top + box.height / 2)));
      let land = Math.round(d.shown) + k;
      if (!spec.loop) land = Math.min(spec.count - 1, Math.max(0, land));
      glide(i, land, 0.12);
      return;
    }
    // the hand's speed over its last 80ms, and none if it had stopped
    const last = g.samples[g.samples.length - 1];
    const first = g.samples.find((s) => last[0] - s[0] <= 80) ?? g.samples[0];
    const span = (last[0] - first[0]) / 1000;
    const still = e.timeStamp - last[0] > 60;
    let velocity = span > 0 && !still ? (last[1] - first[1]) / span : 0;
    // a flick the way the drum was already going adds to its speed, so two or
    // three quick flicks race through the rows the way they do on iOS
    if (Math.abs(velocity) > 2 && Math.sign(velocity) === Math.sign(g.carry))
      velocity = Math.max(-FASTEST, Math.min(FASTEST, velocity + g.carry));
    const { land, tau } = release(spec, d.shown, velocity);
    glide(i, land, tau);
  };

  /* -------------------------------------------------------- the keyboard */

  const onKey = (i: number) => (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const spec = WHEELS[i];
    const d = drums.current[i];
    const from = Math.round(d.land ?? d.shown);
    const step = (n: number) => {
      let land = from + n;
      if (!spec.loop) land = Math.min(spec.count - 1, Math.max(0, land));
      glide(i, land, 0.09);
    };
    const keys: Record<string, () => void> = {
      ArrowUp: () => step(1),
      ArrowDown: () => step(-1),
      PageUp: () => step(5),
      PageDown: () => step(-5),
      Home: () => goTo(i, 0),
      End: () => goTo(i, spec.count - 1),
    };
    if (keys[e.key]) {
      e.preventDefault();
      arm();
      keys[e.key]();
      return;
    }
    // AM and PM by their letter, the way a native picker takes them
    if (i === 2) {
      const k = e.key.toLowerCase();
      if (k === "a" || k === "p") {
        e.preventDefault();
        arm();
        goTo(2, k === "p" ? 1 : 0);
      }
      return;
    }
    // digits type a value, and a second digit inside the window joins the first
    if (!/^\d$/.test(e.key)) return;
    e.preventDefault();
    arm();
    const t = performance.now();
    const buf = typed.current;
    const joined =
      buf.index === i && t - buf.at < TYPE ? buf.text + e.key : e.key;
    const n = Number(joined);
    const valid = i === 0 ? n >= 1 && n <= 12 : n <= 59;
    const text = valid ? joined : e.key;
    typed.current = { index: i, text, at: t };
    const v = Number(text);
    if (i === 0 && v >= 1 && v <= 12) goTo(0, v - 1);
    if (i === 1 && v <= 59) goTo(1, v);
  };

  /* ----------------------------------------------------- setup and wheel */

  useLayoutEffect(() => {
    WHEELS.forEach((_, i) => {
      paint(i);
      announce(i);
    });
  }, [paint, announce]);

  // a mouse notch moves one row, and a trackpad turns the drum by hand
  useEffect(() => {
    const els = columns.current;
    const timers = settleTimer.current;
    const handlers = els.map((el, i) => {
      if (!el) return null;
      const spec = WHEELS[i];
      const onWheel = (e: WheelEvent) => {
        if (e.ctrlKey || grip.current) return;
        const d = drums.current[i];
        const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
        const notch = e.deltaMode !== 0 || Math.abs(dy) >= 50;
        if (notch) {
          const from = Math.round(d.land ?? d.shown);
          let land = from + Math.sign(dy);
          if (!spec.loop) land = Math.min(spec.count - 1, Math.max(0, land));
          if (land === from) return;
          e.preventDefault();
          glide(i, land, 0.09);
          return;
        }
        let next = d.shown + dy / ROW;
        if (!spec.loop) next = Math.min(spec.count - 1, Math.max(0, next));
        if (next === d.shown) return;
        e.preventDefault();
        d.land = null;
        d.held = true;
        d.shown = next;
        paint(i);
        cross(i);
        window.clearTimeout(timers[i]);
        timers[i] = window.setTimeout(() => {
          d.held = false;
          glide(i, Math.round(d.shown), 0.1);
        }, SETTLE);
      };
      el.addEventListener("wheel", onWheel, { passive: false });
      return { el, onWheel };
    });
    return () => {
      for (const h of handlers) h?.el.removeEventListener("wheel", h.onWheel);
      for (const t of timers) window.clearTimeout(t);
    };
  }, [glide, paint, cross]);

  // the readout counts down with the real clock
  useEffect(() => {
    const id = window.setInterval(settled, 20_000);
    const f = frame;
    return () => {
      window.clearInterval(id);
      cancelAnimationFrame(f.current);
    };
  }, [settled]);

  /* ---------------------------------------------------------------- render */

  return (
    <div
      ref={stage}
      className="relative flex h-[25rem] w-full select-none flex-col items-center justify-center gap-5 overflow-hidden rounded-lg bg-fill data-[carry=true]:cursor-grabbing data-[carry=true]:[&_*]:cursor-grabbing"
    >
      <div
        className="relative flex rounded-[1.75rem] bg-bg px-6"
        style={{
          height: HEIGHT + 16,
          boxShadow:
            "0 1px 2px rgba(0,0,0,0.04), 0 14px 36px -14px rgba(0,0,0,0.16)",
        }}
      >
        {/* the band the value sits in, across all three wheels */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-3.5 top-1/2 -translate-y-1/2 rounded-[0.75rem] bg-fill-hover"
          style={{ height: ROW }}
        />
        {WHEELS.map((spec, i) => (
          <div
            key={NAMES[i]}
            ref={(el) => {
              columns.current[i] = el;
            }}
            role="spinbutton"
            tabIndex={0}
            aria-label={NAMES[i]}
            aria-valuemin={i === 0 ? 1 : 0}
            aria-valuemax={i === 0 ? 12 : spec.count - 1}
            onPointerDown={onDown(i)}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onKeyDown={onKey(i)}
            className={`group relative h-full cursor-grab touch-none focus-visible:outline-none ${WIDTH[i]}`}
          >
            {[0, 1].map((layer) => (
              <div
                key={layer}
                aria-hidden="true"
                className={
                  layer === 0
                    ? "absolute inset-0 text-text-muted"
                    : "absolute inset-0 text-text-primary"
                }
                style={{
                  perspective: 1000,
                  ...(layer === 0
                    ? { maskImage: MUTED_MASK, WebkitMaskImage: MUTED_MASK }
                    : { clipPath: BAND_CLIP }),
                }}
              >
                {Array.from({ length: REACH * 2 + 1 }, (_, k) => (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: a slot is its position on the drum
                    key={k}
                    ref={(el) => {
                      slots.current[i][layer][k] = el;
                    }}
                    className={`absolute inset-x-0 top-1/2 flex items-center whitespace-nowrap text-[1.75rem] normal-case tabular-nums ${ALIGN[i]}`}
                    style={{ height: ROW, marginTop: -HALF }}
                  />
                ))}
              </div>
            ))}
            {/* the open column's place in the band, marked for the keyboard */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0.5 top-1/2 -translate-y-1/2 rounded-md opacity-0 ring-2 ring-text-secondary/50 transition-opacity duration-150 group-focus-visible:opacity-100"
              style={{ height: ROW - 4 }}
            />
          </div>
        ))}
      </div>
      <span
        aria-live="polite"
        className="whitespace-nowrap text-meta text-text-muted"
      >
        <TextMorph duration={220} ease="cubic-bezier(0.4, 0, 0.2, 1)">
          {readout}
        </TextMorph>
      </span>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-lg ring-1 ring-stroke ring-inset"
      />
    </div>
  );
}
