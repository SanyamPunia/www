"use client";

import React from "react";
import { motion, useScroll } from "framer-motion";

const MaxWidthWrapper = ({ children }: { children: React.ReactNode }) => {
  const { scrollYProgress } = useScroll();

  return (
    <>
      <motion.div
        className="progress-bar relative"
        style={{ scaleX: scrollYProgress }}
      />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ delay: 0.15 }}
        className="px-2 max-w-md mx-auto"
      >
        {children}
      </motion.div>
    </>
  );
};

export default MaxWidthWrapper;