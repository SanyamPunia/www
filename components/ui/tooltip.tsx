"use client";

import { AnimatePresence, motion } from "framer-motion";

interface TooltipProps {
  show: boolean;
  children: React.ReactNode;
  onOpenProvider?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export default function Tooltip({
  show,
  children,
  onOpenProvider,
  onMouseEnter,
  onMouseLeave,
}: TooltipProps) {
  return (
    <div className="relative inline-block">
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute left-full top-1/2 transform -translate-y-1/2 ml-2 px-3 py-2 text-xs bg-neutral-900 text-text-primary rounded-sm whitespace-nowrap z-50"
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
            <div className="absolute right-full top-1/2 transform -translate-y-1/2 w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-neutral-900"></div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
