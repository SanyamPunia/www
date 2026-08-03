"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type React from "react";
import { cn } from "@/lib/utils";

export const TooltipProvider = TooltipPrimitive.Provider;

interface TooltipProps {
  children: React.ReactNode;
  label: string;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
}

export function Tooltip({
  children,
  label,
  side = "top",
  className,
}: TooltipProps) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={8}
          collisionPadding={12}
          className={cn(
            "z-50 rounded-md bg-text-primary px-2 py-1 text-meta font-medium",
            "animate-in fade-in-0 zoom-in-95 duration-150",
            className,
          )}
          // theme-constant fill, so the label colour is pinned rather than
          // taken from a token that would invert
          style={{ color: "#fff" }}
        >
          {label}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
