import type { Metadata } from "next";
import { Avatar } from "@/components/home/avatar";
import { SiteFooter } from "@/components/home/site-footer";
import { DiaText } from "@/components/ui/dia-text";
import { InlineLink } from "@/components/ui/inline-link";
import { JsonLd } from "@/components/ui/json-ld";
import { PageShell } from "@/components/ui/page-shell";
import { PageTransition } from "@/components/ui/page-transition";
import { Reveal, RevealItem } from "@/components/ui/reveal";
import { faviconFor } from "@/lib/favicons";
import { homeSchema } from "@/lib/schema";
import { paragraphs } from "@/lib/site";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
    /*
     * Announces the markdown variant, so a client that reads the page can find
     * it without being told the `.md` convention. The file itself carries
     * `x-robots-tag: noindex`, so this relationship only ever points one way.
     */
    types: { "text/markdown": "/index.md" },
  },
};

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD  ·  home
 *
 * Read top-to-bottom. Each value is ms after mount.
 *
 *    0ms   nothing painted, Reveal holds every block hidden
 *  150ms   avatar rises              (y 4 → 0, blur 6 → 0)
 *  230ms   lead paragraph            (stagger 80ms)
 *  230ms   colour band starts sweeping across "Sanyam" (1.2s)
 *  310ms   supporting paragraph
 *  390ms   what I have shipped
 *  470ms   closing note
 *  550ms   hairline rule
 *  630ms   footer starts
 * 1030ms   footer settles, the page is whole
 * 1030ms   "currently" underline sweeps left → right (450ms)
 * 1170ms   "write"                   (stagger 140ms)
 * 1310ms   "lab"
 *
 * The album cover behind the avatar is outside all of this. It arrives on a
 * network response, fades itself in, and then loops independently.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  /**
   * When Reveal's last child finishes. Derived from `components/ui/reveal.tsx`:
   * delayChildren 150 + (6 staggers x 80) + duration 400. Seven RevealItems.
   * If any of those three change, or a block is added, this moves with them.
   * Adding the avatar took it from 870 to 950, and the packages paragraph from
   * 950 to 1030.
   */
  revealSettled: 1030,
  /** between each link's draw, left to right down the paragraph */
  underlineStagger: 140,
  /**
   * When the name's colour sweep starts, in seconds. Matched to the moment the
   * lead paragraph begins fading in, `delayChildren 150 + 1 stagger`, because the
   * first frame of a sweep is fully transparent: start it any later and the name
   * is visibly missing from a paragraph that has already arrived.
   */
  nameSweepAt: 0.23,
};

/** nth underline to draw, in document order */
const drawAt = (n: number) =>
  TIMING.revealSettled + n * TIMING.underlineStagger;

/**
 * Which links sweep an underline, and in what order.
 *
 * Only the text shape of `InlineLink` has a rule to sweep. A link whose host
 * carries a mark paints as a pill instead, so it is skipped rather than spending
 * a slot, which is exactly what the hand-written `drawAt(0)`, `drawAt(1)` and
 * `drawAt(2)` used to encode by hand.
 *
 * Derived once at module scope from the same segments the page renders, so the
 * order cannot disagree with the order a reader sees. Adding a link to the copy
 * now shifts the ones after it on its own.
 */
const DRAW_ORDER = new Map<string, number>();
for (const paragraph of paragraphs) {
  for (const segment of paragraph.segments) {
    if (typeof segment === "string" || "name" in segment) continue;
    if (faviconFor(segment.href)) continue;
    DRAW_ORDER.set(segment.href, DRAW_ORDER.size);
  }
}

export default function Page() {
  return (
    <PageTransition>
      <PageShell>
        <JsonLd schema={homeSchema()} />

        {/* The visible lead is a paragraph, not a heading. Screen readers and
          crawlers still get a real h1, just not a 40-word one. */}
        <h1 className="sr-only">Sanyam Punia</h1>

        <Reveal className="flex flex-col gap-12">
          <RevealItem>
            <Avatar />
          </RevealItem>

          {/*
           * One block per paragraph, in the order `lib/site.ts` lists them. The
           * copy is not here: this page is the layout, and a paragraph of prose
           * with links threaded through it is also the one thing `/index.md`
           * needs, so it lives where both can read it.
           */}
          {paragraphs.map((paragraph) => (
            <RevealItem key={paragraph.id}>
              <p
                className={cn(
                  "text-body text-pretty",
                  paragraph.tone === "primary"
                    ? "text-text-primary"
                    : "text-text-secondary",
                )}
              >
                {paragraph.segments.map((segment) => {
                  if (typeof segment === "string") return segment;

                  if ("name" in segment) {
                    return (
                      <DiaText
                        key={segment.name}
                        delay={TIMING.nameSweepAt}
                        text={segment.name}
                      />
                    );
                  }

                  const draw = DRAW_ORDER.get(segment.href);

                  return (
                    <InlineLink
                      key={segment.href}
                      href={segment.href}
                      // derived rather than declared per call site, so an
                      // external link cannot be added without the rel guard
                      external={segment.href.startsWith("http")}
                      drawAt={draw === undefined ? undefined : drawAt(draw)}
                    >
                      {segment.text}
                    </InlineLink>
                  );
                })}
              </p>
            </RevealItem>
          ))}

          <RevealItem>
            <hr className="border-stroke" />
          </RevealItem>

          <RevealItem>
            <SiteFooter />
          </RevealItem>
        </Reveal>
      </PageShell>
    </PageTransition>
  );
}
