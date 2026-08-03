import type React from "react";
import { CONTENT_WIDTH } from "@/lib/constants";
import { cn } from "@/lib/utils";

type Align = "center" | "top";

interface PageShellProps {
  children: React.ReactNode;
  /**
   * "center" vertically centers the column and still scrolls correctly when
   * content outgrows a short viewport. "top" is for the longer index pages.
   */
  align?: Align;
  className?: string;
}

export function PageShell({
  children,
  align = "center",
  className,
}: PageShellProps) {
  return (
    <main
      className={cn(
        "min-h-svh flex justify-center px-6 py-16 sm:py-20",
        align === "center" ? "items-center" : "items-start",
      )}
    >
      <div className={cn("w-full", CONTENT_WIDTH, className)}>{children}</div>
    </main>
  );
}
