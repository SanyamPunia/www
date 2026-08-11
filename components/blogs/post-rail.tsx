"use client";

import { motion } from "motion/react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { BackLink } from "@/components/ui/back-link";
import { CONTENT_HALF_REM } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * The post's left rail: the way back to the index, then its own sections with
 * the one being read marked.
 *
 * A post runs long enough that its structure stops being visible once the
 * first screen has scrolled away, and there is no header or footer chrome here
 * to carry it. This is the only thing on screen that can say how far in you
 * are.
 *
 * The back link lives here rather than above the title because both are chrome
 * about the page rather than content in it, and stacking them put a control
 * between the reader and the first line. Below `lg` the rail is gone, so the
 * column carries its own copy and this one is the only one on screen at any
 * width.
 *
 * It reads the headings out of the rendered `article` rather than parsing the
 * MDX, so the list and the anchors cannot disagree: `rehype-slug` writes the
 * ids, and these are those exact elements. Parsing the source would mean
 * reimplementing the same slug algorithm and hoping the two stay in step, and
 * a mismatch there is a dead link rather than a build error.
 *
 * The cost is that the rail arrives on mount instead of in the HTML. It is
 * `fixed`, so nothing moves when it does, and it fades rather than appearing.
 */

/**
 * One run of a heading's text, and whether the heading set it as code.
 *
 * A row is a list of these rather than a plain string because several headings
 * name a file or an identifier, and flattening `configure _app.tsx` to text
 * loses the one thing that says which half is a filename. The rail indexes the
 * headings, so it has to read like them.
 */
interface Token {
  readonly text: string;
  readonly code: boolean;
}

interface Entry {
  readonly id: string;
  readonly tokens: readonly Token[];
  /** 2 or 3. A subsection is indented, nothing else changes. */
  readonly depth: number;
}

/**
 * Where the reading line rests. Above the heading's own `scroll-mt`, so a
 * heading jumped to from this list lands under the line and marks itself.
 */
const THRESHOLD = 80;

/**
 * The reading line in viewport coordinates, which is not a constant.
 *
 * It rests at `THRESHOLD` for all but the last screenful, then sweeps down to
 * the foot of the viewport. That is not a flourish, it is what makes the final
 * headings reachable at all: `MorePosts` sits below the article and is shorter
 * than a viewport, so the scroll runs out before the last section can climb to
 * the line. Measured on the current posts, three of four never get their last
 * heading above 80px and one never gets its last two, so a fixed line leaves
 * rows in this list that can never mark themselves.
 *
 * A "snap to the last entry once you hit the bottom" rule is the usual patch
 * and it does not fix it: it skips whatever sat between. Sweeping the line
 * gives every remaining heading its own stretch of scroll, in order.
 */
/**
 * A heading's children split into plain runs and code runs.
 *
 * One level deep, which is all a heading ever is: prose with the odd `code`
 * span in it. Anything else contributes its text and nothing more.
 */
function tokenise(title: Element): Token[] {
  return Array.from(title.childNodes, (node) => ({
    text: node.textContent ?? "",
    code: node.nodeName === "CODE",
  })).filter((token) => token.text !== "");
}

function readingLine(scrollable: number): number {
  if (scrollable <= 0) return THRESHOLD;
  const remaining = scrollable - window.scrollY;
  if (remaining >= window.innerHeight) return THRESHOLD;
  return THRESHOLD + window.innerHeight - remaining;
}

