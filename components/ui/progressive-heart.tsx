"use client";

import type { SVGProps } from "react";
import { cn } from "@/lib/utils";

interface ProgressiveHeartProps extends SVGProps<SVGSVGElement> {
  isLiked: boolean;
}

export function ProgressiveHeart({
  isLiked,
  className,
  ...props
}: ProgressiveHeartProps) {
  const size = props.width || props.height || 16;
  const heartPath =
    "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z";

  return (
    <svg
      {...props}
      viewBox="0 0 24 24"
      fill={isLiked ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <title>Heart icon</title>
      <path d={heartPath} />
    </svg>
  );
}
