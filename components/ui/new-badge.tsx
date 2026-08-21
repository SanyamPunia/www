import { caveat } from "@/app/fonts";
import { cn } from "@/lib/utils";

/**
 * A circle drawn round the word, in one stroke that starts and ends at the bottom
 * centre.
 *
 * It runs from the bottom, right and up, over the top leftward, down the left,
 * and back along the bottom *past* where it began, missing its own start by a
 * fraction. That near-miss crossing is the tell: a closed ellipse reads as a
 * border, and a pen circling something never lands exactly where it started.
 *
 * **Seven segments rather than four, and deliberately not an ellipse.** Four
 * quadrants of equal radius is what made the first one read as vector art. The
 * right side bulges further out than the left, the left is flatter than a circle
 * wants to be, the top dips slightly off centre, and two of the joins carry a
 * small tangent break so the outline changes direction rather than flowing
 * perfectly. None of it is random: the same shape every render, since a mark that
 * redraws differently each visit reads as a glitch.
 *
 * Starting and ending at the bottom is also what makes the draw-on read, since
 * the two ends meet there and the loop closes in front of you rather than
 * trailing off at a side.
 *
 * `preserveAspectRatio="none"` so it fills the word's box whatever that word
 * measures, and `vectorEffect="non-scaling-stroke"` so the stretch that costs
 * cannot thin the horizontal strokes against the vertical ones.
 */
const CIRCLE = [
  "M29 36.5",
  "C34 37.5 41 37 46 35.5",
  "C52.5 34 58 30.5 58.2 25",
  "C59.8 17 55.5 8 47 5.5",
  "C39 3.5 30 2.8 22 4",
  "C13 5.5 4.5 9.5 3.5 17",
  "C2.8 26 10 33.5 24 36",
  "C30 37 37 36.5 44 34.2",
].join(" ");

/**
 * A pencilled "new" hanging in the margin beside a row.
 *
 * It marks the newest entry in a list and nothing else, which is the only test
 * available here: both indexes are statically prerendered, so any check against
 * the current date would be answered once at build time and then keep claiming
 * the same thing until the next deploy. `sitemap.ts` avoids inventing timestamps
 * for the same reason. The newest entry is the newest whenever the page is
 * served, needs no clock, and cannot go stale.
 *
 * The cost is that it says "new" even when the newest post is old. That is
 * visible to whoever writes the posts, which is the right person to notice it.
 */
export function NewBadge() {
  return (
    <span
      className={cn(
        caveat.className,
        /*
         * Absolute, so a truncating title never has to share its width and the
         * row does not shift when the badge appears on one entry and not the
         * rest. `left-0` is the pill's own left edge, which already sits 12.8px
         * out from the column, and the translate hangs the badge off that.
         *
         * **The margin is measured from the circle, not from the word.** The
         * translate only moves the span by its own width, and the circle hangs
         * 6.4px past that on every side, so a margin sized to the word alone put
         * the circle's right edge 3.4px inside the row's hover pill and the two
         * touched. 16px leaves a 7.8px gap, close to the row's own `gap-3`.
         */
        "-translate-x-full absolute top-1/2 left-0 -ml-5 -translate-y-1/2",
        /*
         * Hidden below `md`, the same trade the post rail makes at `lg`. The
         * circle is what forced this: the word alone reached 44px past the column
         * against 51px of margin at `sm`, and with the circle and the margin it
         * clears the row needs 62px. At `md` there is 115px of margin, so nothing
         * here is living on an edge.
         */
        "hidden md:block",
        /*
         * 20px, which is 1.39x `text-body`. Caveat's x-height is far enough below
         * Inter's that matching the row's type by token renders visibly smaller
         * than it. Off the scale on purpose, like the annotation in
         * `document-pocket`.
         *
         * `select-none` because it is a mark on the list rather than part of it.
         * Dragging across the rows should pick up titles and dates, not a word
         * that is not in the copy.
         */
        "-rotate-6 select-none text-[1.25rem] text-text-secondary leading-none",
      )}
    >
      {/* behind the word rather than over it, and generously inset, since a
          circle drawn through its own text reads as a strike-through */}
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 62 40"
        preserveAspectRatio="none"
        /*
         * The vertical insets are asymmetric on purpose, and this is a
         * correction rather than a preference.
         *
         * `leading-none` makes the span's box exactly 1em, but Caveat's ascent
         * and descent together are more than that, so the glyphs are not centred
         * in it. "new" is also three x-height letters with no ascender and no
         * descender, which puts its ink low in the box: centring the circle on
         * the box left the word sitting in its bottom half.
         *
         * So the box is kept the same height, 1.6px above and 8px below instead
         * of 4.8px either side, which drops the circle 3.2px onto the ink. The
         * figure is measured off the render, not computed: reading Caveat's real
         * metrics needs the woff2 decompressed, and nothing here can do that.
         * Re-measure it if the size or the word changes.
         */
        className="new-circle -inset-x-2 -top-0.5 -bottom-2.5 pointer-events-none absolute"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
      >
        {/*
         * `pathLength="1"` is what keeps the dash pattern in the stylesheet as
         * plain numbers, the same trick the signature uses. Without it the dash
         * lengths would have to be measured in JS first, which would make this a
         * client component for no other reason.
         */}
        <path
          d={CIRCLE}
          pathLength="1"
          strokeWidth={1.4}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      New
    </span>
  );
}
