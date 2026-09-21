"use client";

import { useEffect, useRef, useState } from "react";
import { highlight } from "sugar-high";
import { CopyMark } from "@/components/ui/copy-mark";

/**
 * A fenced code block with copy-to-clipboard.
 *
 * `sugar-high` returns HTML with `sh__*` class names, which the `--sh-*`
 * custom properties in `app/globals.css` colour. Those are greys, not a
 * rainbow theme, so code sits inside the page's monochrome rather than
 * fighting it.
 */
export function CodeBlock({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeout.current) clearTimeout(timeout.current);
    };
  }, []);

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
        className="absolute top-2 right-2 z-10 inline-flex size-6 cursor-pointer items-center justify-center rounded-md bg-bg text-text-muted opacity-0 ring-1 ring-stroke ring-inset transition-all duration-200 hover:text-text-primary focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 group-hover:opacity-100"
      >
        {/*
         * A morph rather than a crossfade, and `CopyMark` carries the reason.
         * `HeadingAnchor` renders the same component, so the two copy controls
         * on a post still behave identically.
         */}
        <CopyMark mark="copy" copied={copied} />
      </button>

      <pre className="overflow-x-auto rounded-lg bg-surface p-4 ring-1 ring-stroke ring-inset">
        <code
          className="font-mono text-meta leading-relaxed"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: sugar-high returns highlighted HTML, and the input is our own MDX source, never user content
          dangerouslySetInnerHTML={{ __html: highlight(children) }}
        />
      </pre>
    </div>
  );
}
