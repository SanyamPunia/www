"use client";

import { Demo } from "@/components/blogs/demo";
import { cn } from "@/lib/utils";
import { Breakout, Phase, SIZE } from "./figure";
import { Queue } from "./queue";

/**
 * The panel before and after the fix, all real DOM, at the author's
 * implementation values.
 *
 * - `before`: a fixed-height frame with a 12px radius, 6px of padding, a
 *   `#F1F2F1` ground, `overflow: hidden` and a 1px outside box-shadow at
 *   `rgba(43,43,43,.045)` in the product, rendered here as `#fdba74` and
 *   labelled as contrast enhanced, with a square white scroller inside it. The frame
 *   sits in a square `overflow: hidden` wrapper of exactly its size, which
 *   clips the external ring's straight runs and leaves its curved corner
 *   pieces. Those pieces are the arcs. Disabling only the box-shadow removes
 *   them.
 * - `after`: a rounded white parent with `overflow: hidden`, the 6px grey ring
 *   drawn by an absolute, `pointer-events: none` overlay with
 *   `border-radius: inherit` and an inset box-shadow, and a square transparent
 *   scroller with `margin: 6px` and `height: calc(100% - 12px)`.
 *
 * Nothing here draws the defect. It comes out of the before layout, and the
 * zooms are clones of the rendered panels.
 *
 * **Why the colours are literals.** These are the product's own values, and
 * the post is about how they render, so a token a percent off would be a
 * different experiment. They live here and nowhere else, the same standing
 * the brand marks' hex has.
 */

export type Build = "before" | "after";

const GREY = "#F1F2F1";
const OUTLINE = "0 0 0 1px rgba(43, 43, 43, 0.045)";

/* the broken build's external ring, recoloured so the clipped fragments can
   be seen: at the product's own 4.5% it composites to the band's colour on
   this page. Only the colour changes. The geometry and the clip are the same,
   and every figure showing it carries `CONTRAST_LABEL` */
const BEFORE_RING = "0 0 0 1px #fdba74";
export const CONTRAST_LABEL = "Contrast enhanced to reveal the artifact.";

export const ZOOM = 3;

/* how far the zoomed corner sits from the crop's edge, in panel px, so the
   1px outline outside the frame is inside the crop */
const MARGIN = 3;

/* the illustration's own thumb: thin and `text-muted`, so the scrollbar
   reads against the grey frame it sits beside. A standard `scrollbar-color`
   overrides the site's `::-webkit-scrollbar` rules for these scrollers only,
   and the page and the code blocks keep the light site scrollbar */
const SCROLLER =
  "overflow-y-scroll [scrollbar-width:thin] [scrollbar-color:var(--color-text-muted)_transparent]";

/* where the frame's outer curve crosses the corner's diagonal, measured
   along each axis from the corner of its box: `r - r/√2` for the 12px
   radius. The outline sits on this curve */
const OUTLINE_AT = 12 - 12 / Math.SQRT2;

/**
 * The panel itself, sized by `className`. `Original` renders it too.
 * `highlight` recolours the before build's external ring to `BEFORE_RING`;
 * without it the ring is the product's own `OUTLINE`, which is how the arc
 * looked when it shipped.
 */
export function Frame({
  build,
  className,
  highlight = false,
  children,
}: {
  build: Build;
  className: string;
  highlight?: boolean;
  children: React.ReactNode;
}) {
  if (build === "after") {
    return (
      <div
        className={cn("relative overflow-hidden rounded-xl bg-bg", className)}
        style={{ boxShadow: OUTLINE }}
      >
        <div
          className={cn(
            SCROLLER,
            "m-[6px] h-[calc(100%-12px)] rounded-none bg-transparent p-[12px]",
          )}
        >
          {children}
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          style={{ boxShadow: `inset 0 0 0 6px ${GREY}` }}
        />
      </div>
    );
  }

  return (
    /* the square clip: zero padding, no radius, exactly the panel's size.
       It cuts the frame's external ring off along the straight edges, and
       leaves the curved pieces at each corner, which sit inside its square
       corner. Those pieces are the arcs. Nothing here draws them */
    <div className={cn("overflow-hidden p-0", className)}>
      <div
        className="size-full overflow-hidden rounded-xl p-[6px]"
        style={{
          background: GREY,
          boxShadow: highlight ? BEFORE_RING : OUTLINE,
        }}
      >
        <div className={cn(SCROLLER, "h-full rounded-none bg-bg p-[12px]")}>
          {children}
        </div>
      </div>
    </div>
  );
}

