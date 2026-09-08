import type React from "react";
import { ViewTransition } from "react";

/**
 * Crossfades one page into the next.
 *
 * Nearly propless. A bare `<ViewTransition>` uses the browser's default
 * animation, which is a crossfade, so there is no CSS to keep in sync and
 * nothing depending on `::view-transition-old(.class)` selectors, which need
 * Chrome 125+ and diverge in Safari. Only the duration is tuned, in
 * `app/globals.css`, against `root`.
 *
 * `update="none"` is the one prop, and it was a bug. React animates this
 * boundary for every non-urgent commit inside it, which is any state update
 * that did not come straight from a discrete event: a timer, an animation's
 * completion callback, a frame loop. The flip clock ticks once a second, and
 * every tick ran a 300ms view transition that nobody could see, since the old
 * and new pages were identical, and that ate every pointer event for its
 * duration: the document's snapshot sits over the live DOM and hit testing
 * lands on the root. Measured: 36 of 133 frames with nothing under the
 * pointer, and 5 of 16 presses lost. The halftone ripple's like did the same
 * after its ripple ended. Navigations mount and unmount this boundary, so
 * `enter` and `exit` still crossfade the pages, and `update` has nothing left
 * to do.
 *
 * This wraps each page's content rather than the root layout's children. A
 * layout's children slot keeps its position in the tree across a navigation,
 * so React reconciles it as an update rather than an unmount and a mount.
 *
 * Directional slides keyed off `transitionTypes` were built here first and
 * pulled back out: a bigger effect than this page needs, for the cost of a
 * class-selector dependency.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return <ViewTransition update="none">{children}</ViewTransition>;
}
