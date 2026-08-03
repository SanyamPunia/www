"use client";

import { MotionConfig } from "motion/react";
import type React from "react";

/**
 * Client boundary for Motion's global config. Children stay server
 * components, they are passed through as a prop.
 *
 * reducedMotion="user" makes Motion skip transform and layout animations for
 * anyone with the OS setting on, while still running opacity and colour. That
 * covers the vestibular triggers without a blanket CSS override.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