/* an arrow coming in from outside the frame along the corner's diagonal,
   stopping just short of the outline, drawn in crop px from the top-left and
   mirrored onto the top-right. It points at the outline and covers none of
   it */
function Arrow({ zoom }: { zoom: number }) {
  const tip = (MARGIN + OUTLINE_AT) * zoom - 4;
  const tail = Math.max(tip - 26, 2);
  const head = 5;
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 64 64"
      className="pointer-events-none absolute top-0 z-10 size-20"
      style={{ right: 0, transform: "scaleX(-1)" }}
    >
      <g
        className="stroke-danger"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        <path d={`M ${tail} ${tail} L ${tip} ${tip}`} />
        <path
          d={`M ${tip - head} ${tip} L ${tip} ${tip} L ${tip} ${tip - head}`}
        />
      </g>
    </svg>
  );
}

/**
 * The top-right corner of a rendered panel at 3x: a clone of the same DOM at
 * the same size, so a before crop and an after crop are the same crop.
 *
 * The crop's own edge is `stroke-soft`, the lightest hairline there is. At
 * `stroke` it was darker than the shipped arc, and its rounded corner drew a
 * second curve beside the one the crop exists to show.
 */
export function Zoom({
  build,
  highlight = false,
  mark,
  zoom = ZOOM,
  className,
}: {
  build: Build;
  highlight?: boolean;
  mark?: boolean;
  zoom?: number;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      inert
      className={cn(
        "relative h-28 w-full overflow-hidden rounded-lg bg-bg ring-1 ring-stroke-soft",
        className,
      )}
    >
      <div
        className="absolute"
        style={{
          right: MARGIN * zoom,
          top: MARGIN * zoom,
          scale: zoom,
          transformOrigin: "top right",
        }}
      >
        {/* a copy draws the shapes alone: at this scale the first row's text
            fills the corner */}
        <Frame build={build} className={SIZE} highlight={highlight}>
          {null}
        </Frame>
      </div>
      {mark ? <Arrow zoom={zoom} /> : null}
    </div>
  );
}

const CASES = [
  { build: "before", n: 4, title: "Before", note: "Grey frame, square clip." },
  { build: "after", n: 5, title: "After", note: "White clip, inset ring." },
] as const;

/**
 * Before and after as two more phases, continuing the numbering from
 * `Original`, at one size, content and scroll position, each with the same
 * crop of its top-right corner at 6x. The contrast label sits under the card.
 */
export function Cases() {
  return (
    <Breakout>
      <Demo className="block select-none p-0 shadow-frame ring-0">
        <div className="grid w-full divide-y divide-stroke sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          {CASES.map((c) => (
            <Phase key={c.build} n={c.n} title={c.title} note={c.note} narrow>
              <Frame build={c.build} className={SIZE} highlight>
                <Queue />
              </Frame>
              <Zoom
                build={c.build}
                highlight
                mark={c.build === "before"}
                zoom={6}
                className="h-60"
              />
            </Phase>
          ))}
        </div>
      </Demo>
      {/* one short line under the card rather than a row inside it: the
          sentence about the change is already the prose above the figure */}
      <p className="-mt-3 mb-6 text-center text-meta text-text-muted">
        {CONTRAST_LABEL}
      </p>
    </Breakout>
  );
}
