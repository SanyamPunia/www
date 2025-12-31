"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

interface TooltipProps {
  show: boolean;
  children: React.ReactNode;
  onOpenProvider?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

type TooltipPosition = "right" | "left" | "top" | "bottom";

export default function Tooltip({
  show,
  children,
  onOpenProvider,
  onMouseEnter,
  onMouseLeave,
}: TooltipProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<TooltipPosition>("right");

  useEffect(() => {
    if (!show || !containerRef.current || !tooltipRef.current) return;

    const container = containerRef.current;
    const tooltip = tooltipRef.current;

    const containerRect = container.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const padding = 8; // padding from edges

    // check right edge
    const spaceRight = viewportWidth - containerRect.right;
    const spaceLeft = containerRect.left;
    const spaceTop = containerRect.top;
    const spaceBottom = viewportHeight - containerRect.bottom;

    // calculate required space for each position
    const tooltipWidth = tooltipRect.width;
    const tooltipHeight = tooltipRect.height;

    let newPosition: TooltipPosition = "right";

    // check if right side has enough space
    if (spaceRight >= tooltipWidth + padding) {
      newPosition = "right";
    }
    // left
    else if (spaceLeft >= tooltipWidth + padding) {
      newPosition = "left";
    }
    // top
    else if (spaceTop >= tooltipHeight + padding) {
      newPosition = "top";
    }
    // bottom
    else if (spaceBottom >= tooltipHeight + padding) {
      newPosition = "bottom";
    }
    // fallback: use the side with more space
    else {
      if (spaceRight > spaceLeft) {
        newPosition = "right";
      } else {
        newPosition = "left";
      }
    }

    setPosition(newPosition);
  }, [show]);

  const getPositionClasses = () => {
    switch (position) {
      case "left":
        return "right-full top-1/2 transform -translate-y-1/2 mr-2";
      case "top":
        return "left-1/2 bottom-full transform -translate-x-1/2 mb-2";
      case "bottom":
        return "left-1/2 top-full transform -translate-x-1/2 mt-2";
      default:
        return "left-full top-1/2 transform -translate-y-1/2 ml-2";
    }
  };

  const getArrowClasses = () => {
    switch (position) {
      case "left":
        return "absolute left-full top-1/2 transform -translate-y-1/2 w-0 h-0 border-t-4 border-b-4 border-l-4 border-transparent border-l-neutral-900";
      case "top":
        return "absolute left-1/2 top-full transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-neutral-900";
      case "bottom":
        return "absolute left-1/2 bottom-full transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-neutral-900";
      default:
        return "absolute right-full top-1/2 transform -translate-y-1/2 w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-neutral-900";
    }
  };

  return (
    <div ref={containerRef} className="relative inline-block">
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            ref={tooltipRef}
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={`absolute ${getPositionClasses()} px-3 py-2 text-xs bg-neutral-900 text-text-primary rounded-sm whitespace-nowrap z-50`}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
          >
            <div className="space-y-1">
              <div>email copied</div>
              {onOpenProvider && (
                <button
                  type="button"
                  onClick={onOpenProvider}
                  className="text-emerald-400 cursor-pointer hover:text-emerald-300 underline underline-offset-2 transition-colors"
                >
                  open mail instead?
                </button>
              )}
            </div>
            <div className={getArrowClasses()}></div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
