"use client";

import * as Primitive from "@radix-ui/react-dropdown-menu";
import type React from "react";
import { cn } from "@/lib/utils";

/**
 * The dropdown menu, on Radix. Thin wrappers that carry the light theme, so a
 * call site never restates the surface, stroke or radius.
 */
export const DropdownMenu = Primitive.Root;
export const DropdownMenuTrigger = Primitive.Trigger;

export function DropdownMenuContent({
  className,
  align = "end",
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        align={align}
        sideOffset={sideOffset}
        // near a screen edge a menu needs room to flip rather than clip
        collisionPadding={12}
        className={cn(
          // `text-meta` on the container, not only on the children. The menu
          // is portaled to <body>, so it sits outside the page's type scale
          // and anything inside it without an explicit size falls back to the
          // root 16px rather than this design's 12px.
          "z-50 min-w-40 rounded-lg bg-bg p-1 text-meta ring-1 ring-stroke ring-inset",
          "animate-in fade-in-0 zoom-in-95 duration-150",
          className,
        )}
        {...props}
      />
    </Primitive.Portal>
  );
}

export function DropdownMenuLabel({
  className,
  ...props
}: React.ComponentProps<typeof Primitive.Label>) {
  return (
    <Primitive.Label
      className={cn("px-2 py-1 text-meta text-text-muted", className)}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof Primitive.Separator>) {
  return (
    <Primitive.Separator
      className={cn("-mx-1 my-1 h-px bg-stroke-soft", className)}
      {...props}
    />
  );
}

export function DropdownMenuItem({
  className,
  ...props
}: React.ComponentProps<typeof Primitive.Item>) {
  return (
    <Primitive.Item
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-meta text-text-secondary outline-none",
        "transition-colors duration-200",
        // Radix drives hover and keyboard focus through the same attribute,
        // so the highlight follows arrow keys as well as the pointer
        "data-highlighted:bg-fill data-highlighted:text-text-primary",
        className,
      )}
      {...props}
    />
  );
}
