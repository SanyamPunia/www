import type { Metadata } from "next";
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
 *    0ms   nothing painted, Reveal holds both blocks hidden
 *  150ms   title and its line rise    (y 4 → 0, blur 6 → 0)
 *  230ms   the routes paragraph       (stagger 80ms)
 *  630ms   reveal settles, the page is whole
 *  630ms   "home" underline sweeps left → right (450ms)
 *  770ms   "work"                     (stagger 140ms)
 *  910ms   "blogs"
 * 1050ms   "lab"
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  /**
   * When Reveal's last child finishes. Derived from `components/ui/reveal.tsx`:
   * delayChildren 150 + (1 stagger x 80) + duration 400. Two RevealItems.
   *
   * Lower than the home page's 870ms purely because this page has two blocks
   * to its five. Add or remove a RevealItem and this moves with it.
   */
  revealSettled: 630,
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
        </Reveal>
      </PageShell>
    </PageTransition>
  );
}
