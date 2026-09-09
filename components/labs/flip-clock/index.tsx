"use client";

import {
  animate,
  type MotionValue,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/*
 * A flip clock in 24-hour time. Three cards, hours, minutes and seconds, each
 * a number split at a hinge across its middle. When a number changes, the top
 * half falls forward through 180 degrees as a real flap, showing its back on
 * the way down, and lands on the stop with a small bounce. Behind it the top
 * half already shows the next number and the bottom half still shows the old
 * one, so the flap is the only thing that moves and the card reads right on
 * every frame.
 *
 * The cards flip in from 00 on arrival, the seconds keep it moving, and a
 * press on a card sets it forward by one, so the hour and minute flaps can be
 * watched without waiting for them.
 */

type Part = "top" | "bottom";

/**
 * The flap's fall and its landing, as one keyframe run. The fall is the first
 * half on an ease-in, which is gravity, and the rest is the flap bouncing off
 * the stop: eight degrees back, then three, then still.
 */
const FLIP = {
  keyframes: [0, -180, -172, -180, -177, -180],
  times: [0, 0.5, 0.64, 0.78, 0.9, 1],
  duration: 0.72,
} as const;
/** the cards arrive one after another, hours first */
const STAGGER = 0.12;

/**
 * A hue per card, the fourteenth lab to scope its own colours, on the claim
 * the others make: colour is what tells three cards cut from one pattern
 * apart. Black hid the depth, since a sheen and a shadow on near-black are the
 * same near-black. The reference is the Zara flip clock's blue and green
 * cards with cream numerals. `card` is the face, `ink` the numeral, and the
 * fittings are the card mixed toward black. The cream clears 3:1 on every
 * card, the large-text floor: 3.62, 3.54 and 3.88.
 */
type Hue = { card: string; ink: string };
const HUES: Record<"hh" | "mm" | "ss", Hue> = {
  hh: { card: "#3f7fa6", ink: "#f6e9c6" },
  mm: { card: "#2f8a5c", ink: "#f6e9c6" },
  ss: { card: "#b85833", ink: "#f6e9c6" },
};
const fitting = (hue: Hue) => `color-mix(in oklab, ${hue.card}, black 40%)`;

/**
 * The depth, on `document-pocket`'s rules for a dark surface: light rather than
 * palette, white and black at low alpha over the `inverse-*` ground, and grain,
 * which is what separates a matte card from a flat fill. The upper card
 * catches a pixel of light along its top edge and the lower card sits in the
 * hinge's shadow, since a flip clock is lit from above.
 */
const GRAIN = `url("data:image/svg+xml,%3Csvg viewBox='0 0 160 160' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E")`;
const LIGHT: Record<Part, { backgroundImage: string; boxShadow: string }> = {
  top: {
    // light from the upper left: a sheen across the face falling to a
    // shadow at the lower right, a lit top edge, and a hairline bevel
    backgroundImage:
      "linear-gradient(160deg, rgb(255 255 255 / 0.1), rgb(255 255 255 / 0) 45%, rgb(0 0 0 / 0.16))",
    boxShadow:
      "inset 0 1px 0 rgb(255 255 255 / 0.16), inset 0 0 0 1px rgb(255 255 255 / 0.04)",
  },
  bottom: {
    // the same light, and a lit top edge where the lower card meets the gap
    backgroundImage:
      "linear-gradient(160deg, rgb(255 255 255 / 0.05), rgb(255 255 255 / 0) 40%, rgb(0 0 0 / 0.18))",
    boxShadow:
      "inset 0 1px 0 rgb(255 255 255 / 0.1), inset 0 -1px 0 rgb(255 255 255 / 0.08), inset 0 0 0 1px rgb(255 255 255 / 0.04)",
  },
};
/** the upper card's shadow on the lower one: a narrow band under the gap,
 * over the numeral too, since a shadow falls on the paint as well */
const HINGE_SHADOW =
  "linear-gradient(to bottom, rgb(0 0 0 / 0.4), rgb(0 0 0 / 0.16) 6px, rgb(0 0 0 / 0) 16px)";
/** the card seated on the table, lit from above and in front */
const SEAT =
  "0 1px 2px rgb(0 0 0 / 0.4), 0 8px 16px -4px rgb(0 0 0 / 0.35), 0 20px 32px -8px rgb(0 0 0 / 0.25)";
/** how dark a face gets turned fully away from the light */
const SHADE = 0.55;
/** how dark the lower card gets under a flap standing edge-on above it */
const CAST = 0.55;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** the current clock, as the three two-digit strings the cards show */
function readClock(offsetSeconds: number) {
  const d = new Date(Date.now() + offsetSeconds * 1000);
  const two = (n: number) => String(n).padStart(2, "0");
  return {
    hh: two(d.getHours()),
    mm: two(d.getMinutes()),
    ss: two(d.getSeconds()),
  };
}

/**
 * One half of a number. The card is `h-44`, so each half is a box half that
 * tall that clips a full-height glyph box: the top half shows the glyph's upper
 * half, the bottom half slides the same glyph box up by its own height and
 * shows the lower. Both halves of both numbers then line up to the pixel at the
 * hinge, whatever the glyph.
 */
function Face({
  part,
  text,
  hue,
  fill = false,
  shade,
  className,
}: {
  part: Part;
  text: string;
  hue: Hue;
  /** on the flap, which is already half the card, the face fills its box */
  fill?: boolean;
  /** a darkening that follows the flap's angle, or the shadow it casts */
  shade?: MotionValue<number>;
  className?: string;
}) {
  return (
    <div
      style={{ backgroundColor: hue.card }}
      className={cn(
        "absolute inset-x-0 overflow-hidden",
        fill ? "inset-y-0" : part === "top" ? "top-0 h-1/2" : "bottom-0 h-1/2",
        part === "top" ? "rounded-t-lg" : "rounded-b-lg",
        className,
      )}
    >
      {/* the card's surface: its light, then its grain, under the numeral */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[inherit]"
        style={LIGHT[part]}
      />
      <div
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-30 mix-blend-overlay"
        style={{ backgroundImage: GRAIN }}
      />
      <div
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-[0.09] mix-blend-screen"
        style={{ backgroundImage: GRAIN }}
      />
      <div
        style={{ color: hue.ink }}
        className={cn(
          "absolute inset-x-0 flex h-[200%] items-center justify-center font-medium text-[10.7cqw] tabular-nums leading-none",
          part === "top" ? "top-0" : "-top-full",
        )}
      >
        {text}
      </div>
      {/* what falls on the whole card, paint included: the gap's shadow on the
          lower card, and whatever the flap does to it */}
      {part === "bottom" && (
        <div
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          style={{ backgroundImage: HINGE_SHADOW }}
        />
      )}
      {shade && (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-[inherit] bg-black"
          style={{ opacity: shade }}
        />
      )}
    </div>
  );
}

/**
 * The flap: the top half of the old number on its front and the bottom half
 * of the new one on its back, hinged at its lower edge, falling through 180
 * degrees. The back is pre-turned by 180 so it reads upright once the flap has
 * landed in the bottom half's place.
 */
function Flap({
  from,
  to,
  hue,
  delay,
  rot,
  onDone,
}: {
  from: string;
  to: string;
  hue: Hue;
  delay: number;
  /** the card's own rotation value, shared so the lower card can read it too */
  rot: MotionValue<number>;
  onDone: () => void;
}) {
  /* the front turns away from the light as it falls, the back turns into it */
  const front = useTransform(rot, (r) => clamp01(-r / 90) * SHADE);
  const back = useTransform(rot, (r) => clamp01((180 + r) / 90) * SHADE);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    rot.set(0);
    const controls = animate(rot, [...FLIP.keyframes], {
      duration: FLIP.duration,
      times: [...FLIP.times],
      ease: ["easeIn", "easeOut", "easeIn", "easeOut", "easeIn"],
      delay,
      // `onComplete` and not the promise: a stop resolves the promise too, and
      // dev's double effect stops the first run
      onComplete: () => done.current(),
    });
    return () => controls.stop();
  }, [rot, delay]);
  return (
    <motion.div
      style={{ rotateX: rot }}
      className="pointer-events-none absolute inset-x-0 top-0 h-1/2 origin-bottom transform-3d"
    >
      <Face
        fill
        part="top"
        text={from}
        hue={hue}
        shade={front}
        className="backface-hidden"
      />
      <Face
        fill
        part="bottom"
        text={to}
        hue={hue}
        shade={back}
        className="backface-hidden [transform:rotateX(180deg)]"
      />
    </motion.div>
  );
}

