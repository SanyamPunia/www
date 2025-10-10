"use client";

import { motion } from "framer-motion";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

type State = "idle" | "editing" | "loading" | "applied";

export default function DiscountCodeInput() {
  const [state, setState] = useState<State>("idle");
  const [code, setCode] = useState("");
  const [buttonWidth, setButtonWidth] = useState(0);
  const [appliedWidth, setAppliedWidth] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const appliedRef = useRef<HTMLButtonElement>(null);

  const INPUT_WIDTH = 208;
  const LOADING_WIDTH = INPUT_WIDTH * 0.75;

  useEffect(() => {
    if (state === "editing" && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [state]);

  useLayoutEffect(() => {
    if (buttonRef.current) setButtonWidth(buttonRef.current.offsetWidth);
    if (appliedRef.current) setAppliedWidth(appliedRef.current.offsetWidth);
  }, []);

  const reset = () => setState("idle");

  const handleBlur = () => {
    if (state === "editing") reset();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      reset();
    } else if (e.key === "Enter") {
      e.preventDefault();
      setState("loading");
      setTimeout(() => setState("applied"), 2500);
    }
  };

  const getWidth = () => {
    if (state === "applied") return appliedWidth;
    if (state === "loading") return LOADING_WIDTH;
    if (state === "editing") return INPUT_WIDTH;
    return buttonWidth;
  };

  return (
    <div className="flex h-64 w-full items-center justify-center border border-[#131313] rounded-sm">
      {/* Hidden elements for width measurement */}
      <button
        type="button"
        ref={buttonRef}
        className="invisible absolute h-9 px-3 text-xs"
      >
        Add Discount Code
      </button>
      <button
        type="button"
        ref={appliedRef}
        className="invisible absolute h-9 px-3 text-xs"
      >
        Applied 🎉
      </button>

      <motion.div
        className="relative h-9 rounded-sm overflow-hidden"
        animate={{ width: getWidth() }}
        transition={{ duration: 0.12, ease: [0.2, 0, 0.38, 0.9] }}
        style={{ width: buttonWidth }}
      >
        {state === "applied" && (
          <button
            type="button"
            onClick={reset}
            className="absolute inset-0 flex items-center px-3 text-xs cursor-pointer transition-colors text-nowrap border-2 border-emerald-500/50 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-md"
          >
            Applied 🎉
          </button>
        )}

        {state === "loading" && (
          <div className="absolute inset-0 flex items-center justify-between px-3 text-xs text-nowrap border-2 border-neutral-700 bg-neutral-800/50 text-neutral-300 rounded-md">
            <span>Applying...</span>
            <motion.div
              className="w-3 h-3 border-2 border-neutral-600 border-t-neutral-300 rounded-full"
              animate={{ rotate: 360 }}
              transition={{
                duration: 0.8,
                repeat: Number.POSITIVE_INFINITY,
                ease: "linear",
              }}
            />
          </div>
        )}

        {state === "idle" && (
          <button
            type="button"
            onClick={() => setState("editing")}
            className="absolute inset-0 flex items-center px-3 text-xs cursor-pointer transition-colors text-nowrap border-2 border-dashed border-neutral-700 bg-neutral-800/30 hover:bg-neutral-800/50 text-neutral-400 rounded-md"
          >
            Add Discount Code
          </button>
        )}

        {state === "editing" && (
          <div className="absolute inset-0 flex items-center">
            <input
              ref={inputRef}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              placeholder="Discount Code..."
              className="w-full h-full bg-transparent text-xs px-3 outline-none placeholder:text-neutral-500 border-2 border-neutral-700 rounded-md transition-all text-neutral-200"
            />
          </div>
        )}
      </motion.div>
    </div>
  );
}
