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

/**
 * A tone per internal destination, derived from the href like the shape is.
 *
 * The three markless links in the home page's copy are the only ones with
 * nothing beside them saying they are links, so each takes its own hue: the
 * word at rest, and the rule under it at 45% until hover takes it to full.
 *
 * Route to token lives here and nowhere else, since this is the one component
 * that renders a link in prose. Adding a route means adding its token to
 * `@theme` first. A route without an entry is untoned, which is the default.
 */
const ROUTE_TONE: Record<string, { text: string; rule: string; wash: string }> =
  {
    "/work": {
      text: "text-link-work",
      rule: "after:bg-link-work/45 group-hover:after:bg-link-work",
      wash: "before:bg-link-work/12",
    },
    "/blogs": {
      text: "text-link-blogs",
      rule: "after:bg-link-blogs/45 group-hover:after:bg-link-blogs",
      wash: "before:bg-link-blogs/12",
    },
    "/lab": {
      text: "text-link-lab",
      rule: "after:bg-link-lab/45 group-hover:after:bg-link-lab",
      wash: "before:bg-link-lab/12",
    },
  };

/*
 * The hover wash, growing up out of the rule.
 *
 * `origin-bottom` on a scaleY is what makes it read as the rule thickening into
 * the word rather than as a box fading in behind it, which is the whole point:
 * the rule is the only thing marking these three as links at rest, so the hover
 * comes out of it.
 *
 * Its bottom edge is the rule's top edge. The rule is `0.14em` tall sitting at
 * `-0.1em`, so the top of it is `-0.04em`, and the two touch with no seam. Every
 * value is in `em` for the same reason the rule's are: a px offset does not
 * follow the 0.8 scale.
 *
 * It runs `0.12em` wider than the word on each side, where the rule stays the
 * word's own width. 1.7px of it, which is enough that the first and last letter
 * are not sitting on the edge of their own highlight and little enough that the
 * wash still reads as the rule growing rather than as a second shape.
 *
 * The top is the span's own content box, which for Inter sits `0.24em` above cap
 * height, so the wash clears the caps and the `y` in "currently" without a
 * measured height.
 *
 * `isolate` is what keeps the negative z-index inside the link. Without it the
 * wash paints behind the paragraph as well, which costs nothing on a white page
 * today and breaks the moment anything under it has a background.
 *
 * Under reduced motion the wash still appears, it just does not travel, the same
 * line `book-opening` draws.
 */
const WASH =
  "isolate before:-z-10 before:absolute before:inset-x-[-0.12em] before:top-0 before:bottom-[-0.04em] before:origin-bottom before:scale-y-0 before:rounded-t-[0.2em] before:transition-transform before:duration-200 group-hover:before:scale-y-100 motion-reduce:before:transition-none";

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
  // a pill has no rule to tone, and its mark already says it is a link
  const tone = favicon ? undefined : ROUTE_TONE[href];

  const classes = favicon
    ? cn(
        "inline-flex items-center gap-[0.5em] rounded-full bg-fill px-[0.5em] py-[0.25em]",
        /*
         * `leading-none` is what stops stacked pills overlapping, and without it
         * no amount of paragraph leading helps.
         *
         * An inline-flex takes the prose line-height for its own text item, so
         * the pill was the full line box plus its padding: 27.36px inside a
         * 23.04px line, overlapping the lines above and below by 4.32px. Raising
         * the paragraph's leading raised the pill by exactly as much, so the
         * overlap never moved.
         *
         * With a fixed internal leading the pill is 21.6px and sits inside its
         * line. `py-[0.25em]` spends the reclaimed space back on height, so it
         * paints the same size it always did.
         *
         * Safe for descenders: `items-center` centres the em box and the padding
         * absorbs the overhang, so nothing clips or crosses the rounded edge.
         */
        "leading-none",
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
        "group cursor-pointer transition-colors duration-200",
        // a toned link keeps its hue on hover: stepping to `text-primary` there
        // would take the colour away at the moment the pointer arrives
        tone ? tone.text : "hover:text-text-primary",
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
      className={cn(
        UNDERLINE,
        tone?.rule,
        tone && WASH,
        tone?.wash,
        drawAt !== undefined && UNDERLINE_DRAW,
      )}
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
