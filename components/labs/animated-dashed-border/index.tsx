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
        stroke="#3f3f46"
        strokeWidth="1"
        strokeDasharray="4 3"
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
    <div className="adb flex flex-col gap-6 h-80 w-full items-center justify-center border border-[#131313] rounded-sm p-8">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setActiveRadius("md")}
          className={`cursor-pointer active:scale-[0.98] transition-all duration-200 px-3 py-1.5 text-xs font-mono rounded ${
            activeRadius === "md"
              ? "bg-zinc-800 text-white"
              : "bg-transparent text-zinc-500 hover:text-zinc-300"
          }`}
        >
          rounded-md
        </button>
        <button
          type="button"
          onClick={() => setActiveRadius("xl")}
          className={`cursor-pointer active:scale-[0.98] transition-all duration-200 px-3 py-1.5 text-xs font-mono rounded ${
            activeRadius === "xl"
              ? "bg-zinc-800 text-white"
              : "bg-transparent text-zinc-500 hover:text-zinc-300"
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
          <p className="text-sm text-zinc-400 font-mono">
            animated dashed border
          </p>
          <p className="text-xs text-zinc-600 mt-1">
            dashes march around the path
          </p>
        </div>
      </div>
    </div>
  );
};

export default page;
