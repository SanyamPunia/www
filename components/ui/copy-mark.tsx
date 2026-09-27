"use client";

import { CheckIcon, CopyIcon, HashIcon } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import type React from "react";

/**
 * The mark on a copy control: its idle glyph, swapping to a tick when copied.
 *
 * **A quick fade and a scale, not a morph.** Both glyphs sit on top of each
 * other. The one arriving fades in over 100ms and scales up from 0.5 on a
 * short spring with a little bounce, so the change lands at once and then
 * settles. The one leaving fades and shrinks in 80ms, faster than the arrival,
 * since the system is answering and nothing about the old glyph is worth
 * watching go. A path morph between hand-drawn polylines came before this, at
 * 280ms, and read as slow and soft rather than as an answer to a press.
 *
 * Both copy controls on a post render this, `CodeBlock` with `copy` and
 * `HeadingAnchor` with `hash`, so the two still behave identically.
 *
 * Reduced motion keeps the fade and drops the scale, since `useReducedMotion`
 * is read here rather than left to `MotionProvider`.
 */

const MARKS = {
  copy: CopyIcon,
  hash: HashIcon,
} as const;

const ENTER = {
  opacity: { duration: 0.1, ease: "easeOut" },
  scale: { type: "spring", duration: 0.25, bounce: 0.3 },
} as const;

const EXIT = { duration: 0.08, ease: "easeOut" } as const;

export function CopyMark({
  mark,
  copied,
}: {
  mark: keyof typeof MARKS;
  copied: boolean;
}): React.ReactNode {
  const reduce = useReducedMotion();
  const Idle = MARKS[mark];
  const from = reduce ? 1 : 0.5;

  return (
    <span aria-hidden="true" className="relative grid size-3.75 select-none">
      <motion.span
        className="absolute inset-0 grid place-items-center"
        initial={false}
        animate={
          copied ? { opacity: 0, scale: from } : { opacity: 1, scale: 1 }
        }
        transition={copied ? EXIT : ENTER}
      >
        <Idle className="size-full" />
      </motion.span>
      <motion.span
        className="absolute inset-0 grid place-items-center"
        initial={false}
        animate={
          copied ? { opacity: 1, scale: 1 } : { opacity: 0, scale: from }
        }
        transition={copied ? ENTER : EXIT}
      >
        <CheckIcon className="size-full" />
      </motion.span>
    </span>
  );
}
