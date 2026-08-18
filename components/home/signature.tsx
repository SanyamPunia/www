"use client";

import { useInView } from "motion/react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * The signature, drawn on rather than faded in.
 *
 * The asset is fetched and injected rather than imported, so its path data
 * stays out of the bundle for a decorative mark at the very bottom of the page.
 *
 * It arrives animation-ready: two centreline strokes in writing order, already
 * `fill="none" stroke="currentColor"` with `pathLength="1"` on each, and a
 * viewBox tightened onto the ink. So this component measures nothing and
 * rewrites nothing, and the reveal is the `.signature` rules in globals.css.
 * The paths only exist once the mark is in view, which is what starts them.
 */
export function Signature({ className }: { className?: string }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const holderRef = useRef<HTMLDivElement>(null);
  const inView = useInView(wrapperRef, { once: true, margin: "100px" });

  useEffect(() => {
    if (!inView) return;

    const holder = holderRef.current;
    if (!holder) return;

    let cancelled = false;
    fetch("/assets/signature.svg")
      .then((r) => r.text())
      .then((markup) => {
        if (!cancelled) holder.innerHTML = markup;
      });

    return () => {
      cancelled = true;
      holder.innerHTML = "";
    };
  }, [inView]);

  return (
    // sized by height only, the width follows the mark's own aspect from its
    // viewBox, so it never carries dead space beside the ink
    <div
      ref={wrapperRef}
      className={cn("h-10 w-auto text-text-primary", className)}
    >
      <div
        ref={holderRef}
        aria-hidden="true"
        className="signature h-full w-auto opacity-90"
      />
    </div>
  );
}
