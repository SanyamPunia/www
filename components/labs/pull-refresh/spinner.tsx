"use client";

import { type MotionValue, motion, useTransform } from "motion/react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { progress, TICKS, tickOpacity, trailOpacity } from "./pull";

/*
 * The iOS activity indicator: eight rounded ticks round a centre.
 *
 * While the list is being pulled the ticks appear one after another, clockwise
 * from the top, so the spinner draws itself as the hand goes. Once a refresh
 * starts the ticks take a trail of opacities and the whole spinner turns in
 * eighths, so what appears to move is the trail. Both states read the same
 * eight nodes, written imperatively, so a pull renders nothing.
 */

const TICK = Array.from({ length: TICKS }, (_, i) => i);

export function Spinner({
  y,
  spinning,
  leaving,
}: {
  y: MotionValue<number>;
  spinning: boolean;
  /** the refresh is done, and the spinner shrinks out as the list closes */
  leaving: boolean;
}) {
  const ticks = useRef<(SVGRectElement | null)[]>([]);
  const spinRef = useRef(spinning);
  spinRef.current = spinning;

  // centred in the gap the pull opens above the list
  const top = useTransform(y, (v) => Math.max(0, v / 2 - 11));

  useEffect(() => {
    const paint = (v: number) => {
      const p = progress(v);
      ticks.current.forEach((el, i) => {
        if (!el) return;
        el.style.opacity = String(
          spinRef.current ? trailOpacity(i) : tickOpacity(p, i),
        );
      });
    };
    paint(y.get());
    return y.on("change", paint);
  }, [y]);

  // the trail is set the frame a refresh starts, and handed back after
  useEffect(() => {
    ticks.current.forEach((el, i) => {
      if (!el) return;
      el.style.opacity = String(
        spinning ? trailOpacity(i) : tickOpacity(progress(y.get()), i),
      );
    });
  }, [spinning, y]);

  return (
    <motion.div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute left-1/2 -ml-[11px] size-[22px] text-text-secondary transition-[opacity,scale] duration-200",
        leaving ? "scale-50 opacity-0" : "scale-100 opacity-100",
      )}
      style={{ top }}
    >
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 24 24"
        className={cn(
          "size-full",
          spinning &&
            "motion-safe:animate-[spinner-steps_0.8s_steps(8)_infinite]",
        )}
      >
        {TICK.map((i) => (
          <rect
            key={i}
            ref={(el) => {
              ticks.current[i] = el;
            }}
            x="10.9"
            y="2"
            width="2.2"
            height="6.4"
            rx="1.1"
            fill="currentColor"
            opacity="0"
            transform={`rotate(${i * (360 / TICKS)} 12 12)`}
          />
        ))}
      </svg>
    </motion.div>
  );
}
