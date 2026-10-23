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
import {
  angleOf,
  banded,
  caughtAt,
  DEG,
  lensOf,
  RAW_MAX,
  rawOf,
  readout,
  release,
  rulerAngle,
  STOPS,
  short,
  TICKS,
  tickOf,
  ZMAX,
  ZMIN,
  zoomOf,
} from "./dial";
import { SCENE, Scene } from "./scene";
import { armZoom, mark, stop } from "./zoom-sound";

/*
 * The iPhone camera's zoom control. A pill of lenses at rest: tap one and the
 * camera zooms there. Hold it, or drag across it, and it opens into a curved
 * ruler you scrub, which catches on each lens and folds back into the pill a
 * moment after you let go. `dial.ts` is the numbers, `scene.tsx` what the
 * camera sees and `zoom-sound.ts` the clicks.
 *
 * **Nothing renders while it moves.** The dial is one float, `raw`, and the
 * ruler's turn, the scene's `viewBox`, the readout and the pill are written to
 * the nodes from it. The only state is the stage's width, which sets the
 * ruler's radius.
 */

/** the camera's own yellow, for the live value and the needle */
const YELLOW = "#ffd60a";

/** how long a press waits before it opens the ruler without moving */
const HOLD = 240;

/** a press that moves this far sideways is a scrub */
const SLOP = 6;

/** how long the ruler stays open after the last touch of it */
const LINGER = 1400;

/** the band the ruler lives in, and the arc's top within it, in px */
const BAND = 136;
const ARC_TOP = 58;

/*
 * The moon sits this many px above the frame's middle at every zoom, so the
 * readout and the ruler under it never land on it. The offset is held in
 * screen px rather than scene units, which is what keeps it still while the
 * camera zooms.
 */
const LIFT = 34;

/*
 * Past the last lens the camera crops rather than looks, so the picture goes a
 * little soft and grainy between 5x and 10x and comes back crisp below it. The
 * long mark at 5 on the ruler is where the lenses run out, and this is what
 * says so.
 */
const OPTICAL = 5;
const SOFT = 0.5;
const GRAIN = 0.22;

/** a sensor's grain, one inline tile, so the page fetches nothing for it */
const NOISE =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.95' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 2 -0.6'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

/** a trackpad pinch's zoom per pixel of wheel */
const PINCH = 0.012;

interface Grip {
  id: number;
  x: number;
  from: number;
  scrub: boolean;
  chip: number;
  samples: [number, number][];
  timer: number;
}

