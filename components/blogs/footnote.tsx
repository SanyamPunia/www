"use client";

import { ArrowUUpLeftIcon } from "@phosphor-icons/react";
import type React from "react";
import { isPlainClick, markArrival, scrollToHeading } from "@/lib/scroll";

/**
 * The two ends of a footnote, both of them real anchors.
 *
 * A note is worth having only if leaving the line and coming back are both
 * cheap, which is why this is a round trip rather than a one-way link: the
 * marker takes you down and the backref takes you to the exact word you left.
 *
 * **Both scroll the way every other in-page link on a post scrolls**, through
 * `scrollToHeading`. `HeadingAnchor` and `PostRail` already document the reason:
 * a page that jumps for one control and glides for another is a page whose
 * reader cannot tell how far they moved. A footnote is the shortest of those
 * trips and the one where losing your place costs the most.
 *
 * Every modified click still falls through to the real `href`, which is most of
 * why these are anchors at all.
 *
 * Returns whether it took the click, since the way up has one more thing to do
 * with it than the way down.
 */

function ride(
  event: React.MouseEvent<HTMLAnchorElement>,
  href: string,
): boolean {
  if (!isPlainClick(event)) return false;
  if (!href.startsWith("#")) return false;
  if (!scrollToHeading(href.slice(1))) return false;

  event.preventDefault();
  return true;
}

/**
 * The marker in the running line.
 *
 * **It takes the prose's own tone, not the muted one.** A marker is part of the
 * sentence it sits in rather than a note about it, and at this size a numeral in
 * `text-muted` on a `text-secondary` line is a smudge: the reader cannot tell a
 * footnote from a rendering artefact without leaning in.
 *
 * **The size is here and the rise is on the `sup`, and splitting them is the
 * whole fix.** `vertical-align: super` raises a box by a share of its parent's
 * font size and it is far more than a footnote wants: measured on a 14.4px line,
 * it put the numeral's baseline 11px above the line's own, which is up level with
 * the cap height of the line above. The marker read as having come loose from the
 * word it belongs to. See the `sup` entry in `mdx-components.tsx` for the
 * replacement.
 *
 * **The padding is cancelled by a negative margin, and both halves exist for the
 * mark below.** A wash on a bare numeral is a 4.8px patch, which is not a thing
 * a reader can find in a paragraph: it needs a pill's worth of ground around the
 * digit. Padding alone buys that and pushes the rest of the line along with it,
 * which is the visible space in front of the numeral this note used to forbid.
 * Cancelling it leaves the line set exactly where it was and paints the pill
 * over the space either side instead.
 *
 * **0.15em is as far as it may reach, and the thin space in front of the marker
 * is what sets that.** The marker's em is 0.7 of the prose's, so 0.15em here is
 * 1.51px against the 1.73px `ml-[0.12em]` on the `sup`: the pill stops inside
 * that gap and cannot touch the word it marks. Measured on a 14.4px line: the
 * pill is 7.80 by 14.41px where the digit alone is 4.80 by 12.00, and the first
 * glyph after the marker sits at the same x with the padding and without it.
 *
 * **`data-arrived` is where the backref lands**, written to the node by
 * `markArrival` and cleared 1.6s later. It takes the filled emphatic neutral,
 * which is this site's way of saying "this one" in a set with no accent colour,
 * the same call `the-submenu-closes-before-you-get-there` makes for a right
 * answer. A grey wash cannot do it at this size: `fill-active` is 1.34:1 on the
 * page, which reads across a row and is nothing across 8px. The step in is what
 * the reader arrives to and the step out is the 200ms the transition already
 * carries. Nothing scales, per the site's own override, and this is the case
 * that override is written for: an inline numeral sits wherever text layout puts
 * it, so 2% of it is sub-pixel.
 *
 * It carries its own `scroll-mt` so the word it marks lands clear of the
 * viewport's top edge when the backref comes back to it, the same inset a
 * heading gets.
 */
export function FootnoteRef({
  href = "",
  children,
  ...props
}: React.ComponentPropsWithoutRef<"a">): React.ReactNode {
  return (
    <a
      {...props}
      href={href}
      onClick={(event) => ride(event, href)}
      className="-mx-[0.15em] scroll-mt-16 rounded-sm px-[0.15em] py-[0.12em] align-baseline text-[0.7em] text-text-secondary leading-none transition-colors duration-200 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2 data-[arrived=true]:bg-text-primary data-[arrived=true]:text-bg"
    >
      {children}
    </a>
  );
}

/**
 * The way back up.
 *
 * An icon, never the `↩︎` the plugin writes by default. That character is a
 * glyph standing in for an icon, which the project bans outright, and it
 * inherits the prose font rather than sitting on the icon scale.
 *
 * **It marks where it lands and the marker does not, which is the one place the
 * round trip is not symmetric.** Going down puts the reader at the top of a
 * short labelled list, where the row under the viewport's edge is the row they
 * asked for. Coming back puts them in the middle of a paragraph, and the thing
 * they are looking for is a numeral at 0.7em. Only one of those two landings
 * needs anything said about it. See `markArrival`.
 *
 * **`align-middle`, and never a `translate-y` nudge.** An inline-flex holding
 * no text has no baseline of its own, so the browser puts its bottom margin
 * edge on the line's baseline and the whole icon hangs below the text.
 * Measured: the arrow's centre sat 3.6px under the centre of the words beside
 * it, and the nudge that was there had been pushing it further down. `middle`
 * lines the box's own centre up with the line's x-height centre, which is what
 * the eye is matching.
 */
export function FootnoteBackref({
  href = "",
  ...props
}: React.ComponentPropsWithoutRef<"a">): React.ReactNode {
  return (
    <a
      {...props}
      href={href}
      onClick={(event) => {
        if (ride(event, href)) markArrival(href.slice(1));
      }}
      className="ml-1 inline-flex size-4 items-center justify-center align-middle rounded-sm text-text-muted transition-colors duration-200 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2"
    >
      <ArrowUUpLeftIcon aria-hidden="true" className="size-3 shrink-0" />
    </a>
  );
}
