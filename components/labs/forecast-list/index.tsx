"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import { FORECASTS, type Forecast, type Kind, REST_LINE } from "./forecasts";
import {
  buildMask,
  drawFx,
  Lightning,
  type Mask,
  makeWordFx,
  type WordFx,
} from "./word";

/*
 * A week of forecasts as five rows of type. Point at a row and the other four
 * dim, a card of that day's sky opens off the list's left edge, and the word
 * itself takes the weather: snow settles on its letters, rain runs down them,
 * fog drifts through, a storm flickers it.
 *
 * **The card is one card.** It opens on the first row and closes when the
 * pointer leaves the list. In between it rides from row to row while its sky
 * slides through it in the direction of travel, and the icon on it shrinks
 * out where it is and the next one grows in.
 *
 * One frame loop drives the word effects and the storm's flashes, and it
 * stops when the last word has let its weather go. Nothing renders per frame.
 */

/** the card opening and closing */
const OPEN = { duration: 0.24, ease: [0.23, 1, 0.32, 1] } as const;
const SHUT = { duration: 0.16, ease: [0.4, 0, 1, 1] } as const;
/** the card riding from row to row, critically damped so it never overshoots */
const RIDE = { type: "spring", stiffness: 420, damping: 42 } as const;
/** a sky sliding through the card */
const SLIDE = { duration: 0.42, ease: [0.23, 1, 0.32, 1] } as const;
/**
 * How far a sky travels in and out, as a share of its own layer, which is
 * 180% of the card. So this is about 43% of the card.
 */
const TRAVEL = 24;

/**
 * A sky's layer overhangs the card by 40% above and below and fades out over
 * that overhang, so the edge leading a slide is a soft ramp rather than a
 * line. With a hard edge, two near-solid skies met in a visible seam for the
 * length of every row change. The ramp stops exactly where the card starts,
 * 40 of 180, so a settled sky is solid over the whole card.
 */
const FEATHER =
  "linear-gradient(to bottom, transparent 0%, black 22.3%, black 77.7%, transparent 100%)";

/** the least clear stage kept above and below the card, in px */
const MARGIN = 16;
/**
 * How far the word overlay reaches past the list, in px. Flakes and drops
 * start above the first row, and splashes and shaken snow land past the sides.
 */
const REACH = { x: 28, top: 48, bottom: 24 };

interface Pick {
  index: number;
  /** 1 while moving down the list, -1 while moving up */
  dir: 1 | -1;
}

interface Geo {
  /** each row's middle, in the card slot's own coordinates */
  mids: number[];
  size: number;
  /** the card's top may not leave this band, which keeps it on the stage */
  lo: number;
  hi: number;
}

interface Live {
  fx: WordFx;
  mask: Mask;
  kind: Kind;
}

const hovers = (e: PointerEvent | React.PointerEvent) =>
  e.pointerType === "mouse" || e.pointerType === "pen";

/** letting go of a word with weather on it */
const SHAKE: Keyframe[] = [
  { transform: "translateX(0)" },
  { transform: "translateX(-2.5px)" },
  { transform: "translateX(2px)" },
  { transform: "translateX(-1px)" },
  { transform: "translateX(0)" },
];