export default function ZoomDial() {
  const stage = useRef<HTMLDivElement>(null);
  const scene = useRef<SVGSVGElement>(null);
  const control = useRef<HTMLDivElement>(null);
  const rotor = useRef<SVGGElement>(null);
  const value = useRef<HTMLSpanElement>(null);
  const chips = useRef<(HTMLSpanElement | null)[]>([]);

  const [width, setWidth] = useState(538);
  const frameSize = useRef({ w: 538, h: 336 });
  const radius = Math.max(380, width * 1.02);
  const perOctave = (radius * DEG * Math.PI) / 180;
  const perOctaveRef = useRef(perOctave);
  perOctaveRef.current = perOctave;

  const raw = useRef(rawOf(1));
  const land = useRef<number | null>(null);
  const tau = useRef(0.12);
  const grip = useRef<Grip | null>(null);
  const frame = useRef(0);
  const clock = useRef(0);
  const lastTick = useRef(tickOf(1));
  const lastCatch = useRef(caughtAt(rawOf(1)));
  const blur = useRef(0);
  // the lens a tap asked for, shown on the pill while the picture glides to it
  const tapTo = useRef(-1);
  const grain = useRef<HTMLDivElement>(null);
  const shownZoom = useRef(1);
  const linger = useRef(0);
  const settle = useRef(0);
  const pinch = useRef<{
    ids: Map<number, [number, number]>;
    d0: number;
    z0: number;
  }>({
    ids: new Map(),
    d0: 0,
    z0: 1,
  });
  const armed = useRef(false);
  const reduceValue = useReducedMotion() ?? false;
  const reduce = useRef(reduceValue);
  reduce.current = reduceValue;

  /* -------------------------------------------------------------- drawing */

  /** the lens's state on the picture: digital softness and smear */
  const applyLens = useCallback(() => {
    const digital = Math.min(
      1,
      Math.max(0, (shownZoom.current - OPTICAL) / OPTICAL),
    );
    const total = blur.current + digital * SOFT;
    const sc = scene.current;
    if (sc)
      sc.style.filter = total > 0.05 ? `blur(${total.toFixed(2)}px)` : "none";
    if (grain.current)
      grain.current.style.opacity = (digital * GRAIN).toFixed(3);
  }, []);

  const paint = useCallback(() => {
    const r = raw.current;
    const zoom = zoomOf(Math.min(RAW_MAX, Math.max(0, r)));
    rotor.current?.setAttribute("transform", `rotate(${-rulerAngle(r)})`);
    const w = SCENE.w / 2 / zoom;
    const h = SCENE.h / 2 / zoom;
    // the scene is drawn sliced to the frame, so its scale is the larger fit
    const f = frameSize.current;
    const scale = Math.max(f.w / w, f.h / h);
    const lens = lensOf(zoom);
    // the frame closes in on the sofa and never runs past the photograph
    const lift = LIFT / scale;
    const fx = Math.min(SCENE.w - w / 2, Math.max(w / 2, SCENE.focus.x));
    const fy = Math.min(SCENE.h - h / 2, Math.max(h / 2, SCENE.focus.y + lift));
    scene.current?.setAttribute(
      "viewBox",
      `${fx - w / 2} ${fy - h / 2} ${w} ${h}`,
    );
    const text = readout(zoom);
    if (value.current && value.current.textContent !== text)
      value.current.textContent = text;
    // a tap names its lens at once, and only a scrub or a pinch counts
    if (land.current === null) tapTo.current = -1;
    const tapped = tapTo.current;
    chips.current.forEach((chip, i) => {
      if (!chip) return;
      const on = i === (tapped >= 0 ? tapped : lens);
      const label = on
        ? tapped >= 0
          ? readout(STOPS[i])
          : text
        : short(STOPS[i]);
      if (chip.textContent !== label) chip.textContent = label;
      chip.dataset.active = String(on);
    });
    const c = control.current;
    if (c) {
      c.setAttribute("aria-valuenow", zoom.toFixed(1));
      c.setAttribute("aria-valuetext", `${short(zoom)} times`);
    }
    // a mark passing under the needle clicks, and a lens catching thuds
    const t = tickOf(zoom);
    if (t !== lastTick.current) {
      lastTick.current = t;
      mark();
    }
    const caught = caughtAt(r);
    if (caught !== lastCatch.current) {
      lastCatch.current = caught;
      if (caught >= 0) {
        stop();
        if (armed.current) navigator.vibrate?.(6);
      }
    }
    shownZoom.current = zoom;
    applyLens();
  }, [applyLens]);

  /* --------------------------------------------------------------- motion */

  const setOpen = useCallback((open: boolean) => {
    const s = stage.current;
    if (s && s.dataset.open !== String(open)) s.dataset.open = String(open);
  }, []);

  /** fold the ruler back into the pill a moment after the last touch */
  const later = useCallback(() => {
    window.clearTimeout(linger.current);
    linger.current = window.setTimeout(() => {
      if (!grip.current && pinch.current.ids.size < 2) setOpen(false);
    }, LINGER);
  }, [setOpen]);

  const loop = useCallback(
    function tick(now: number) {
      frame.current = 0;
      // a frame's timestamp can be earlier than the clock `run` read, which
      // would run a glide backwards for that frame
      const dt = Math.min(0.05, Math.max(0, (now - clock.current) / 1000));
      clock.current = now;
      const before = Math.log2(shownZoom.current);
      if (land.current !== null) {
        raw.current =
          land.current +
          (raw.current - land.current) * Math.exp(-dt / tau.current);
        if (Math.abs(land.current - raw.current) < 0.0008) {
          raw.current = land.current;
          land.current = null;
        }
      }
      // the scene smears a little by how fast it zooms, the way a lens does
      const after = Math.log2(
        zoomOf(Math.min(RAW_MAX, Math.max(0, raw.current))),
      );
      const speed = dt > 0 ? Math.abs(after - before) / dt : 0;
      blur.current += (Math.min(1.4, speed * 0.32) - blur.current) * 0.35;
      if (blur.current < 0.05) blur.current = 0;
      paint();
      if (land.current !== null || blur.current > 0 || grip.current)
        frame.current = requestAnimationFrame(tick);
    },
    [paint],
  );

  const run = useCallback(() => {
    if (frame.current) return;
    clock.current = performance.now();
    frame.current = requestAnimationFrame(loop);
  }, [loop]);

  const glide = useCallback(
    (to: number, t: number) => {
      if (reduce.current) {
        land.current = null;
        raw.current = to;
        paint();
        return;
      }
      land.current = to;
      tau.current = t;
      run();
    },
    [paint, run],
  );

  /* ------------------------------------------------------------- the hand */

  const arm = () => {
    armed.current = true;
    armZoom();
  };

  const open = () => {
    if (stage.current?.dataset.open === "true") return;
    setOpen(true);
    if (armed.current) navigator.vibrate?.(4);
  };

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (grip.current || e.button !== 0) return;
    const isOpen = stage.current?.dataset.open === "true";
    // shut, only the pill takes a press, and open the whole band does
    const rects = chips.current.map((c) => c?.getBoundingClientRect());
    const pill = chips.current[0]?.parentElement?.getBoundingClientRect();
    const inPill =
      pill &&
      e.clientX > pill.left - 10 &&
      e.clientX < pill.right + 10 &&
      e.clientY > pill.top - 10 &&
      e.clientY < pill.bottom + 10;
    if (!isOpen && !inPill) return;
    arm();
    e.currentTarget.setPointerCapture(e.pointerId);
    window.clearTimeout(linger.current);
    land.current = null;
    const chip = isOpen
      ? -1
      : rects.findIndex(
          (r) => r && e.clientX >= r.left - 3 && e.clientX <= r.right + 3,
        );
    const g: Grip = {
      id: e.pointerId,
      x: e.clientX,
      from: raw.current,
      scrub: isOpen,
      chip,
      samples: [[e.timeStamp, raw.current]],
      timer: 0,
    };
    // holding the pill opens the ruler without a move
    if (!isOpen)
      g.timer = window.setTimeout(() => {
        if (grip.current !== g) return;
        g.scrub = true;
        open();
      }, HOLD);
    grip.current = g;
    run();
  };

  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = grip.current;
    if (!g || g.id !== e.pointerId) return;
    const dx = e.clientX - g.x;
    if (!g.scrub && Math.abs(dx) > SLOP) {
      g.scrub = true;
      // the scrub starts from here, so the slop is not a jump
      g.x = e.clientX;
      window.clearTimeout(g.timer);
      open();
      return;
    }
    if (!g.scrub) return;
    // dragging right turns the ruler right, which brings a wider lens in
    raw.current = banded(g.from - (e.clientX - g.x) / perOctaveRef.current);
    g.samples.push([e.timeStamp, raw.current]);
    while (g.samples.length > 2 && e.timeStamp - g.samples[0][0] > 100)
      g.samples.shift();
    paint();
  };

  const onUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = grip.current;
    if (!g || g.id !== e.pointerId) return;
    grip.current = null;
    window.clearTimeout(g.timer);
    if (!g.scrub) {
      // a tap on a lens zooms to it
      if (g.chip >= 0) {
        glide(rawOf(STOPS[g.chip]), 0.14);
        tapTo.current = g.chip;
      }
      run();
      return;
    }
    const last = g.samples[g.samples.length - 1];
    const first = g.samples.find((s) => last[0] - s[0] <= 80) ?? g.samples[0];
    const span = (last[0] - first[0]) / 1000;
    const still = e.timeStamp - last[0] > 60;
    const velocity = span > 0 && !still ? (last[1] - first[1]) / span : 0;
    const next = release(raw.current, velocity);
    glide(next.land, next.tau);
    later();
  };

  /* ------------------------------------------------- the keyboard and wheel */

  const onKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const zoom = shownZoom.current;
    const t = tickOf(zoom);
    const lens = lensOf(zoom);
    const onStop = Math.abs(zoom - STOPS[lens]) < 1e-6;
    const keys: Record<string, () => number> = {
      ArrowRight: () => TICKS[Math.min(TICKS.length - 1, t + 1)].zoom,
      ArrowUp: () => TICKS[Math.min(TICKS.length - 1, t + 1)].zoom,
      ArrowLeft: () =>
        TICKS[Math.max(0, TICKS[t].zoom < zoom - 1e-6 ? t : t - 1)].zoom,
      ArrowDown: () =>
        TICKS[Math.max(0, TICKS[t].zoom < zoom - 1e-6 ? t : t - 1)].zoom,
      PageUp: () => (lens < STOPS.length - 1 ? STOPS[lens + 1] : ZMAX),
      PageDown: () => (onStop ? STOPS[Math.max(0, lens - 1)] : STOPS[lens]),
      Home: () => ZMIN,
      End: () => ZMAX,
    };
    const to = keys[e.key];
    if (!to) return;
    e.preventDefault();
    arm();
    open();
    glide(rawOf(to()), 0.09);
    later();
  };

  useEffect(() => {
    const s = stage.current;
    const c = control.current;
    if (!s || !c) return;
    // a trackpad pinch anywhere on the camera zooms, the way a pinch does
    const onStageWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      land.current = null;
      const z = Math.min(
        ZMAX,
        Math.max(ZMIN, shownZoom.current * Math.exp(-e.deltaY * PINCH)),
      );
      raw.current = rawOf(z);
      setOpen(true);
      paint();
      run();
      later();
    };
    // a trackpad swipe across the band scrubs the ruler
    const onBandWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return;
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (!d) return;
      e.preventDefault();
      land.current = null;
      setOpen(true);
      raw.current = Math.min(
        RAW_MAX,
        Math.max(0, raw.current + d / perOctaveRef.current),
      );
      paint();
      run();
      window.clearTimeout(settle.current);
      settle.current = window.setTimeout(() => {
        const caught = caughtAt(raw.current);
        if (caught >= 0) glide(rawOf(STOPS[caught + 1]), 0.1);
      }, 140);
      later();
    };
    s.addEventListener("wheel", onStageWheel, { passive: false });
    c.addEventListener("wheel", onBandWheel, { passive: false });
    return () => {
      s.removeEventListener("wheel", onStageWheel);
      c.removeEventListener("wheel", onBandWheel);
      window.clearTimeout(settle.current);
      window.clearTimeout(linger.current);
    };
  }, [paint, run, later, glide, setOpen]);

  /* ------------------------------------------------- two fingers on glass */

  const onStageDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "touch") return;
    const p = pinch.current;
    p.ids.set(e.pointerId, [e.clientX, e.clientY]);
    if (p.ids.size === 2) {
      const [a, b] = [...p.ids.values()];
      p.d0 = Math.hypot(a[0] - b[0], a[1] - b[1]);
      p.z0 = shownZoom.current;
      land.current = null;
      setOpen(true);
    }
  };

  const onStageMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = pinch.current;
    if (!p.ids.has(e.pointerId)) return;
    p.ids.set(e.pointerId, [e.clientX, e.clientY]);
    if (p.ids.size !== 2 || !p.d0) return;
    const [a, b] = [...p.ids.values()];
    const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
    raw.current = rawOf((p.z0 * d) / p.d0);
    paint();
    run();
  };

  const onStageUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = pinch.current;
    if (!p.ids.delete(e.pointerId)) return;
    if (p.ids.size < 2) {
      p.d0 = 0;
      later();
    }
  };

  /* ----------------------------------------------------------------- setup */

  useLayoutEffect(() => {
    const s = stage.current;
    if (!s) return;
    const measure = () => {
      frameSize.current = { w: s.clientWidth, h: s.clientHeight };
      setWidth(s.clientWidth);
      paint();
    };
    const ro = new ResizeObserver(measure);
    ro.observe(s);
    measure();
    return () => ro.disconnect();
  }, [paint]);

  useLayoutEffect(() => {
    paint();
  }, [paint]);

  useEffect(() => {
    const f = frame;
    return () => cancelAnimationFrame(f.current);
  }, []);

  /* ---------------------------------------------------------------- render */

  const cx = width / 2;
  const cy = ARC_TOP + radius;

  return (
    <div
      ref={stage}
      data-open="false"
      onPointerDown={onStageDown}
      onPointerMove={onStageMove}
      onPointerUp={onStageUp}
      onPointerCancel={onStageUp}
      className="group/stage relative aspect-8/5 min-h-78 w-full select-none overflow-hidden rounded-lg bg-fill"
    >
      <svg
        ref={scene}
        aria-hidden="true"
        className="absolute inset-0 size-full opacity-0 data-[ready=true]:opacity-100 motion-safe:transition-opacity motion-safe:duration-200"
        preserveAspectRatio="xMidYMid slice"
      >
        <Scene
          onLoad={() => {
            if (scene.current) scene.current.dataset.ready = "true";
          }}
        />
      </svg>
      {/* the sensor's grain, which only shows past the last lens */}
      <div
        ref={grain}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0"
        style={{ backgroundImage: NOISE, backgroundSize: "140px 140px" }}
      />
      {/* a lens darkens toward its corners, a little */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-radial from-transparent from-60% to-text-primary/8"
      />

      <div
        ref={control}
        role="slider"
        tabIndex={0}
        aria-label="Zoom"
        aria-valuemin={ZMIN}
        aria-valuemax={ZMAX}
        aria-valuenow={1}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onKeyDown={onKey}
        className="group/control absolute inset-x-0 bottom-0 touch-none focus-visible:outline-none group-data-[open=true]/stage:cursor-ew-resize"
        style={{ height: BAND }}
      >
        {/* the ruler's ground, a soft wash of paper rising from the foot */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-linear-to-t from-bg/85 to-transparent opacity-0 motion-safe:transition-opacity motion-safe:duration-300 group-data-[open=true]/stage:opacity-100"
        />
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 size-full translate-y-2 overflow-visible opacity-0 motion-safe:transition-[opacity,translate] motion-safe:duration-300 motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)] group-data-[open=true]/stage:translate-y-0 group-data-[open=true]/stage:opacity-100"
          style={{
            // a halo of paper keeps the marks legible over the discs
            filter: "drop-shadow(0 0 1.5px rgba(255,255,255,0.9))",
            maskImage:
              "linear-gradient(to right, transparent 3%, #000 24%, #000 76%, transparent 97%)",
            WebkitMaskImage:
              "linear-gradient(to right, transparent 3%, #000 24%, #000 76%, transparent 97%)",
          }}
        >
          <g transform={`translate(${cx} ${cy})`} className="text-text-primary">
            <g ref={rotor}>
              {TICKS.map((t) => {
                const a = angleOf(t.zoom);
                return (
                  <g key={t.zoom} transform={`rotate(${a})`}>
                    <line
                      x1={0}
                      x2={0}
                      y1={-radius}
                      y2={-radius + (t.major ? 12 : 7)}
                      stroke="currentColor"
                      strokeOpacity={t.major ? 0.8 : 0.32}
                      strokeWidth={t.major ? 1.5 : 1}
                      strokeLinecap="round"
                    />
                    {t.label && (
                      <text
                        y={-radius - 9}
                        textAnchor="middle"
                        fill="currentColor"
                        fillOpacity={0.7}
                        className="text-[0.6875rem] tabular-nums"
                      >
                        {t.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          </g>
          {/* the needle, which stands still while the ruler turns under it */}
          <line
            x1={cx}
            x2={cx}
            y1={ARC_TOP - 3}
            y2={ARC_TOP + 16}
            className="stroke-text-primary"
            strokeOpacity={0.55}
            strokeWidth={4}
            strokeLinecap="round"
          />
          <line
            x1={cx}
            x2={cx}
            y1={ARC_TOP - 3}
            y2={ARC_TOP + 16}
            stroke={YELLOW}
            strokeWidth={2}
            strokeLinecap="round"
          />
        </svg>
        <span
          ref={value}
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 translate-y-2 rounded-full bg-text-primary/85 px-2 text-[0.8125rem] font-medium tabular-nums opacity-0 motion-safe:transition-[opacity,translate] motion-safe:duration-300 motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)] group-data-[open=true]/stage:translate-y-0 group-data-[open=true]/stage:opacity-100"
          style={{
            top: ARC_TOP - 40,
            color: YELLOW,
          }}
        />

        {/* the lenses at rest */}
        <div
          aria-hidden="true"
          className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-stroke bg-bg/70 p-1 ring-text-primary/30 backdrop-blur-md group-focus-visible/control:ring-2 motion-safe:transition-[opacity,scale,filter] motion-safe:duration-200 motion-safe:ease-out group-data-[open=true]/stage:pointer-events-none group-data-[open=true]/stage:scale-90 group-data-[open=true]/stage:opacity-0 group-data-[open=true]/stage:blur-[3px]"
        >
          {STOPS.map((s, i) => (
            <span
              key={s}
              ref={(el) => {
                chips.current[i] = el;
              }}
              data-active="false"
              className="grid size-9 cursor-pointer place-items-center rounded-full text-[0.75rem] font-medium text-text-secondary tabular-nums motion-safe:transition-[background-color,color,font-size] motion-safe:duration-200 data-[active=true]:bg-text-primary data-[active=true]:text-[0.8125rem] data-[active=true]:text-(--zd-yellow)"
              style={{ ["--zd-yellow" as string]: YELLOW }}
            >
              {short(s)}
            </span>
          ))}
        </div>
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-lg ring-1 ring-stroke ring-inset"
      />
    </div>
  );
}
