import Link from "next/link";
import type React from "react";
import { faviconFor } from "@/lib/favicons";
import { cn } from "@/lib/utils";

interface InlineLinkProps {
  href: string;
  children: React.ReactNode;
  /** External links open in a new tab and get the rel guard. */
  external?: boolean;
  className?: string;
  /**
   * Milliseconds after mount to sweep the underline out, left to right. Omit
   * and the rule is simply there. Only the text shape has a rule, so this does
   * nothing on a link that resolves to a pill.
   */
  drawAt?: number;
}

const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2";

/* the rule itself */
const UNDERLINE =
  "relative after:absolute after:inset-x-0 after:bottom-[-0.1em] after:h-[0.14em] after:rounded-full after:bg-stroke-strong after:transition-colors after:duration-200 group-hover:after:bg-text-primary";

/*
 * The draw. `both` fill mode is what holds the rule at zero width through its
 * delay, so nothing flashes at full width before its turn. The delay reads
 * from a custom property because a pseudo-element cannot take an inline style,
 * but it does inherit one from its owner.
 */
const UNDERLINE_DRAW =
  "after:origin-left after:animate-[link-underline-draw_450ms_cubic-bezier(0.22,1,0.36,1)_both] after:[animation-delay:var(--underline-draw-at)]";

/**
 * The one treatment for a link inside a paragraph, in two shapes.
 *
 * A link to a site with a mark renders as a small pill, the same `rounded-full`
 * `bg-fill` shape as the primary button. Everything is sized in `em` so the
 * pill tracks whatever text it sits in rather than needing a size per call
 * site. Anything without a mark, meaning internal routes, stays a plain
 * underlined link.
 */
export function InlineLink({
  href,
  children,
  external,
  className,
  drawAt,
}: InlineLinkProps) {
  const favicon = faviconFor(href);

  const classes = favicon
    ? cn(
        "inline-flex items-center gap-[0.3em] rounded-full bg-fill px-[0.5em] py-[0.15em]",
        // align-middle centres the pill on the text's x-height, which leaves it
        // sitting a touch low against the line as a whole. The small lift is
        // optical, not derived, and it is in em so it holds at any text size.
        "translate-y-[-0.06em] align-middle",
        // Presses with the background, not a scale. A 2% scale on a mark this
        // small moves an edge by a quarter of a pixel, too little to read as
        // motion and more than enough to change its antialiasing, so fine
        // detail smears sideways instead of shrinking. See CLAUDE.md.
        "cursor-pointer transition-all duration-200 hover:bg-fill-hover active:bg-fill-active",
        "text-text-primary",
        FOCUS,
        className,
      )
    : cn(
        "group cursor-pointer transition-colors duration-200 hover:text-text-primary",
        FOCUS,
        "focus-visible:rounded-xs",
        className,
      );

  const content = favicon ? (
    <>
      {/* biome-ignore lint/performance/noImgElement: these are 0.4 to 1.2 KB
          local marks rendered at 16px, so the image optimiser costs more than
          it saves, and one is an SVG, which next/image refuses without turning
          on dangerouslyAllowSVG for the whole app. */}
      <img
        src={favicon.src}
        alt=""
        width={favicon.width}
        height={favicon.height}
        draggable={false}
        className={cn(
          "inline-block w-auto shrink-0 select-none rounded-[0.22em]",
          // a wide mark set to the square height runs twice as long and
          // swamps the line, so it is scaled to match their visual mass
          favicon.width > favicon.height ? "h-[0.6em]" : "h-[0.9em]",
        )}
      />
      {children}
    </>
  ) : (
    /*
     * The rule is a positioned `::after`, not `text-decoration`, so it can
     * carry rounded caps. `text-decoration-line` has no way to round its ends.
     *
     * Everything is in em so it tracks the text. A px thickness or offset does
     * not follow the 0.8 scale and drifts out of proportion, which is exactly
     * what happened to the old `underline-offset-[3px]`.
     *
     * No `align-middle` here either. It aligns the span's midpoint to the
     * baseline plus half the x-height, which drops the word below the line it
     * sits in. Text spans stay on `baseline`, the default. Only the favicon
     * above wants middle, because an image's baseline is its bottom edge.
     */
    <span
      className={cn(UNDERLINE, drawAt !== undefined && UNDERLINE_DRAW)}
      style={
        drawAt === undefined
          ? undefined
          : ({ "--underline-draw-at": `${drawAt}ms` } as React.CSSProperties)
      }
    >
      {children}
    </span>
  );

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={classes}
      >
        {content}
      </a>
    );
  }

  return (
    <Link href={href} className={classes}>
      {content}
    </Link>
  );
}
