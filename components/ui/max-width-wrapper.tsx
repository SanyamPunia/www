"use client";

import { motion } from "framer-motion";
import type React from "react";
import { cn } from "@/lib/cn";

type ContainerSize =
  | "none"
  | "sm"
  | "md"
  | "lg"
  | "xl"
  | "2xl"
  | "3xl"
  | "screen-sm"
  | "screen-md"
  | "screen-lg"
  | "screen-xl"
  | "screen-2xl";

const sizeToClass: Record<ContainerSize, string | undefined> = {
  none: undefined,
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "screen-sm": "max-w-screen-sm",
  "screen-md": "max-w-screen-md",
  "screen-lg": "max-w-screen-lg",
  "screen-xl": "max-w-screen-xl",
  "screen-2xl": "max-w-screen-2xl",
};

type PaddingVariant = "none" | "sm" | "md" | "lg" | "xl";

const paddingToClass: Record<PaddingVariant, string | undefined> = {
  none: undefined,
  sm: "px-4",
  md: "px-4 md:px-6",
  lg: "px-6 md:px-8",
  xl: "px-8 md:px-12",
};

type PolymorphicProps<E extends React.ElementType> = {
  as?: E;
  children: React.ReactNode;
  size?: ContainerSize;
  padding?: PaddingVariant;
  center?: boolean;
  fullWidth?: boolean;
  className?: string;
  animated?: boolean;
  showTerminalHeader?: boolean;
} & Omit<React.ComponentPropsWithoutRef<E>, "as" | "children" | "className">;

const defaultElement = "div";

function MaxWidthWrapper<E extends React.ElementType = typeof defaultElement>({
  as,
  children,
  size = "screen-xl",
  padding = "md",
  center = true,
  fullWidth = true,
  className,
  animated = false,
  showTerminalHeader = false,
  ...rest
}: PolymorphicProps<E>) {
  const Component = animated
    ? motion.section
    : ((as || defaultElement) as React.ElementType);

  const motionProps = animated
    ? {
        initial: { opacity: 0, y: 12, scale: 0.98 },
        animate: { opacity: 1, y: 0, scale: 1 },
        transition: { duration: 0.45, ease: "easeOut" },
      }
    : {};

  return (
    <Component
      className={cn(
        fullWidth && "w-full",
        center && "mx-auto",
        sizeToClass[size],
        paddingToClass[padding],
        className,
      )}
      {...motionProps}
      {...rest}
    >
      {showTerminalHeader && (
        <div className="flex items-center gap-2 py-3 border-b border-[#121212] -mx-4 md:-mx-6">
          <div className="size-2.5 rounded-full bg-[#FF605C] ml-2"></div>
          <div className="size-2.5 rounded-full bg-[#FFBD44]"></div>
          <div className="size-2.5 rounded-full bg-[#00CA4E]"></div>
        </div>
      )}
      {children}
    </Component>
  );
}

export default MaxWidthWrapper;
