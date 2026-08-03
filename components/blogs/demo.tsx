import type React from "react";
import { cn } from "@/lib/utils";

/**
 * The frame every inline demo sits in.
 *
 * A live example is not prose and should not read as prose. The hairline says
 * "this is a thing you can poke", the same way a code block says "this is
 * source". Without it a demo just floats between paragraphs.
 *
 * `my-6` is for the MDX case, where a demo sits between paragraphs and needs
 * its own breathing room. Anywhere the parent already controls spacing, pass
 * `my-0`, or the margin stacks on top of the parent's gap.
 *
 * White, not `bg-surface`. The value was never the problem, `#fafafa` is 98%
 * lightness, but this is the largest filled area on the site and a big grey
 * rectangle reads heavy regardless. Everything else here is white with
 * hairlines, greys are reserved for small pills. The edge alone is enough.
 */
export function Demo({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "my-6 grid place-items-center rounded-lg bg-bg p-6 ring-1 ring-stroke ring-inset",
        className,
      )}
    >
      {children}
    </div>
  );
}