function Card({
  value,
  label,
  hue,
  delay,
  onNudge,
}: {
  value: string;
  label: string;
  hue: Hue;
  delay: number;
  onNudge: () => void;
}) {
  const dark = fitting(hue);
  const reduce = useReducedMotion();
  /* the flap's angle, 0 at the top and -180 landed, read by the shading */
  const rot = useMotionValue(0);
  /* the shadow the falling flap throws on the lower card: nothing at either
     end, most at the flap's steepest, edge-on over the hinge */
  const cast = useTransform(rot, (r) => {
    const a = -r;
    return a <= 0 || a >= 180 ? 0 : Math.sin((a / 180) * Math.PI) * CAST;
  });
  /* what the static halves call the current number */
  const [shown, setShown] = useState("00");
  const [flip, setFlip] = useState<{
    from: string;
    to: string;
    id: number;
  } | null>(null);
  const flips = useRef(0);
  useEffect(() => {
    if (value === shown || flip) return;
    if (reduce) {
      setShown(value);
      return;
    }
    flips.current += 1;
    setFlip({ from: shown, to: value, id: flips.current });
  }, [value, shown, flip, reduce]);

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={onNudge}
        aria-label={`${label} ${value}, press to set forward`}
        className="relative h-[26.2cqw] w-[21.4cqw] cursor-pointer select-none rounded-lg transition-opacity duration-200 [perspective:700px] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2"
      >
        {/* the card seated on the stage: a soft pool on the table, then the
            card's own three shadows */}
        <div className="pointer-events-none absolute inset-x-2 -bottom-2 h-4 rounded-full bg-black/25 blur-md" />
        <div
          className="pointer-events-none absolute inset-0 rounded-lg"
          style={{ boxShadow: SEAT }}
        />
        {/* the two cards under the flap: the next number's top, the current one's bottom */}
        <Face part="top" text={flip ? flip.to : shown} hue={hue} />
        <Face part="bottom" text={shown} hue={hue} shade={cast} />
        {flip && (
          <Flap
            key={flip.id}
            from={flip.from}
            to={flip.to}
            hue={hue}
            delay={flips.current === 1 ? delay : 0}
            rot={rot}
            onDone={() => {
              setShown(flip.to);
              setFlip(null);
            }}
          />
        )}
        {/* the hinge: the stage showing through, and the axle's two tabs */}
        {/* the hinge: a soft band of shadow where the light cannot reach the
            fold, darkest on the line and gone within a few pixels either side */}
        <div
          className="pointer-events-none absolute inset-x-0 top-1/2 h-2 -translate-y-1/2"
          style={{
            backgroundImage:
              "linear-gradient(to bottom, rgb(0 0 0 / 0), rgb(0 0 0 / 0.45) 50%, rgb(0 0 0 / 0))",
          }}
        />
        <div
          className="absolute top-1/2 left-0 h-[3cqw] w-[1.1cqw] -translate-y-1/2 rounded-r-sm"
          style={{
            backgroundColor: dark,
            boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.14)",
          }}
        />
        <div
          className="absolute top-1/2 right-0 h-[3cqw] w-[1.1cqw] -translate-y-1/2 rounded-l-sm"
          style={{
            backgroundColor: dark,
            boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.14)",
          }}
        />
        {/* the reel: the edges of the cards waiting underneath, each a shade
            further back */}
        <div
          className="absolute inset-x-1 -bottom-1 h-1 rounded-b-lg"
          style={{ backgroundColor: dark }}
        />
        <div
          className="absolute inset-x-2 -bottom-2 h-1 rounded-b-lg opacity-75"
          style={{ backgroundColor: dark }}
        />
        <div
          className="absolute inset-x-3 -bottom-3 h-1 rounded-b-lg opacity-50"
          style={{ backgroundColor: dark }}
        />
      </button>
      <span className="text-meta text-text-muted">{label}</span>
    </div>
  );
}

