"use client";

import { AnimatePresence, motion, type Variants } from "framer-motion";
import { Minus, Plus } from "lucide-react";
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

  return (
    <div className="inline-flex items-center gap-1 rounded-md bg-[#0B0B0B] border border-[#1e1e1e] shadow-sm">
      <button
        onClick={decrement}
        className="cursor-pointer flex h-7 w-7 items-center justify-center rounded-l-md text-[#a3a3a3] transition-colors hover:bg-[#141414] hover:text-[#f5f5f5]"
        aria-label="Decrement"
        type="button"
      >
        <Minus className="h-3 w-3" />
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
            className="absolute inset-0 flex items-center justify-center text-xs font-medium text-[#f5f5f5] tabular-nums"
          >
            {count}
          </motion.span>
        </AnimatePresence>
      </div>

      <button
        onClick={increment}
        className="cursor-pointer flex h-7 w-7 items-center justify-center rounded-r-md text-[#a3a3a3] transition-colors hover:bg-[#141414] hover:text-[#f5f5f5]"
        aria-label="Increment"
        type="button"
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
}

const page = () => {
  return (
    <div className="flex h-64 w-full items-center justify-center border border-[#131313] rounded-sm">
      <NumberCounter initialValue={0} />
    </div>
  );
};

export default page;
