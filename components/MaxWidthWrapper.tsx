"use client";

import React, { CSSProperties } from "react";
import { motion, useScroll } from "framer-motion";
import { cn } from "@/lib/utils";

const MaxWidthWrapper = ({
  children,
  className,
  style,
  ...props
}: {
  children?: React.ReactNode;
  className?: string;
  style?: CSSProperties;
  [key: string]: any;
}) => {
  const { scrollYProgress } = useScroll();

  return (
    <>
      {/* <motion.div
        className="progress-bar relative"
        style={{ scaleX: scrollYProgress }}
      /> */}
      {/* motion. */}
      {/* initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ delay: 0.15 }} */}
      <div
        className={cn("px-3 max-w-md mx-auto overflow-x-hidden", className)}
        {...props}
      >
        {children}
      </div>
    </>
  );
};

export default MaxWidthWrapper;
