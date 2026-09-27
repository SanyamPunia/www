"use client";

import { CaretDownIcon } from "@phosphor-icons/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { highlight } from "sugar-high";
import { CopyMark } from "@/components/ui/copy-mark";
import { cn } from "@/lib/utils";

/**
 * A fenced code block with copy-to-clipboard.
 *
 * `sugar-high` returns HTML with `sh__*` class names, which the `--sh-*`
 * custom properties in `app/globals.css` colour. Those are greys, not a
 * rainbow theme, so code sits inside the page's monochrome rather than
 * fighting it.
 *
 * **A long block starts as a teaser.** Past `COLLAPSED` it is clipped, fades
 * into its own `surface` ground and carries a "Show more" pill, and the whole
 * faded strip is the button that opens it. A block only a little taller than
 * that stays open, since hiding two lines behind a click costs more than it
 * saves: `SLACK` is the margin. The height is measured once, because the
 * `pre` scrolls sideways rather than wrapping, so its height does not depend
 * on the column's width. Copy always copies the whole snippet.
 */

/** The teaser's height in px, about eleven lines at `text-meta`. */
const COLLAPSED = 240;

/** How much taller than the teaser a block must be before it collapses. */
const SLACK = 80;

export function CodeBlock({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);
  const [full, setFull] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pre = useRef<HTMLPreElement>(null);

  useEffect(() => {
    return () => {
      if (timeout.current) clearTimeout(timeout.current);
    };
  }, []);

  /* before paint, so a long block never flashes open and snaps shut */
  useLayoutEffect(() => {
    if (pre.current) setFull(pre.current.scrollHeight);
  }, []);

  const collapsible = full !== null && full > COLLAPSED + SLACK;
  const clipped = collapsible && !open;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      if (timeout.current) clearTimeout(timeout.current);
      timeout.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard can be blocked by permissions, nothing to recover
    }
  };

  return (
    <div className="group relative my-6">
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Copied" : "Copy code"}
        className="absolute top-3 right-4 z-10 inline-flex size-6 cursor-pointer select-none items-center justify-center rounded-md bg-bg text-text-muted opacity-0 ring-1 ring-stroke ring-inset transition-all duration-200 hover:text-text-primary focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 group-hover:opacity-100"
      >
        {/* a quick fade and scale, see `CopyMark`. `HeadingAnchor` renders the
            same component, so the two copy controls behave identically */}
        <CopyMark mark="copy" copied={copied} />
      </button>

      <pre
        ref={pre}
        className={cn(
          /* the edge is `shadow-frame`, drawn outside the box, so clipped
             code can never paint across it the way it did over an inset ring.
             The scrollbar's track is inset from both ends, so a sideways scroll
             never runs into the rounded corners */
          "overflow-x-auto rounded-lg bg-surface p-4 shadow-frame [&::-webkit-scrollbar-track]:[margin-inline:0.8rem]",
          collapsible &&
            "motion-safe:transition-[max-height] motion-safe:duration-200 motion-safe:ease-[cubic-bezier(0.23,1,0.32,1)]",
          /* never a vertical scrollbar: open, the max-height is the measured
             scrollHeight, which rounds a fraction of a pixel short and would
             otherwise add one down the block's edge */
          collapsible && "overflow-y-hidden",
          /* collapsed, nothing scrolls: the teaser is a preview, and a
             horizontal scrollbar under the fade peeked out at the bottom
             corner */
          clipped && "overflow-x-hidden",
        )}
        style={
          collapsible
            ? { maxHeight: open ? (full ?? undefined) : COLLAPSED }
            : undefined
        }
      >
        <code
          className="font-mono text-meta leading-relaxed"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: sugar-high returns highlighted HTML, and the input is our own MDX source, never user content
          dangerouslySetInnerHTML={{ __html: highlight(children) }}
        />
      </pre>

      {clipped ? (
        /* the faded strip is the button, and it runs to the block's edge,
           inside the shadow that draws that edge */
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={false}
          className="group/more absolute inset-x-0 bottom-0 flex h-28 cursor-pointer select-none items-end justify-center rounded-b-lg bg-linear-to-b from-transparent via-surface/90 via-60% to-surface pb-3 focus-visible:outline-none"
        >
          <span className="inline-flex items-center gap-1 rounded-full bg-bg px-3 py-1 text-action text-text-secondary ring-1 ring-stroke transition-colors duration-150 group-hover/more:text-text-primary group-focus-visible/more:ring-2 group-focus-visible/more:ring-text-primary/15 group-active/more:bg-fill">
            Show more
            <CaretDownIcon aria-hidden="true" className="size-3" />
          </span>
        </button>
      ) : null}
    </div>
  );
}
