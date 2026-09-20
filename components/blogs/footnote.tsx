"use client";

import { ArrowUUpLeftIcon } from "@phosphor-icons/react";
import type React from "react";
import { isPlainClick, scrollToHeading } from "@/lib/scroll";

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
 */

function ride(event: React.MouseEvent<HTMLAnchorElement>, href: string): void {
  if (!isPlainClick(event)) return;
  if (!href.startsWith("#")) return;
  if (scrollToHeading(href.slice(1))) event.preventDefault();
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
 * No padding either. Two pixels of it is nothing on a button and is a visible
 * space in front of a numeral set at 0.7em.
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
      className="scroll-mt-16 rounded-xs align-baseline text-[0.7em] text-text-secondary leading-none transition-colors duration-200 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2"
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
      onClick={(event) => ride(event, href)}
      className="ml-1 inline-flex size-4 items-center justify-center align-middle rounded-sm text-text-muted transition-colors duration-200 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 focus-visible:ring-offset-2"
    >
      <ArrowUUpLeftIcon aria-hidden="true" className="size-3 shrink-0" />
    </a>
  );
}
