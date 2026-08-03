"use client";

import { MinusIcon, PlusIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion, type Variants } from "motion/react";
import { useRef, useState } from "react";

const variants: Variants = {
  enter: (direction: number) => ({
    y: direction > 0 ? 20 : -20,
    opacity: 0,
  }),
  center: {
    y: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    y: direction > 0 ? -20 : 20,
    opacity: 0,
  }),
};

function NumberCounter({ initialValue = 0 }: { initialValue?: number }) {
  const [count, setCount] = useState(initialValue);
  const directionRef = useRef<number>(1);

  const increment = () => {
    directionRef.current = 1;
    setCount((prev) => prev + 1);
  };

  const decrement = () => {
    directionRef.current = -1;
    setCount((prev) => prev - 1);
  };

  /*
   * `p-1` below is load-bearing, not spacing for its own sake. A child
   * background paints over a parent's inset ring, so without it the hovered
   * button erased the hairline down the whole left edge and squared off the
   * two corners it met. The padding keeps every hover fill clear of the ring.
   * It also lands the control at 28.8px, which is the project's h-9.
   */
  return (
    <div className="inline-flex items-center gap-1 rounded-md bg-bg p-1 ring-1 ring-stroke ring-inset shadow-sm">
      <button
        onClick={decrement}
        className="flex size-7 cursor-pointer items-center justify-center rounded-md text-text-secondary transition-colors duration-150 hover:bg-fill hover:text-text-primary active:bg-fill-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15"
        aria-label="Decrement"
        type="button"
      >
        <MinusIcon className="size-3" />
      </button>

      <div className="relative h-7 w-8 overflow-hidden">
        <AnimatePresence
          mode="popLayout"
          initial={false}
          custom={directionRef.current}
        >
          <motion.span
            key={count}
            custom={directionRef.current}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              duration: 0.15,
              ease: "easeOut",
            }}
            className="absolute inset-0 flex items-center justify-center text-meta font-medium text-text-primary tabular-nums"
          >
            {count}
          </motion.span>
        </AnimatePresence>
      </div>

      <button
        onClick={increment}
        className="flex size-7 cursor-pointer items-center justify-center rounded-md text-text-secondary transition-colors duration-150 hover:bg-fill hover:text-text-primary active:bg-fill-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15"
        aria-label="Increment"
        type="button"
      >
        <PlusIcon className="size-3" />
      </button>
    </div>
  );
}

const page = () => {
  return (
    <div className="flex h-64 w-full items-center justify-center">
      <NumberCounter initialValue={0} />
    </div>
  );
};

export default page;
