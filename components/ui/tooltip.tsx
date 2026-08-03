"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type React from "react";
import { cn } from "@/lib/utils";

export const TooltipProvider = TooltipPrimitive.Provider;

interface TooltipProps {
  children: React.ReactNode;
  /**
   * A node, not just a string, so a caller can put a mark beside the text. The
   * content is a flex row, so an icon and a label lay themselves out without the
   * call site rebuilding the box.
   */
  label: React.ReactNode;
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
            // a flex row so a caller passing a mark plus text gets it aligned
            // without restating the box. Text-only labels are unaffected.
            "flex items-center gap-1.5",
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