export default function ForecastList() {
  const stage = useRef<HTMLDivElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const overlay = useRef<HTMLCanvasElement>(null);
  const rows = useRef<(HTMLButtonElement | null)[]>([]);

  const [pick, setPick] = useState<Pick | null>(null);
  const [geo, setGeo] = useState<Geo | null>(null);
  const reduced = useReducedMotion() ?? false;

  // the engine lives in refs, since the loop reads it outside any render
  const pickRef = useRef(pick);
  const reducedRef = useRef(reduced);
  const lightning = useRef<Lightning | null>(null);
  const masks = useRef<(Mask | null)[]>([]);
  const live = useRef(new Map<number, Live>());
  const raf = useRef(0);
  const last = useRef(0);

  const bolt = useCallback(() => {
    lightning.current ??= new Lightning();
    return lightning.current;
  }, []);

  const frame = useCallback(
    function frame(now: number) {
      raf.current = 0;
      const still = reducedRef.current;
      const dt = last.current ? Math.min(0.05, (now - last.current) / 1000) : 0;
      last.current = now;
      const flash = bolt();

      const storming = [...live.current.values()].some(
        (l) => l.kind === "storm",
      );
      if (storming) flash.step(dt);
      else flash.level = 0;

      const canvas = overlay.current;
      const octx = canvas?.getContext("2d");
      if (canvas && octx) {
        const dpr = canvas.width / Math.max(1, canvas.clientWidth);
        octx.setTransform(1, 0, 0, 1, 0, 0);
        octx.clearRect(0, 0, canvas.width, canvas.height);
        for (const [i, l] of live.current) {
          l.fx.step(dt);
          drawFx(octx, l.fx, l.mask, dpr);
          const row = rows.current[i];
          if (row) {
            const blur = l.fx.blur;
            row.style.filter = blur > 0.02 ? `blur(${blur.toFixed(2)}px)` : "";
          }
          if (l.fx.done) live.current.delete(i);
        }
      }

      if (!still && live.current.size > 0) {
        raf.current = requestAnimationFrame(frame);
      } else {
        last.current = 0;
      }
    },
    [bolt],
  );

  const kick = useCallback(() => {
    if (!raf.current) raf.current = requestAnimationFrame(frame);
  }, [frame]);

  // the handle goes back to 0 with the cancel, or the second mount in dev
  // finds a handle for a frame that will never run and never starts the loop
  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current);
      raf.current = 0;
    },
    [],
  );

  useEffect(() => {
    reducedRef.current = reduced;
  }, [reduced]);

  const choose = useCallback((index: number) => {
    setPick((prev) =>
      prev?.index === index
        ? prev
        : { index, dir: prev && index < prev.index ? -1 : 1 },
    );
  }, []);

  const clear = useCallback(() => setPick(null), []);

  // measured rather than derived, since the rows are type and their height is
  // whatever the font and the container query make of them
  useLayoutEffect(() => {
    const s = stage.current;
    const box = slot.current;
    if (!s || !box) return;

    const measure = () => {
      const st = s.getBoundingClientRect();
      const sl = box.getBoundingClientRect();
      const size = sl.width;
      setGeo({
        mids: rows.current.map((row) => {
          const r = row?.getBoundingClientRect();
          return r ? r.top + r.height / 2 - sl.top : 0;
        }),
        size,
        lo: st.top + MARGIN - sl.top,
        hi: st.bottom - MARGIN - size - sl.top,
      });

      const canvas = overlay.current;
      if (canvas) {
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        canvas.width = Math.round(canvas.clientWidth * dpr);
        canvas.height = Math.round(canvas.clientHeight * dpr);
      }
      // a mask is a picture of the text where it sat, so any relayout retires
      // every mask and whatever weather was riding on one
      masks.current = [];
      for (const [i] of live.current) {
        const row = rows.current[i];
        if (row) row.style.filter = "";
      }
      live.current.clear();
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(s);
    document.fonts?.ready.then(measure);
    return () => observer.disconnect();
  }, []);

  // what a pick does to the engine: the card's front, and which word wears
  // the weather
  useEffect(() => {
    pickRef.current = pick;
    const still = reducedRef.current;

    for (const [i, l] of live.current) {
      if (i === pick?.index) continue;
      if (l.fx.shakes && !still) rows.current[i]?.animate(SHAKE, 280);
      l.fx.release();
    }

    if (pick && !still) {
      const found = live.current.get(pick.index);
      const row = rows.current[pick.index];
      const canvas = overlay.current;
      if (found) {
        found.fx.revive();
      } else if (row && canvas) {
        const mask =
          masks.current[pick.index] ??
          buildMask(row, canvas.getBoundingClientRect());
        masks.current[pick.index] = mask;
        if (mask) {
          const kind = FORECASTS[pick.index].kind;
          live.current.set(pick.index, {
            fx: makeWordFx(kind, mask, bolt()),
            mask,
            kind,
          });
        }
      }
    }
    kick();
  }, [pick, kick, bolt]);

  // the list is a region the pointer passes through rather than a control, so
  // its listeners are bound to the node, which is the call `document-pocket`
  // makes for its own stage
  useEffect(() => {
    const ul = list.current;
    const s = stage.current;
    if (!ul || !s) return;

    // a touch `pointerleave` is the finger lifting, not the finger leaving,
    // and it lands right after the tap that picked the row
    const leave = (e: PointerEvent) => {
      if (hovers(e)) clear();
    };
    const blur = (e: FocusEvent) => {
      if (!ul.contains(e.relatedTarget as Node | null)) clear();
    };
    // a finger has no leave, so a tap on bare stage is its way out
    const tap = (e: PointerEvent) => {
      if (hovers(e)) return;
      if (!(e.target as Element).closest("button")) clear();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") clear();
    };

    ul.addEventListener("pointerleave", leave);
    ul.addEventListener("focusout", blur);
    s.addEventListener("pointerup", tap);
    window.addEventListener("keydown", key);
    return () => {
      ul.removeEventListener("pointerleave", leave);
      ul.removeEventListener("focusout", blur);
      s.removeEventListener("pointerup", tap);
      window.removeEventListener("keydown", key);
    };
  }, [clear]);

  const top =
    pick && geo
      ? Math.min(
          Math.max(geo.mids[pick.index] - geo.size / 2, geo.lo),
          Math.max(geo.hi, geo.lo),
        )
      : 0;

  const forecast = pick ? FORECASTS[pick.index] : null;

  return (
    <div
      ref={stage}
      className="@container relative flex aspect-8/5 min-h-78 w-full select-none items-center justify-center overflow-hidden rounded-lg bg-bg ring-1 ring-stroke ring-inset"
    >
      {/*
       * The list is what is centred, and the card hangs off its left edge, so
       * the stage at rest is balanced with no card on it. Centring the list
       * and an empty card slot together pushed the type right of the middle.
       */}
      <div className="relative flex flex-col gap-[3cqw]">
        <div
          ref={slot}
          aria-hidden="true"
          className="absolute top-0 right-full mr-[5cqw] w-[15cqw]"
        >
          <AnimatePresence>
            {pick && geo && forecast && (
              <motion.div
                key="card"
                className="absolute inset-x-0 top-0 aspect-square overflow-hidden rounded-[22%]"
                initial={{
                  opacity: 0,
                  scale: 0.94,
                  y: top,
                  backgroundColor: forecast.ground,
                }}
                // the ground under the skies eases to the new colour on the
                // slide's own clock, since switching it on the frame of the
                // change showed through the two skies as they crossed
                animate={{
                  opacity: 1,
                  scale: 1,
                  y: top,
                  backgroundColor: forecast.ground,
                }}
                exit={{ opacity: 0, scale: 0.96, transition: SHUT }}
                transition={{
                  opacity: OPEN,
                  scale: OPEN,
                  y: RIDE,
                  backgroundColor: SLIDE,
                }}
              >
                <AnimatePresence initial={false} custom={pick.dir}>
                  <Sky key={pick.index} forecast={forecast} dir={pick.dir} />
                </AnimatePresence>
                <AnimatePresence initial={false}>
                  <Tile key={pick.index} forecast={forecast} />
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="relative">
          <ul ref={list} className="flex flex-col">
            {FORECASTS.map((f, i) => (
              <li key={f.name}>
                <button
                  ref={(node) => {
                    rows.current[i] = node;
                  }}
                  type="button"
                  aria-expanded={pick?.index === i}
                  aria-controls="forecast-line"
                  onPointerEnter={(e) => {
                    if (hovers(e)) choose(i);
                  }}
                  onFocus={() => choose(i)}
                  onClick={() => choose(i)}
                  className={cn(
                    "block w-full cursor-pointer rounded-md py-[0.06em] text-left font-medium text-[clamp(1.125rem,5.4cqw,2rem)] leading-[1.08] tracking-[-0.03em] transition-colors duration-200",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2",
                    pick === null || pick.index === i
                      ? "text-text-primary"
                      : "text-stroke-strong",
                  )}
                >
                  {f.name}
                </button>
              </li>
            ))}
          </ul>
          <canvas
            ref={overlay}
            className="pointer-events-none absolute"
            style={{
              left: -REACH.x,
              top: -REACH.top,
              width: `calc(100% + ${REACH.x * 2}px)`,
              height: `calc(100% + ${REACH.top + REACH.bottom}px)`,
            }}
          />
        </div>

        <div
          id="forecast-line"
          className="relative h-[6.4em] w-[min(16rem,max(46cqw,11rem))] text-body leading-[1.6] @md:h-[3.2em]"
        >
          <AnimatePresence initial={false}>
            <motion.p
              key={pick?.index ?? "rest"}
              variants={LINE}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                duration: 0.22,
                delay: 0.06,
                ease: [0.23, 1, 0.32, 1],
              }}
              className={cn(
                "absolute inset-x-0 top-0",
                forecast ? "text-text-secondary" : "text-text-muted",
              )}
            >
              {forecast ? forecast.line : REST_LINE}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/**
 * A fade and nothing else. The sky already carries the direction of travel,
 * and a line of prose that moves as well reads as a second thing sliding.
 */
const LINE = {
  enter: { opacity: 0 },
  center: { opacity: 1 },
  // the old line is gone before the new one is half in, so the two never
  // sit on top of each other at half strength
  exit: {
    opacity: 0,
    transition: { duration: 0.1, ease: [0.4, 0, 1, 1] as const },
  },
};

const SKY = {
  enter: (dir: number) => ({ y: `${-dir * TRAVEL}%`, opacity: 0 }),
  center: { y: "0%", opacity: 1 },
  exit: (dir: number) => ({ y: `${dir * TRAVEL}%`, opacity: 0 }),
};

/**
 * Where each of the three blobs sits and how it drifts. `top` is a share of
 * the sky's layer, which is 180% of the card and starts 40% above it. The
 * same for every sky, since what differs between them is colour.
 */
const DRIFT = [
  { left: -20, top: 8, x: [0, 18, -6], y: [0, 12, 22], s: 7 },
  { left: 35, top: 39, x: [0, -22, -8], y: [0, -14, 6], s: 9 },
  { left: -5, top: 53, x: [0, 14, 26], y: [0, -20, -8], s: 8 },
] as const;

/**
 * One day's sky. It slides in from the side the pointer came from and out the
 * side it is heading, so moving down the list scrolls the skies down through
 * the card, and it keeps its own `dir` through the exit because the presence
 * above hands the current one to whatever is leaving.
 */
function Sky({ forecast, dir }: { forecast: Forecast; dir: 1 | -1 }) {
  return (
    <motion.div
      className="absolute inset-x-0 -top-[40%] h-[180%]"
      style={{
        backgroundColor: forecast.ground,
        maskImage: FEATHER,
        WebkitMaskImage: FEATHER,
      }}
      custom={dir}
      variants={SKY}
      initial="enter"
      animate="center"
      exit="exit"
      transition={SLIDE}
    >
      {DRIFT.map((d, i) => (
        <motion.span
          // biome-ignore lint/suspicious/noArrayIndexKey: the three blobs are fixed slots
          key={i}
          className="absolute aspect-square w-[95%] rounded-full"
          style={{
            left: `${d.left}%`,
            top: `${d.top}%`,
            background: `radial-gradient(closest-side, ${forecast.blobs[i]}, transparent)`,
          }}
          animate={{ x: d.x.map((v) => `${v}%`), y: d.y.map((v) => `${v}%`) }}
          transition={{
            duration: d.s,
            ease: "easeInOut",
            repeat: Number.POSITIVE_INFINITY,
            repeatType: "mirror",
          }}
        />
      ))}
    </motion.div>
  );
}

/** the white tile and its icon, which shrink out and grow back in place */
function Tile({ forecast }: { forecast: Forecast }) {
  const Glyph = forecast.icon;
  return (
    <motion.div
      className="absolute top-1/2 left-1/2 -mt-[18%] -ml-[18%] grid size-[36%] place-items-center rounded-[28%] bg-bg"
      initial={{ opacity: 0, scale: 0.55 }}
      animate={{
        opacity: 1,
        scale: 1,
        transition: { duration: 0.26, delay: 0.12, ease: [0.23, 1, 0.32, 1] },
      }}
      exit={{
        opacity: 0,
        scale: 0.55,
        transition: { duration: 0.14, ease: [0.4, 0, 1, 1] },
      }}
    >
      <Glyph className="size-[62%]" style={{ color: forecast.mark }} />
    </motion.div>
  );
}
