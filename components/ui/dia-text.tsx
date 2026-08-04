"use client";

import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

/**
 * A colour band that sweeps once across a run of text, revealing it.
 *
 * Ported from iconiqui.com/texts/dia-text rather than installed, for two
 * reasons. The published component ships a `componentThemeClassName` carrying
 * roughly sixty raw hex values and a full `dark:` set, and this project has one
 * fixed light theme and semantic tokens only. It also carries text-rotation
 * machinery, a cloned ghost span, per-entry width measurement, an active index
 * and a blur-and-shift swap, none of which a single static string uses.
 *
 * The sweep itself is faithful: same band width, same cubic ease, same
 * gradient-stop construction. The palette lives in `globals.css` as `--sweep-*`,
 * so nothing here holds a colour.
 */

/** Half the band's width, as a percentage of the text. */
const BAND_HALF = 17;
/** Fully off the left edge, so the first frame shows nothing revealed. */
const SWEEP_START = -BAND_HALF;
/** Fully off the right edge, so the last frame leaves the text solid. */
const SWEEP_END = 100 + BAND_HALF;

const SWEEP_COLORS = [
  "var(--sweep-1)",
  "var(--sweep-2)",
  "var(--sweep-3)",
  "var(--sweep-4)",
  "var(--sweep-5)",
];

/** easeInOutCubic. The band accelerates in and settles out. */
const sweepEase = (t: number) =>
  t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;

/**
 * Builds the gradient for one frame of the sweep.
 *
 * Everything left of the band is already-revealed text, everything right of it
 * is transparent, and the band itself carries the colours. Once the band clears
 * the right edge the whole run is solid text colour, which is why the text is
 * still there after the animation rather than fading out with it.
 */
function buildGradient(position: number) {
  const bandStart = position - BAND_HALF;
  const bandEnd = position + BAND_HALF;
  const text = "var(--color-text-primary)";

  if (bandStart >= 100) return `linear-gradient(90deg, ${text}, ${text})`;

  const stops: string[] = [];

  if (bandStart > 0) {
    stops.push(`${text} 0%`, `${text} ${bandStart.toFixed(2)}%`);
  }

  SWEEP_COLORS.forEach((color, index) => {
    const at = bandStart + (index / (SWEEP_COLORS.length - 1)) * BAND_HALF * 2;
    stops.push(`${color} ${at.toFixed(2)}%`);
  });

  if (bandEnd < 100) {
    stops.push(`transparent ${bandEnd.toFixed(2)}%`, "transparent 100%");
  }

  return `linear-gradient(90deg, ${stops.join(", ")})`;
}

export function DiaText({
  text,
  duration = 1.2,
  delay = 0,
  className,
}: {
  text: string;
  /** seconds for the band to cross */
  duration?: number;
  /** seconds before it starts, so the sweep can be placed in a page's sequence */
  delay?: number;
  className?: string;
}) {
  const reducedMotion = useReducedMotion();
  const sweep = useMotionValue(SWEEP_START);
  const backgroundImage = useTransform(sweep, buildGradient);

  useEffect(() => {
    if (reducedMotion) return;
    const controls = animate(sweep, SWEEP_END, {
      duration,
      delay,
      ease: sweepEase,
    });
    return () => controls.stop();
  }, [delay, duration, reducedMotion, sweep]);

  /*
   * Plain text under reduced motion, not a paused sweep. `MotionProvider`'s
   * `reducedMotion` only governs transform and layout, so it would let this run,
   * and the first frame of a sweep is fully transparent: the name would simply be
   * missing.
   */
  if (reducedMotion) return <span className={className}>{text}</span>;

  return (
    <motion.span
      /*
       * No `display` or `vertical-align` override, unlike the upstream component.
       * This sits mid-sentence, and `inline-block` plus `align-bottom` lifts a run
       * off the baseline of the line it belongs to, the same way `align-middle`
       * dropped the underlined links earlier.
       */
      className={cn(className)}
      style={{
        backgroundImage,
        // the text is painted by the gradient, so the glyphs themselves have no
        // colour of their own
        color: "transparent",
        backgroundClip: "text",
        WebkitBackgroundClip: "text",
      }}
    >
      {text}
    </motion.span>
  );
}