export function PostRail(): React.ReactNode {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [active, setActive] = useState(0);
  const [bar, setBar] = useState<{ top: number; height: number } | null>(null);
  const links = useRef<(HTMLAnchorElement | null)[]>([]);

  // one `article` per post, rendered by `BlogPost`. `MorePosts` sits outside
  // it, so its headings cannot end up in here.
  useEffect(() => {
    const headings = document.querySelectorAll<HTMLHeadingElement>(
      "article :is(h2, h3)[id]",
    );
    setEntries(
      Array.from(headings, (el) => ({
        id: el.id,
        // the first element child is the heading's title span. Reading that
        // rather than the heading itself is what leaves out the copy anchor
        // and the leader rule, neither of which belongs in a list of titles.
        tokens: tokenise(el.firstElementChild ?? el),
        depth: el.tagName === "H3" ? 3 : 2,
      })),
    );
  }, []);

  /*
   * Which heading is the last one above the reading line. That is true of
   * exactly one heading at every scroll position, including the first frame,
   * which is what an IntersectionObserver cannot answer: it only ever knows a
   * heading is currently crossing a band, so nothing is marked on load and a
   * jump past the band leaves the marker behind.
   *
   * One `getBoundingClientRect` per heading per frame at most, rAF-throttled,
   * and a post has a handful of headings.
   */
  useEffect(() => {
    if (entries.length === 0) return;

    let frame = 0;

    const measure = () => {
      const line = readingLine(
        document.documentElement.scrollHeight - window.innerHeight,
      );

      let next = 0;
      entries.forEach((entry, i) => {
        const el = document.getElementById(entry.id);
        if (el && el.getBoundingClientRect().top <= line) next = i;
      });
      setActive(next);
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [entries]);

  // measured off the real link rather than assuming a row height, since a
  // heading that wraps to two lines is taller than one that does not.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `entries` is the trigger, not a read. The first pass runs before any link exists, and `active` is already 0 when they arrive, so without it nothing re-measures and the bar never appears.
  useEffect(() => {
    const el = links.current[active];
    if (el) setBar({ top: el.offsetTop, height: el.offsetHeight });
  }, [active, entries]);

  return (
    <motion.aside
      // fixed in the margin rather than a flex sibling: as a sibling it would
      // take its width out of the row and push the column off centre, so the
      // post would no longer sit where every other page's does.
      //
      // 14rem of clearance for a 12rem rail leaves a 2rem gutter to the column,
      // and at exactly `lg` the rail's left edge lands on the page's own `px-6`
      // gutter. Any wider and it runs off the screen at that width.
      //
      // `pb-1` is not spacing, it is what keeps the scrollbar away. `BackLink`
      // draws its underline as an `after:` pseudo-element at `-0.1em`, which
      // paints below the anchor's own box, so on a post with no sections the
      // rail's content was one pixel taller than the rail. `overflow-y-auto`
      // does not care that it is one pixel: it showed a 6px thumb down the
      // right-hand edge, beside a single link with nothing to scroll.
      className="fixed top-20 hidden max-h-[calc(100dvh-8rem)] w-60 overflow-y-auto pb-1 lg:block"
      style={{ left: `calc(50% - ${CONTENT_HALF_REM}rem - 14rem)` }}
      // the page's own entrance, not the `Reveal` one: this cannot join that
      // stagger, since its sections do not exist until the headings have
      // rendered and the sequence has already started. The delay matches
      // `delayChildren`, so it lands with the first block of the column.
      initial={{ opacity: 0, y: 4, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.4, delay: 0.15, ease: "easeOut" }}
    >
      <div className="flex flex-col gap-8">
        <BackLink href="/blogs">Blogs</BackLink>

        {/* one entry is not a table of contents, it is a heading already on
            screen. The rail still renders, because the back link is not
            conditional on a post having sections. */}
        {entries.length < 2 ? null : (
          <nav aria-label="On this page" className="flex flex-col gap-1">
            <span className="mb-1 text-meta text-text-muted">On this page</span>

            <div className="relative flex flex-col border-stroke border-l">
              {/*
               * One bar that travels, rather than a border toggling on each row.
               * The rows are steps and the reading is not, so the marker moves
               * between them continuously. `top` and `height` both transition, so
               * it stretches into a taller entry instead of snapping.
               */}
              {bar ? (
                <span
                  aria-hidden="true"
                  className="-left-px absolute w-px bg-text-primary transition-all duration-150 ease-out motion-reduce:transition-none"
                  style={{ top: bar.top, height: bar.height }}
                />
              ) : null}

              {entries.map((entry, i) => (
                <a
                  key={entry.id}
                  ref={(el) => {
                    links.current[i] = el;
                  }}
                  href={`#${entry.id}`}
                  aria-current={active === i ? "location" : undefined}
                  className={cn(
                    "cursor-pointer py-1 pl-3 text-meta transition-colors duration-200 hover:text-text-primary focus-visible:rounded-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15",
                    entry.depth === 3 && "pl-6",
                    active === i ? "text-text-primary" : "text-text-muted",
                  )}
                >
                  {entry.tokens.map((token) =>
                    token.code ? (
                      // no tone of its own, so it follows the row between muted
                      // and primary instead of pinning itself to one of them
                      <code
                        key={`${entry.id}-${token.text}`}
                        className="rounded-xs bg-fill px-1 font-mono text-[0.9em]"
                      >
                        {token.text}
                      </code>
                    ) : (
                      token.text
                    ),
                  )}
                </a>
              ))}
            </div>
          </nav>
        )}
      </div>
    </motion.aside>
  );
}
