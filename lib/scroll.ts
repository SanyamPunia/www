/**
 * Smooth scrolling to a heading, for the two controls that link to one.
 *
 * `HeadingAnchor` and `PostRail` both point at `#id`, so both have to do this or
 * a post scrolls two different ways depending on which control was used.
 *
 * The native jump was correct and instant, which is the problem: a reader who
 * clicks a section has no idea whether the page moved a little or a long way, and
 * lands with no sense of where they came from.
 */

/**
 * Whether this click is the browser's business rather than ours.
 *
 * A modified click is asking for a new tab or window, and a non-primary button is
 * asking for the context menu or a background tab. Those have to reach the real
 * `href`, which is most of why these controls are anchors and not buttons.
 */
export function isPlainClick(event: {
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  button: number;
}): boolean {
  return (
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    event.button === 0
  );
}

/**
 * Scroll a heading to where its own `scroll-mt` says it belongs, and put the hash
 * in the address bar.
 *
 * Returns false when it could not do the job, so a caller can leave the event
 * alone and let the browser navigate the way it always did.
 *
 * **`scrollTo` on the window, never `scrollIntoView` on the element.** The
 * element's own method walks up and scrolls every ancestor that can scroll, which
 * is how a fixed rail or a padded shell ends up shifted sideways. The offset is
 * computed here instead and applied to the one scroller that should move.
 *
 * The inset is read off the heading's computed `scroll-margin-top` rather than
 * restated, so it cannot drift from the `scroll-mt-16` in `mdx-components.tsx`.
 * Landing a heading flush against the viewport's top edge is what that class
 * exists to prevent, and a hand-rolled scroll has to honour it the way the native
 * jump did.
 */
export function scrollToHeading(id: string): boolean {
  const heading = document.getElementById(id);
  if (!heading) return false;

  const inset =
    Number.parseFloat(getComputedStyle(heading).scrollMarginTop) || 0;
  const top = heading.getBoundingClientRect().top + window.scrollY - inset;

  window.scrollTo({
    top,
    /*
     * Read here rather than trusting the browser to apply the preference to
     * `smooth` on its own, which they do not all do. `MotionProvider` cannot
     * cover this either: it governs motion components, not a scroll.
     */
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
  });

  /*
   * The address bar still has to change, since a link to a section that does not
   * leave you with that link is only half a control.
   *
   * `pushState` rather than assigning `location.hash`, which would trigger the
   * native jump on top of the smooth scroll and land twice. Focus order is
   * unaffected: these controls sit inside the heading they point at, so tabbing
   * on continues from the right place without the fragment's help.
   */
  window.history.pushState(null, "", `#${id}`);
  return true;
}
