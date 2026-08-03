"use client";

import { useInView } from "motion/react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * The signature, drawn on rather than faded in.
 *
 * The asset is fetched and inlined at runtime rather than imported, because it
 * is 38 KB of path data for a decorative flourish at the very bottom of the
 * page, and importing it would put all of that in the bundle.
 *
 * Its paths ship filled `#ffffff` from the dark build, so every fill is
 * stripped and each path is redrawn as a stroke in `currentColor`, then
 * revealed by animating `stroke-dashoffset` from the path's own length to zero.
 */
export function Signature({ className }: { className?: string }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const holderRef = useRef<HTMLDivElement>(null);
  const inView = useInView(wrapperRef, { once: true, margin: "100px" });

  useEffect(() => {
    if (!inView) return;

    let cancelled = false;
    const holder = holderRef.current;
    if (!holder) return;

    // MotionConfig's reducedMotion only governs Motion's own animations, and
    // this one is raw CSS, so it has to check for itself.
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    (async () => {
      const markup = await fetch("/assets/signature.svg").then((r) => r.text());
      if (cancelled) return;
      holder.innerHTML = markup;

      for (const group of holder.querySelectorAll<SVGGElement>("svg g")) {
        group.removeAttribute("fill");
        group.removeAttribute("fill-opacity");
        group.style.fill = "none";
      }

      const paths = holder.querySelectorAll<SVGPathElement>("svg path");
      paths.forEach((path, i) => {
        const length = path.getTotalLength();
        path.removeAttribute("fill");
        path.style.fill = "none";
        path.setAttribute("stroke", "currentColor");
        path.setAttribute("stroke-width", "2.5");
        path.setAttribute("stroke-linecap", "round");
        path.setAttribute("stroke-linejoin", "round");
        path.style.strokeDasharray = `${length}`;

        if (reduced) {
          path.style.strokeDashoffset = "0";
          return;
        }
        path.style.strokeDashoffset = `${length}`;
        path.style.animation = `signature-draw 0.8s linear forwards ${0.5 + i * 0.06}s`;
      });

      /*
       * The asset is a 375x375 square but the ink only occupies a low, wide
       * band inside it, so centring the box leaves the mark sitting low and
       * left of where it looks centred. Retighten the viewBox onto the real
       * ink bounds, then let the element size itself from that aspect. Done
       * here rather than by editing the file because getBBox is the only
       * reliable way to measure it, the paths carry group transforms.
       */
      const svg = holder.querySelector("svg");
      if (!svg) return;
      const box = svg.getBBox();
      const pad = 2; // the stroke straddles the geometric edge
      svg.setAttribute(
        "viewBox",
        `${box.x - pad} ${box.y - pad} ${box.width + pad * 2} ${box.height + pad * 2}`,
      );
      svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
      svg.removeAttribute("width");
      svg.removeAttribute("height");
      svg.style.display = "block";
      svg.style.height = "100%";
      svg.style.width = "auto";
    })();

    return () => {
      cancelled = true;
      holder.innerHTML = "";
    };
  }, [inView]);

  return (
    // sized by height only, the width follows the mark's own aspect once the
    // viewBox is tightened, so it never carries dead space beside the ink
    <div
      ref={wrapperRef}
      className={cn("h-10 w-auto text-text-primary", className)}
    >
      <div
        ref={holderRef}
        aria-hidden="true"
        className="h-full w-auto opacity-90"
      />
    </div>
  );
}
