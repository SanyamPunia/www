import type { Metadata } from "next";
import { Avatar } from "@/components/home/avatar";
import { SiteFooter } from "@/components/home/site-footer";
import { InlineLink } from "@/components/ui/inline-link";
import { JsonLd } from "@/components/ui/json-ld";
import { PageShell } from "@/components/ui/page-shell";
import { PageTransition } from "@/components/ui/page-transition";
import { Reveal, RevealItem } from "@/components/ui/reveal";
import { homeSchema } from "@/lib/schema";
import { links, socials } from "@/lib/site";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD  ·  home
 *
 * Read top-to-bottom. Each value is ms after mount.
 *
 *    0ms   nothing painted, Reveal holds every block hidden
 *  150ms   avatar rises              (y 4 → 0, blur 6 → 0)
 *  230ms   lead paragraph            (stagger 80ms)
 *  310ms   supporting paragraph
 *  390ms   closing note
 *  470ms   hairline rule
 *  550ms   footer starts
 *  950ms   footer settles, the page is whole
 *  950ms   "currently" underline sweeps left → right (450ms)
 * 1090ms   "write"                   (stagger 140ms)
 * 1230ms   "lab"
 *
 * The album cover behind the avatar is outside all of this. It arrives on a
 * network response, fades itself in, and then loops independently.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  /**
   * When Reveal's last child finishes. Derived from `components/ui/reveal.tsx`:
   * delayChildren 150 + (5 staggers x 80) + duration 400. Six RevealItems.
   * If any of those three change, or a block is added, this moves with them.
   * Adding the avatar took it from 870 to 950.
   */
  revealSettled: 950,
  /** between each link's draw, left to right down the paragraph */
  underlineStagger: 140,
};

/** nth underline to draw, in document order */
const drawAt = (n: number) =>
  TIMING.revealSettled + n * TIMING.underlineStagger;

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

          <RevealItem>
            <p className="text-body text-text-primary text-pretty">
              I&rsquo;m Sanyam, a full-stack developer based in India. I believe
              simplicity is what makes a great user experience, and that clean
              design paired with efficient code is what actually makes the
              difference.
            </p>
          </RevealItem>

          <RevealItem>
            <p className="text-body text-text-secondary text-pretty">
              <InlineLink href="/work" drawAt={drawAt(0)}>
                Currently
              </InlineLink>{" "}
              a frontend engineer at{" "}
              <InlineLink href={links.oliv} external>
                Oliv AI
              </InlineLink>
              , building AI-powered sales intelligence. Before that I built a
              real-time trading terminal at{" "}
              <InlineLink href={links.enclave} external>
                Enclave
              </InlineLink>
              , and led engineering as founding engineer at{" "}
              <InlineLink href={links.bitscale} external>
                Bitscale
              </InlineLink>
              . I{" "}
              <InlineLink href="/blogs" drawAt={drawAt(1)}>
                write
              </InlineLink>{" "}
              about what I learn, publish small{" "}
              <InlineLink href={links.uniqueForge} external>
                dev tools
              </InlineLink>
              , and keep a{" "}
              <InlineLink href="/lab" drawAt={drawAt(2)}>
                lab
              </InlineLink>{" "}
              of UI experiments.
            </p>
          </RevealItem>

          <RevealItem>
            <p className="text-body text-text-secondary text-pretty">
              I also make{" "}
              <InlineLink href={socials.soundcloud} external>
                music
              </InlineLink>
              . reach out about startups, a cool idea, or anything at all.
            </p>
          </RevealItem>

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
