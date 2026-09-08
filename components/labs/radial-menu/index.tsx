"use client";

import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { TextMorph } from "torph/react";
import { cn } from "@/lib/utils";
import { type Look, Portrait } from "./portrait";

/*
 * A file on a stage. Press it and pull, and a wheel of formats opens around
 * the place it was, the game weapon wheel's shape: the hand carries the file,
 * the wedge under the hand fills in, and letting go there converts the file.
 * Letting go over the middle, or anywhere off a wedge, puts it back unchanged.
 *
 * The wheel is centred on where the file was, never on the hand, so it does
 * not move while the hand does. Which wedge is under the hand is arithmetic on
 * the hand's angle and distance from that centre, not a hit test on the
 * wedges: the file is what the pointer is over, so the wedges could never see
 * it, and the same maths serves a mouse, a finger and the arrow keys.
 */

/** what the wheel offers, clockwise from the top */
const FORMATS = ["png", "jpg", "gif", "avif", "pdf"] as const;
type Format = (typeof FORMATS)[number];

/**
 * What the file would weigh in each format, from a table, since nothing here
 * converts anything. Plausible for a portrait this size and nothing more, and
 * the readout says which by putting it beside the name rather than in it.
 */
const WEIGHT: Record<Format, string> = {
  png: "412 kb",
  jpg: "96 kb",
  gif: "148 kb",
  avif: "38 kb",
  pdf: "1 page",
};

/**
 * A hue per format, the thirteenth lab to scope its own colours and on the
 * same claim as the others: the colour is what tells five wedges cut from one
 * ring apart. `tint` is the wedge at rest, a wash in the 1.25 to 1.38 band on
 * white that the other labs' papers hold, so a wedge gains a hue without
 * gaining weight. `mark` is the wedge under the hand, and `ink` is the label
 * that can read on it: white on the deep ones, the site's black on amber and
 * coral, since no white clears 4.5:1 on those. Measured, png to pdf: 4.72,
 * 9.26, 5.22, 4.69 and 6.79. Rest labels are `text-primary`, 12.6:1 or better on every
 * tint. `readable` says whether the mark itself clears 4.5:1 on white, which
 * is what the readout in the empty slot needs to take the hue: sky, violet and
 * green do, amber and coral sit at 1.9 and 2.6 and the readout stays black.
 */
const HUES: Record<
  Format,
  { tint: string; mark: string; ink: string; readable: boolean }
> = {
  png: { tint: "#cfe4ff", mark: "#2b6fe0", ink: "#ffffff", readable: true },
  jpg: { tint: "#ffe2a1", mark: "#f0b323", ink: "#1a1a1a", readable: false },
  gif: { tint: "#e3d5ff", mark: "#7a4fe0", ink: "#ffffff", readable: true },
  avif: { tint: "#c8efd8", mark: "#178457", ink: "#ffffff", readable: true },
  pdf: { tint: "#ffd9cf", mark: "#ff7a5c", ink: "#1a1a1a", readable: false },
};

/** a vector portrait, which is a file one would rasterise to these formats */
const FILE = { name: "portrait" };

/** the wheel in stage px: the ring's outer and inner radius, and the seam between wedges */
const WHEEL = { outer: 150, inner: 62, seam: 4 };
/** how far the hand moves before a press is a drag and the wheel opens */
const SLOP = 6;

/** the wheel arriving, the file springing home, and a wedge popping out under
 * the hand. All three overshoot a little, since a wheel of sweets should bounce */
const ARRIVE = { type: "spring", stiffness: 520, damping: 26 } as const;
const HOME = { type: "spring", stiffness: 420, damping: 22 } as const;
const POP = { type: "spring", stiffness: 600, damping: 24 } as const;
/** the file darting into the wedge it was let go on, before it comes home. A
 * tween rather than a spring, so the beat is 160ms from anywhere in the wedge:
 * a spring aimed at a point the file is already on still ran its settle, which
 * was a 330ms hold */
const DART = { duration: 0.16, ease: [0.16, 1, 0.3, 1] } as const;

