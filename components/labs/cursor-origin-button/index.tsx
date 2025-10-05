"use client";

import { useRef } from "react";
import "./styles.css";

const page = () => {
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();

    const buffer = 0.2; // 20% buffer around cursor
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    // expand capture area
    const expandedX = Math.max(0, Math.min(100, x + (x - 50) * buffer));
    const expandedY = Math.max(0, Math.min(100, y + (y - 50) * buffer));

    button.style.setProperty("--cursor-x", `${expandedX}%`);
    button.style.setProperty("--cursor-y", `${expandedY}%`);
  };

  return (
    <div className="cob flex h-64 w-full items-center justify-center border border-[#131313] rounded-sm">
      <button
        type="button"
        ref={buttonRef}
        onMouseMove={handleMouseEnter}
        className="h-12 px-7 rounded-md font-mono text-sm cursor-pointer border border-[#181818] text-white hover:tracking-wide transition-all duration-300"
      >
        <span className="label">▲ Next.js</span>
      </button>
    </div>
  );
};

export default page;
