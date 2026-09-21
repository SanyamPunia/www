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

/**
 * How long a landing stays marked, in milliseconds.
 *
 * It has to outlast the glide, since a mark that expires mid-travel is one
 * nobody sees. A smooth scroll across a post runs a few hundred milliseconds,
 * so this is that plus about a second of standing still.
 */
const ARRIVAL_MS = 1600;

let arrived: HTMLElement | null = null;
let clearing: number | undefined;

/**
 * Mark the element a scroll just landed on, for long enough to be read.
 *
 * A footnote's marker is a numeral at 0.7em in the middle of a paragraph, so
 * coming back to it lands the reader on a word they cannot pick out: the
 * control they pressed is at the foot of the page and the thing it pointed at
 * says nothing about itself. This is the same shape as `HeadingAnchor`'s tick,
 * where the control scrolls itself out from under the pointer and the
 * confirmation has to be held rather than tied to a hover.
 *
 * **Written to the node, never held in React state.** Nothing on the page has
 * to render for a numeral to change colour, and the element being marked is a
 * sibling rendered from MDX rather than a child of the control that was
 * pressed, so no component is holding the answer to begin with.
 *
 * One at a time. A second press before the first has expired clears the old
 * mark rather than leaving two on the page, which would say the reader is in
 * two places.
 */
export function markArrival(id: string): void {
  const node = document.getElementById(id);
  if (!node) return;

  arrived?.removeAttribute("data-arrived");
  window.clearTimeout(clearing);

  arrived = node;
  node.dataset.arrived = "true";

  clearing = window.setTimeout(() => {
    node.removeAttribute("data-arrived");
    if (arrived === node) arrived = null;
  }, ARRIVAL_MS);
}
