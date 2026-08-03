"use client";

import { motion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

type State = "idle" | "editing" | "loading" | "applied";

/*
 * One radius for the whole control. The wrapper clips with `overflow-hidden`,
 * so its radius and each state's own radius have to be the same token or the
 * clip cuts a different curve than the border draws. They were `rounded-lg`
 * outside and `rounded-md` inside, which is what made the corners disagree.
 */
const RADIUS = "rounded-md";

/*
 * Both labels render twice, once in the visible state and once in the hidden
 * element the width animation measures. Shared so the two cannot drift, since
 * a mismatch silently animates to the wrong width.
 */
const IDLE_LABEL = "Add Discount Code";
const APPLIED_LABEL = "Applied 🎉";

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
    <div className="flex h-64 w-full items-center justify-center">
      {/* Hidden elements for width measurement */}
      <button
        type="button"
        ref={buttonRef}
        className="invisible absolute h-9 px-3 text-meta"
      >
        {IDLE_LABEL}
      </button>
      <button
        type="button"
        ref={appliedRef}
        className="invisible absolute h-9 px-3 text-meta"
      >
        {APPLIED_LABEL}
      </button>

      <motion.div
        className={`relative h-9 overflow-hidden ${RADIUS}`}
        animate={{ width: getWidth() }}
        transition={{ duration: 0.12, ease: [0.2, 0, 0.38, 0.9] }}
        style={{ width: buttonWidth }}
      >
        {state === "applied" && (
          <button
            type="button"
            onClick={reset}
            className={`absolute inset-0 flex items-center px-3 text-meta cursor-pointer transition-colors text-nowrap border-2 border-emerald-500/50 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 ${RADIUS}`}
          >
            {APPLIED_LABEL}
          </button>
        )}

        {state === "loading" && (
          <div
            className={`absolute inset-0 flex items-center justify-between px-3 text-meta text-nowrap border-2 border-stroke bg-fill/50 text-text-secondary ${RADIUS}`}
          >
            <span>Applying...</span>
            <motion.div
              className="w-3 h-3 border-2 border-stroke border-t-text-muted rounded-full"
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
            className={`absolute inset-0 flex items-center px-3 text-meta cursor-pointer transition-colors text-nowrap border-2 border-dashed border-stroke bg-fill/30 hover:bg-fill/50 text-text-secondary ${RADIUS}`}
          >
            {IDLE_LABEL}
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
              className={`w-full h-full bg-transparent text-meta px-3 outline-none placeholder:text-meta placeholder:text-text-muted border-2 border-stroke transition-all text-text-primary ${RADIUS}`}
            />
          </div>
        )}
      </motion.div>
    </div>
  );
}