/**
 * The magnet. With a wedge under the hand the file drifts `PULL` of the way
 * from the hand toward that wedge's centre, and the wheel turns toward where
 * the hand sits inside the wedge, `LEAN` degrees per degree off the wedge's
 * own angle, so a hand near a seam sees the wheel tip to meet it. Both are
 * springs that unwind to zero when the hand leaves the wedge, which is the
 * dial catching a detent and letting it go.
 */
const PULL = 0.12;
const LEAN = 0.08;
const MAGNET = { stiffness: 260, damping: 24 } as const;
/** how far the wedge under the hand grows, about the wheel's centre, so it
 * steps outward as well as up */
const POP_SCALE = 1.05;
const instant = { duration: 0 } as const;

const STEP = 360 / FORMATS.length;
/** where a wedge's label sits, and where the magnet and the dart aim */
const labelRadius = (WHEEL.outer + WHEEL.inner) / 2;
const rad = (deg: number) => (deg * Math.PI) / 180;
/** a point `r` from the wheel's centre, `deg` clockwise from the top */
const at = (r: number, deg: number) =>
  [r * Math.sin(rad(deg)), -r * Math.cos(rad(deg))] as const;

/** one wedge of the ring, the slice of the annulus centred on wedge `i` */
function wedgePath(i: number): string {
  const a0 = i * STEP - STEP / 2;
  const a1 = i * STEP + STEP / 2;
  const { outer: R, inner: r } = WHEEL;
  const [ox0, oy0] = at(R, a0);
  const [ox1, oy1] = at(R, a1);
  const [ix0, iy0] = at(r, a0);
  const [ix1, iy1] = at(r, a1);
  return `M ${ox0} ${oy0} A ${R} ${R} 0 0 1 ${ox1} ${oy1} L ${ix1} ${iy1} A ${r} ${r} 0 0 0 ${ix0} ${iy0} Z`;
}

/**
 * Which wedge a point is over, or null inside the dead zone at the centre.
 * Past the outer edge still counts: the wheel is a direction picker, and a
 * hand that overshoots has still pointed.
 */
function wedgeAt(dx: number, dy: number): number | null {
  if (Math.hypot(dx, dy) < WHEEL.inner) return null;
  const deg = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
  return Math.round(deg / STEP) % FORMATS.length;
}

type Press = {
  id: number;
  /** where the hand pressed, and the file's centre, both in viewport px */
  x0: number;
  y0: number;
  cx: number;
  cy: number;
  dragging: boolean;
};

