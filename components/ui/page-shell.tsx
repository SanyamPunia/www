import type React from "react";
import { CONTENT_WIDTH, WIDE_WIDTH } from "@/lib/constants";
import { cn } from "@/lib/utils";

type Align = "center" | "top";

interface PageShellProps {
  children: React.ReactNode;
  /**
   * "center" vertically centers the column and still scrolls correctly when
   * content outgrows a short viewport. "top" is for the longer index pages.
   */
  align?: Align;
  /** "wide" is the lab index grid, every other page is the prose column */
  width?: "content" | "wide";
  className?: string;
}

export function PageShell({
  children,
  align = "center",
  width = "content",
  className,
}: PageShellProps) {
  return (
    <main
      className={cn(
        "min-h-svh flex justify-center px-6 py-16 sm:py-20",
        align === "center" ? "items-center" : "items-start",
      )}
    >
      <div
        className={cn(
          "w-full",
          width === "wide" ? WIDE_WIDTH : CONTENT_WIDTH,
          className,
        )}
      >
        {children}
      </div>
    </main>
  );
}
