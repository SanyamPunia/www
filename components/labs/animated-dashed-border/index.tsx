"use client";

import { useState } from "react";
import "./styles.css";

const AnimatedDashedBorder = ({
  borderRadius = "md",
}: {
  borderRadius?: "md" | "xl";
}) => {
  const w = 200;
  const h = 100;
  const r = borderRadius === "xl" ? 6 : 3;

  return (
    <svg
      className="animated-border-svg"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        className="animated-dash-path"
        d={`
          M ${w / 2} 0.5
          H ${w - r - 0.5}
          A ${r} ${r} 0 0 1 ${w - 0.5} ${r + 0.5}
          V ${h - r - 0.5}
          A ${r} ${r} 0 0 1 ${w - r - 0.5} ${h - 0.5}
          H ${r + 0.5}
          A ${r} ${r} 0 0 1 0.5 ${h - r - 0.5}
          V ${r + 0.5}
          A ${r} ${r} 0 0 1 ${r + 0.5} 0.5
          Z
        `}
        fill="none"
        stroke="var(--color-text-muted)"
        strokeWidth="1.5"
        /*
         * The gap is 3.5 rather than 3 because `strokeLinecap: round` adds a
         * cap of strokeWidth/2 at each dash end, so a dash paints strokeWidth
         * longer than its dasharray value and the gap paints that much
         * shorter. At 1.5 a gap of 3 would render 1.5 and the border would
         * read closer to solid. Keeping the gap at a visible 2 means the
         * period is 7.5, which is what the -15 in `dash-march` is a multiple
         * of. Change one and the other has to follow or the loop jumps.
         */
        strokeDasharray="4 3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
};

const page = () => {
  const [activeRadius, setActiveRadius] = useState<"md" | "xl">("md");

  return (
    <div className="adb flex h-80 w-full flex-col items-center justify-center gap-6">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setActiveRadius("md")}
          className={`cursor-pointer rounded-full px-3 py-1.5 font-mono text-meta transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 ${
            activeRadius === "md"
              ? "bg-fill text-text-primary"
              : "bg-transparent text-text-muted hover:text-text-primary"
          }`}
        >
          rounded-md
        </button>
        <button
          type="button"
          onClick={() => setActiveRadius("xl")}
          className={`cursor-pointer rounded-full px-3 py-1.5 font-mono text-meta transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 ${
            activeRadius === "xl"
              ? "bg-fill text-text-primary"
              : "bg-transparent text-text-muted hover:text-text-primary"
          }`}
        >
          rounded-xl
        </button>
      </div>

      <div
        className={`demo-card relative ${
          activeRadius === "xl" ? "rounded-xl" : "rounded-md"
        }`}
      >
        <AnimatedDashedBorder borderRadius={activeRadius} />
        <div className="relative z-10 p-6">
          <p className="text-body text-text-secondary font-mono">
            animated dashed border
          </p>
          <p className="mt-1 text-meta text-text-muted">
            dashes march around the path
          </p>
        </div>
      </div>
    </div>
  );
};

export default page;