export default function RadialMenu() {
  const reduce = useReducedMotion();
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const [ext, setExt] = useState<Look>("svg");
  /* the hand's offset from home, and the magnet's pull on top of it */
  const hx = useMotionValue(0);
  const hy = useMotionValue(0);
  const pullX = useSpring(0, MAGNET);
  const pullY = useSpring(0, MAGNET);
  const x = useTransform(() => hx.get() + pullX.get());
  const y = useTransform(() => hy.get() + pullY.get());
  /* the wheel's tip toward the hand, in degrees */
  const lean = useSpring(0, MAGNET);

  const press = useRef<Press | null>(null);
  /* the handlers read the selection without waiting on a render */
  const activeRef = useRef<number | null>(null);
  /* whether the keyboard opened the wheel, in which case the file stays put */
  const keyboard = useRef(false);
  /* ends a press in flight, so an unmount mid-drag leaves nothing on the window */
  const end = useRef<() => void>(() => {});
  useEffect(() => () => end.current(), []);

  const select = (i: number | null) => {
    if (activeRef.current === i) return;
    activeRef.current = i;
    setActive(i);
  };

  /** the magnet's targets for a hand at `dx, dy` from home over wedge `i` */
  const magnetise = (i: number | null, dx: number, dy: number) => {
    if (i === null || reduce) {
      pullX.set(0);
      pullY.set(0);
      lean.set(0);
      return;
    }
    const [wx, wy] = at(labelRadius, i * STEP);
    pullX.set((wx - dx) * PULL);
    pullY.set((wy - dy) * PULL);
    const deg = ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
    const off = ((deg - i * STEP + 540) % 360) - 180;
    lean.set(off * LEAN);
  };

  /**
   * Close the wheel and put the file back, converted to `pick` if there is
   * one. A pick is a beat: the file darts into the wedge it was let go on,
   * takes the new look there, and only then comes home, with the wheel held
   * open until it has landed. A release with no pick just goes home.
   */
  const settle = (pick: number | null) => {
    select(null);
    keyboard.current = false;
    magnetise(null, 0, 0);
    const home = () => {
      setOpen(false);
      const spring = reduce ? instant : HOME;
      animate(hx, 0, spring);
      animate(hy, 0, spring);
    };
    if (pick === null || reduce) {
      if (pick !== null) setExt(FORMATS[pick]);
      home();
      return;
    }
    const [wx, wy] = at(labelRadius, pick * STEP);
    activeRef.current = pick;
    setActive(pick);
    Promise.all([animate(hx, wx, DART), animate(hy, wy, DART)]).then(() => {
      setExt(FORMATS[pick]);
      activeRef.current = null;
      setActive(null);
      home();
    });
  };

  /*
   * The drag, on nib's rules: down on the file, move, up, cancel and blur on
   * the window, and `buttons === 0` ends a drag whose lift was never heard.
   * The wheel opens on the first move past `SLOP`, so a click opens nothing.
   */
  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (press.current || keyboard.current) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    press.current = {
      id: event.pointerId,
      x0: event.clientX,
      y0: event.clientY,
      cx: rect.left + rect.width / 2,
      cy: rect.top + rect.height / 2,
      dragging: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);

    const finish = (pick: number | null) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("blur", cancel);
      window.removeEventListener("keydown", key);
      const wasDragging = press.current?.dragging ?? false;
      press.current = null;
      end.current = () => {};
      if (wasDragging) settle(pick);
    };
    const move = (e: PointerEvent) => {
      const p = press.current;
      if (!p || e.pointerId !== p.id) return;
      if (e.buttons === 0) {
        finish(null);
        return;
      }
      const dx = e.clientX - p.x0;
      const dy = e.clientY - p.y0;
      if (!p.dragging) {
        if (Math.hypot(dx, dy) < SLOP) return;
        p.dragging = true;
        setOpen(true);
      }
      hx.set(dx);
      hy.set(dy);
      const wedge = wedgeAt(e.clientX - p.cx, e.clientY - p.cy);
      select(wedge);
      magnetise(wedge, e.clientX - p.cx, e.clientY - p.cy);
    };
    const up = (e: PointerEvent) => {
      const p = press.current;
      if (!p || e.pointerId !== p.id) return;
      finish(p.dragging ? activeRef.current : null);
    };
    const cancel = () => finish(null);
    const key = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") finish(null);
    };
    end.current = () => finish(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("blur", cancel);
    window.addEventListener("keydown", key);
  };

  /*
   * The keyboard's version: Enter or Space opens the wheel on the top wedge,
   * the arrows walk round it, Enter picks and Escape puts the file back. The
   * file does not move, since there is no hand for it to follow.
   */
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const n = FORMATS.length;
    if (!open) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        keyboard.current = true;
        setOpen(true);
        select(0);
      }
      return;
    }
    if (!keyboard.current) return;
    const cur = activeRef.current ?? 0;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        select((cur + 1) % n);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        select((cur + n - 1) % n);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        settle(activeRef.current);
        break;
      case "Escape":
        event.preventDefault();
        settle(null);
        break;
    }
  };

  const filename = `${FILE.name}.${ext}`;

  return (
    <div className="relative grid h-140 w-full select-none place-items-center overflow-hidden rounded-lg bg-bg ring-1 ring-stroke ring-inset">
      {/* the wheel, centred on the file's home. Transparent to the pointer, since
          the file has it captured and the wedges are chosen by angle */}
      <AnimatePresence>
        {open && (
          <motion.svg
            key="wheel"
            id={menuId}
            role="menu"
            aria-label="Convert to"
            viewBox="-160 -160 320 320"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={reduce ? instant : ARRIVE}
            style={{ rotate: lean }}
            className="pointer-events-none absolute top-1/2 left-1/2 size-100 -translate-1/2"
          >
            {FORMATS.map((format, i) => {
              const [lx, ly] = at(labelRadius, i * STEP);
              const on = active === i;
              const hue = HUES[format];
              return (
                /* scaled about the wheel's centre, the SVG's origin, so the
                   wedge under the hand steps outward rather than swelling in
                   place. The hues are inline, since they are not tokens */
                <motion.g
                  key={format}
                  role="menuitem"
                  aria-label={format}
                  aria-current={on || undefined}
                  animate={{ scale: on ? POP_SCALE : 1 }}
                  transition={reduce ? instant : POP}
                  style={{ transformOrigin: "0px 0px" }}
                >
                  {/* the seam is the stage showing through a stroke in its own
                      colour, so the wedges part without a border on them */}
                  <path
                    d={wedgePath(i)}
                    strokeWidth={WHEEL.seam}
                    strokeLinejoin="round"
                    style={{ fill: on ? hue.mark : hue.tint }}
                    className="stroke-bg transition-[fill] duration-200"
                  />
                  <text
                    x={lx}
                    y={ly}
                    textAnchor="middle"
                    dominantBaseline="central"
                    style={{ fill: on ? hue.ink : "var(--color-text-primary)" }}
                    className="font-medium text-action transition-[fill] duration-200"
                  >
                    {format}
                  </text>
                </motion.g>
              );
            })}
          </motion.svg>
        )}
      </AnimatePresence>

      {/* the file's place while it is out, and the pick read out in it */}
      {open && (
        <div
          aria-hidden="true"
          className="absolute top-1/2 left-1/2 flex size-16 -translate-1/2 flex-col items-center justify-center rounded-lg border-2 border-stroke-strong border-dashed"
        >
          {/* the pick, in its own hue where that hue can carry text */}
          <span
            className="font-mono text-meta transition-colors duration-200"
            style={{
              color:
                active !== null && HUES[FORMATS[active]].readable
                  ? HUES[FORMATS[active]].mark
                  : "var(--color-text-primary)",
            }}
          >
            <TextMorph duration={200} ease="cubic-bezier(0.4, 0, 0.2, 1)">
              {active !== null ? FORMATS[active] : ""}
            </TextMorph>
          </span>
          <span className="font-mono text-meta text-text-muted">
            <TextMorph duration={200} ease="cubic-bezier(0.4, 0, 0.2, 1)">
              {active !== null ? WEIGHT[FORMATS[active]] : ""}
            </TextMorph>
          </span>
        </div>
      )}
      <output aria-live="polite" className="sr-only">
        {active !== null ? `${FORMATS[active]}` : filename}
      </output>

      {/* the file. The button is the thumbnail alone, so its centre is the
          wheel's centre, and the name hangs under it and rides along */}
      <motion.button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`${filename}, drag out to convert`}
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
        onBlur={() => {
          if (keyboard.current) settle(null);
        }}
        style={{ x, y }}
        className="relative z-10 block size-16 cursor-grab touch-none overflow-visible rounded-lg bg-fill ring-1 ring-stroke transition-shadow duration-200 hover:ring-stroke-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2 active:cursor-grabbing"
      >
        <span className="block size-full overflow-hidden rounded-lg">
          {/* the wedge under the hand previews its format on the file, and the
              file keeps the look of whatever it was last converted to */}
          <Portrait
            look={active !== null ? FORMATS[active] : ext}
            className="size-full select-none"
          />
        </span>
        {/* hidden while the file is out: over the dark wedge a grey name had no
            contrast, and it comes back with its new extension as the file lands */}
        <span
          className={cn(
            "absolute top-full left-1/2 mt-2 block -translate-x-1/2 whitespace-nowrap text-meta text-text-secondary transition-opacity duration-150",
            open && "opacity-0",
          )}
        >
          <TextMorph duration={200} ease="cubic-bezier(0.4, 0, 0.2, 1)">
            {filename}
          </TextMorph>
        </span>
      </motion.button>
    </div>
  );
}
