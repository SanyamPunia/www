"use client";

import { motion } from "motion/react";
import type React from "react";
import { cn } from "@/lib/utils";

const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08, delayChildren: 0.15 },
  },
};

/**
 * A fade and a 4px rise, and no blur.
 *
 * It carried `filter: blur(6px)` to `blur(0px)` as well, which is a common
 * arrival effect and reads as the page resolving out of focus rather than
 * appearing. It is also the most expensive part of it: a filter makes its element
 * a containing block for fixed descendants and forces its own compositing layer,
 * which is what `components/home/portrait.tsx` has to portal out of.
 */
const item = {
  hidden: { opacity: 0, y: 4 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" as const },
  },
};

/**
 * Stagger container. Children are passed through, so anything inside can stay
 * a server component.
 */
export function Reveal({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={container}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={item} className={cn(className)}>
      {children}
    </motion.div>
  );
}
