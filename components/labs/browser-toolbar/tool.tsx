"use client";

import {
  animate,
  type MotionValue,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
} from "motion/react";
import type React from "react";
import { useCallback, useRef } from "react";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** The press lands in 90ms and the release springs past rest and back */
const FLATTEN = { duration: 0.09, ease: "easeOut" } as const;
const RELEASE = { type: "spring", stiffness: 520, damping: 22 } as const;

const OUT = "cubic-bezier(0.23, 1, 0.32, 1)";
const TRAVEL = 280;

interface Flat {
  flat: MotionValue<number>;
  /** the hand going down or coming up with nothing fired */
  press: (down: boolean) => void;
  /** a fired press, which leaves the icon flat and lets it spring open */
  release: () => void;
}

/** One press value per icon, written to its paths with no render */
export function useFlat(draw: (flat: number) => void): Flat {
  const flat = useMotionValue(0);
  const reduce = useReducedMotion();
  useMotionValueEvent(flat, "change", draw);

  const press = useCallback(
    (down: boolean) => {
      if (reduce) return;
      animate(flat, down ? 1 : 0, down ? FLATTEN : RELEASE);
    },
    [flat, reduce],
  );

  const release = useCallback(() => {
    if (reduce) return;
    flat.jump(1);
    animate(flat, 0, RELEASE);
  }, [flat, reduce]);

  return { flat, press, release };
}

/**
 * The stroke leaves by `dx`, `dy` and a fresh one arrives from the other side.
 * Each copy is a node of its own, so nothing here renders. `extra` sends more
 * copies behind the first, each a beat later and further out, which is how a
 * run of quick presses builds.
 */
export function echo(
  path: SVGPathElement,
  dx: number,
  dy: number,
  extra = 0,
): void {
  for (let i = 0; i <= extra; i++) {
    const ghost = path.cloneNode() as SVGPathElement;
    const reach = 1 + i * 0.5;
    path.before(ghost);
    ghost.animate(
      [
        { transform: "translate(0, 0)", opacity: 1 - i * 0.22 },
        {
          transform: `translate(${dx * reach}px, ${dy * reach}px)`,
          opacity: 0,
        },
      ],
      { duration: TRAVEL, delay: i * 34, easing: OUT, fill: "backwards" },
    ).onfinish = () => ghost.remove();
  }
  path.animate(
    [
      { transform: `translate(${-dx * 0.6}px, ${-dy * 0.6}px)`, opacity: 0.1 },
      { transform: "translate(0, 0)", opacity: 1 },
    ],
    { duration: TRAVEL, easing: OUT },
  );
}

/** A press at the end of history moves the icon and goes nowhere */
export function nudge(node: SVGElement, dx: number): void {
  node.animate(
    [
      { transform: "translate(0, 0)" },
      { transform: `translate(${dx}px, 0)` },
      { transform: "translate(0, 0)" },
    ],
    { duration: 220, easing: "ease-out" },
  );
}

interface ToolProps {
  label: string;
  children: React.ReactNode;
  onFire: () => void;
  onPress?: (down: boolean) => void;
  onHover?: (over: boolean) => void;
  /** the end of history: still pressable, but `aria-disabled` and quiet */
  spent?: boolean;
  pressed?: boolean;
  className?: string;
  /** kept for the preview recorder */
  name: string;
}

export function Tool({
  label,
  children,
  onFire,
  onPress,
  onHover,
  spent,
  pressed,
  className,
  name,
}: ToolProps) {
  const held = useRef(false);

  const down = () => {
    held.current = true;
    onPress?.(true);
  };
  const up = () => {
    if (!held.current) return;
    held.current = false;
    onPress?.(false);
  };

  return (
    <Tooltip label={label} side="bottom">
      <button
        type="button"
        data-tool={name}
        aria-label={label}
        aria-disabled={spent || undefined}
        aria-pressed={pressed}
        onClick={() => {
          held.current = false;
          onFire();
        }}
        onPointerDown={(e) => {
          if (e.button === 0) down();
        }}
        onPointerUp={up}
        onPointerCancel={up}
        onPointerEnter={(e) => {
          if (e.pointerType !== "touch") onHover?.(true);
        }}
        onPointerLeave={(e) => {
          up();
          if (e.pointerType !== "touch") onHover?.(false);
        }}
        onKeyDown={(e) => {
          if ((e.key === " " || e.key === "Enter") && !e.repeat) down();
        }}
        onKeyUp={up}
        onBlur={up}
        className={cn(
          "grid size-11 shrink-0 sm:size-14 cursor-pointer place-items-center rounded-lg text-text-secondary",
          "transition-all duration-150 active:duration-0",
          "hover:bg-surface hover:text-text-primary active:bg-fill",
          // a hover stands up off the bar and a press sinks into it
          "hover:shadow-[inset_0_1px_0_rgb(255_255_255),0_1px_1px_rgb(0_0_0/0.07)]",
          "active:shadow-[inset_0_1px_2px_rgb(0_0_0/0.12)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2",
          spent &&
            "text-stroke-strong hover:bg-transparent hover:text-stroke-strong hover:shadow-none active:bg-transparent active:shadow-none",
          className,
        )}
      >
        {children}
      </button>
    </Tooltip>
  );
}

/** The frame every glyph here sits in. Overflow is visible for the echoes */
export function Glyph({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="size-6 overflow-visible sm:size-7"
    >
      {children}
    </svg>
  );
}
