import type { Metadata } from "next";
import { CodeSpan } from "@/components/ui/code-span";
import { InlineLink } from "@/components/ui/inline-link";
import { PageShell } from "@/components/ui/page-shell";
import { PageTransition } from "@/components/ui/page-transition";
import { Reveal, RevealItem } from "@/components/ui/reveal";

export const metadata: Metadata = {
  title: "Not found",
  // a 404 must never be indexed: it would compete with the real pages for the
  // same terms and rank as a dead end
  robots: { index: false, follow: true },
};

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD  ·  404
 *
 * Read top-to-bottom. Each value is ms after mount.
 *
 *    0ms   nothing painted, Reveal holds every block hidden
 *  150ms   title and its line rise    (y 4 → 0)
 *  230ms   the routes paragraph       (stagger 80ms)
 *  310ms   the machine-readable line
 *  710ms   reveal settles, the page is whole
 *  710ms   "home" underline sweeps left → right (450ms)
 *  850ms   "work"                     (stagger 140ms)
 *  990ms   "blogs"
 * 1130ms   "lab"
 * 1270ms   "llms.txt"
 * 1410ms   "sitemap.xml"
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  /**
   * When Reveal's last child finishes. Derived from `components/ui/reveal.tsx`:
   * delayChildren 150 + (2 staggers x 80) + duration 400. Three RevealItems.
   *
   * Lower than the home page's 1030ms purely because this page has three blocks
   * to its seven. Add or remove a RevealItem and this moves with it.
   */
  revealSettled: 710,
  /** between each link's draw, left to right through the sentence */
  underlineStagger: 140,
};

/** nth underline to draw, in document order */
const drawAt = (n: number) =>
  TIMING.revealSettled + n * TIMING.underlineStagger;

/**
 * `align="center"` rather than `"top"`. A 404 has no content to scroll, so
 * anchoring it to the top would leave the viewport mostly empty below it.
 *
 * No back link. Every route worth reaching is named in the copy, so a bare
 * arrow to Home on top of that would be a fourth way to say the same thing.
 *
 * **The second paragraph is here for a reader that is not a person.** A 404 that
 * says only "this does not exist" is a dead end for anything that guessed a URL:
 * it has spent a request and has no way to learn that an index exists. The two
 * files named there are the recovery path, and the markdown half of the same
 * answer is `notFoundMarkdown` in `lib/markdown.ts`, which is what a request
 * asking for `text/markdown` gets at any unknown path.
 */
export default function NotFound() {
  return (
    <PageTransition>
      <PageShell>
        <Reveal className="flex flex-col gap-12">
          <RevealItem className="flex flex-col gap-2">
            <h1 className="text-lead text-text-primary">Page not found</h1>
            <p className="text-body text-text-secondary text-pretty">
              This one doesn&rsquo;t exist, or it moved.
            </p>
          </RevealItem>

          <RevealItem>
            <p className="text-body text-text-secondary text-pretty">
              Head back{" "}
              <InlineLink href="/" drawAt={drawAt(0)}>
                home
              </InlineLink>
              , or try my{" "}
              <InlineLink href="/work" drawAt={drawAt(1)}>
                work
              </InlineLink>
              ,{" "}
              <InlineLink href="/blogs" drawAt={drawAt(2)}>
                blogs
              </InlineLink>{" "}
              or{" "}
              <InlineLink href="/lab" drawAt={drawAt(3)}>
                lab
              </InlineLink>{" "}
              instead.
            </p>
          </RevealItem>

          <RevealItem>
            <p className="text-body text-text-secondary text-pretty">
              Reading rather than looking? Every page on the site is listed in{" "}
              {/*
               * `external` on a same-origin path, which is the one place that
               * prop is not about another origin. These are route handlers
               * rather than pages, so `next/link` would try to navigate to one
               * as if it were a route and fall back to a hard load. A plain
               * anchor is what a text file wants, and a new tab keeps the 404
               * behind it.
               */}
              <InlineLink href="/llms.txt" external drawAt={drawAt(4)}>
                llms.txt
              </InlineLink>{" "}
              and{" "}
              <InlineLink href="/sitemap.xml" external drawAt={drawAt(5)}>
                sitemap.xml
              </InlineLink>
              , and any page is served as markdown at its own path plus{" "}
              <CodeSpan>.md</CodeSpan>.
            </p>
          </RevealItem>
        </Reveal>
      </PageShell>
    </PageTransition>
  );
}
