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
      {/* motion. */}
      {/* initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ delay: 0.15 }} */}
      <div className="px-3 max-w-md mx-auto overflow-x-hidden">{children}</div>
    </>
  );
};

export default MaxWidthWrapper;
