import { cn } from "@/lib/utils";

/**
 * The layout both figures share. `Breakout` takes a figure out of the 538px
 * measure the way `the-submenu-closes-before-you-get-there` does: left by
 * half the parent, back by half its own width, and the width takes a gutter
 * off `100vw` so the scrollbar cannot cause a sideways scroll. 54rem and not
 * wider: the rail's back link starts 32.8rem left of centre and its text ends
 * about 28.5rem out, so a figure 27rem either side clears it. `Phase` is one
 * numbered column, and the figures separate their phases with hairlines,
 * vertical side by side and horizontal once they stack.
 */

/** Every panel in the post is this size, so every crop is the same crop. */
export const SIZE = "h-100 w-100";

export function Breakout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative left-1/2 w-[min(100vw-2rem,54rem)] -translate-x-1/2">
      {children}
    </div>
  );
}

export function Phase({
  n,
  title,
  note,
  narrow = false,
  children,
}: {
  n: number;
  title: string;
  note?: string;
  /** cap the stack at the panel's width and centre it in the column, so a
      320px panel does not sit hard left in a wider column */
  narrow?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col px-6 py-8 sm:px-10 sm:py-10">
      <div
        className={cn(
          "flex w-full flex-col gap-5",
          narrow && "mx-auto max-w-100",
        )}
      >
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline gap-2">
            <span className="text-meta text-text-muted tabular-nums">
              {String(n).padStart(2, "0")}
            </span>
            <span className="text-action text-text-primary">{title}</span>
          </div>
          {note ? (
            <span className="text-meta text-text-muted">{note}</span>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  );
}
