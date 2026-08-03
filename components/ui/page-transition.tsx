import type React from "react";
import { ViewTransition } from "react";

/**
 * Crossfades one page into the next.
 *
 * Deliberately propless. A bare `<ViewTransition>` uses the browser's default
 * animation, which is a crossfade, so there is no CSS to keep in sync and
 * nothing depending on `::view-transition-old(.class)` selectors, which need
 * Chrome 125+ and diverge in Safari. Only the duration is tuned, in
 * `app/globals.css`, against `root`.
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
  return <ViewTransition>{children}</ViewTransition>;
}
