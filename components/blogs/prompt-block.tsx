"use client";

import { useEffect, useRef, useState } from "react";
import { TextMorph } from "torph/react";
import { CopyMark } from "@/components/ui/copy-mark";

/**
 * A prompt the reader is meant to paste into their own coding agent, written
 * in a post as a ```prompt fence.
 *
 * It is not a `CodeBlock`. That runs `sugar-high` over its text, which colours
 * words like "for" and "if" in prose as keywords, and it hides its copy control
 * until hover. Here copying is the whole point, so the control is always
 * visible and says what it does.
 *
 * The text wraps rather than scrolling sideways, since a prompt is prose. It
 * sits in a `pre`, which keeps its casing: the stylesheet's lowercase exempts
 * `pre`, and a prompt pasted somewhere else should read as it was written.
 */
export function PromptBlock({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeout.current) clearTimeout(timeout.current);
    };
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(children.trim());
      setCopied(true);
      if (timeout.current) clearTimeout(timeout.current);
      timeout.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard can be blocked by permissions, nothing to recover
    }
  };

  return (
    <div className="my-6 overflow-hidden rounded-lg bg-surface shadow-frame">
      <div className="flex items-center justify-between gap-3 border-stroke border-b py-2 pr-2 pl-4">
        <span className="text-meta text-text-muted">Prompt</span>
        <button
          type="button"
          onClick={copy}
          className="flex cursor-pointer select-none items-center gap-1.5 rounded-full px-2.5 py-1 text-action text-text-secondary transition-colors duration-150 hover:bg-fill hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15 active:bg-fill-hover"
        >
          <CopyMark mark="copy" copied={copied} />
          <span aria-hidden="true">
            <TextMorph duration={160} ease="cubic-bezier(0.32, 0.72, 0, 1)">
              {copied ? "Copied" : "Copy prompt"}
            </TextMorph>
          </span>
          <span className="sr-only">Copy prompt</span>
        </button>
      </div>
      <pre className="whitespace-pre-wrap p-4 font-mono text-meta text-text-secondary leading-relaxed">
        {children.trim()}
      </pre>
      <span aria-live="polite" className="sr-only">
        {copied ? "Prompt copied" : ""}
      </span>
    </div>
  );
}
