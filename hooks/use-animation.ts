"use client";

import { useInView } from "framer-motion";
import { useRef } from "react";

export const useAnimationInView = (amount = 0.2, once = true) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once, amount });

  const itemVariants = {
    hidden: { opacity: 0, y: 10, filter: "blur(5px)" },
    visible: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { duration: 0.5, ease: "easeOut" },
    },
  };

  return {
    ref,
    isInView,
    itemVariants,
  };
};
