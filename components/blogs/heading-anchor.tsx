"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import { CopyMark } from "@/components/ui/copy-mark";
import { Tooltip } from "@/components/ui/tooltip";
import { isPlainClick, scrollToHeading } from "@/lib/scroll";
import { cn } from "@/lib/utils";

/**
 * A link to one section, on every heading the rail lists.
 *
 * Someone who wants to point a person at one section rather than at the whole
 * post needs the URL for it. The ids already exist, since `rehype-slug` writes
 * them and `PostRail` links to them, so the only thing missing was a way to get
 * one out of the page without opening devtools.
 *
 * A real `<a href="#id">`, not a button. That is what puts the section in the
 * address bar, and it is what lets the link be opened in a new tab or copied
 * through the browser's own menu. The clipboard write is added on top rather than
 * replacing any of it, so the control does the obvious thing however it is used.
 *
 * A plain click is the one case that does not use the native jump. It scrolls
 * smoothly instead, through `scrollToHeading`, which also writes the hash. Every
 * modified click still falls through to the real `href`, which is the half of
 * being an anchor that matters.
 *
 * A drawn hash, never a literal `#` character. The two make the same shape and
 * only one of them is an icon: a text character inherits the prose font and
 * cannot be sized off the icon scale. It came off Phosphor's when the swap to
 * the tick became a morph, since a morph needs two paths built the same way and
 * no two library icons are. See `CopyMark`.
 *
 * Hidden until the heading is hovered, because a permanent marker on every
 * heading is a lot of chrome for a control most readers never want. The space
 * is reserved either way, so revealing it never shifts the rule beside it.
 */
export function HeadingAnchor({ id }: { id: string }): React.ReactNode {
  const [copied, setCopied] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // a copy immediately before a navigation would otherwise leave a timer
  // pointing at a component that has gone
  useEffect(() => {
    return () => {
      if (timeout.current) clearTimeout(timeout.current);
    };
  }, []);

  const copy = async () => {
    // built from origin and pathname rather than read off `location.href`,
    // which may already carry someone else's hash from an earlier click
    const url = `${window.location.origin}${window.location.pathname}#${id}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // clipboard can be blocked by permissions or an insecure context. The
      // link still navigates and the address bar still updates, so the reader
      // has the URL either way.
      return;
    }
    setCopied(true);
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Tooltip label="Copy link to section">
      <a
        href={`#${id}`}
        onClick={(event) => {
          void copy();
          // a modified click wants a new tab, so it has to reach the real href
          if (isPlainClick(event) && scrollToHeading(id))
            event.preventDefault();
        }}
        aria-label={copied ? "Link copied" : "Copy link to this section"}
        className={cn(
          "inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-text-muted transition-all duration-200 hover:bg-fill hover:text-text-primary focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 group-hover:opacity-100",
          /*
           * Held visible while copied, and that is what makes the tick
           * readable at all. This control scrolls the heading it sits on, so
           * the pointer is left behind and the hover ends in the same frame
           * the tick appears. Tied to `group-hover` alone it would swap to a
           * tick and hide simultaneously, which is indistinguishable from no
           * feedback. It is the only state allowed to override the hover.
           */
          copied ? "text-text-primary opacity-100" : "opacity-0",
        )}
      >
        {/*
         * A morph, the same treatment `CodeBlock`'s copy button uses, so the
         * two copy controls on a post behave identically. The hash is drawn in
         * `CopyMark` rather than imported, since Phosphor's own hash and check
         * share no structure and so cannot interpolate.
         */}
        <CopyMark mark="hash" copied={copied} />
      </a>
    </Tooltip>
  );
}