export default function FlipClock() {
  /* seconds added to the real clock by presses on the cards */
  const [offset, setOffset] = useState(0);
  const [time, setTime] = useState(() => readClock(0));
  useEffect(() => {
    setTime(readClock(offset));
    const tick = () => setTime(readClock(offset));
    // aligned to the next whole second, then every second
    let interval: ReturnType<typeof setInterval> | undefined;
    const align = setTimeout(
      () => {
        tick();
        interval = setInterval(tick, 1000);
      },
      1000 - (Date.now() % 1000),
    );
    return () => {
      clearTimeout(align);
      if (interval) clearInterval(interval);
    };
  }, [offset]);

  return (
    <div
      className="@container relative flex aspect-8/5 w-full select-none items-center justify-center overflow-hidden rounded-lg bg-fill ring-1 ring-stroke ring-inset"
      style={{
        backgroundImage:
          "linear-gradient(to bottom, var(--color-bg), var(--color-fill))",
      }}
    >
      {/* every length here is a share of the stage's width, `window-shade`'s
          call, so three cards fit a 352px phone stage as they fit the column.
          The values reproduce the column's own 115 by 141px cards */}
      <div className="flex items-start gap-[2.4cqw]">
        <Card
          value={time.hh}
          label="hours"
          hue={HUES.hh}
          delay={0}
          onNudge={() => setOffset((o) => o + 3600)}
        />
        <Card
          value={time.mm}
          label="minutes"
          hue={HUES.mm}
          delay={STAGGER}
          onNudge={() => setOffset((o) => o + 60)}
        />
        <Card
          value={time.ss}
          label="seconds"
          hue={HUES.ss}
          delay={STAGGER * 2}
          onNudge={() => setOffset((o) => o + 1)}
        />
      </div>
    </div>
  );
}
