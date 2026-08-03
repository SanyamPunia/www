import type { Metadata } from "next";
import { BackLink } from "@/components/ui/back-link";
import { JsonLd } from "@/components/ui/json-ld";
import { PageShell } from "@/components/ui/page-shell";
import { PageTransition } from "@/components/ui/page-transition";
import { Reveal, RevealItem } from "@/components/ui/reveal";
import { WorkSection } from "@/components/work/work-section";
import { workSchema } from "@/lib/schema";
import { workSections } from "@/lib/work";

export const metadata: Metadata = {
  title: "Work",
  description:
    "Companies Sanyam has built at, from founding engineer at Bitscale to frontend engineer at Oliv AI, plus the side projects and packages he ships.",
  alternates: { canonical: "/work" },
};

export default function WorkPage() {
  return (
    <PageTransition>
      <PageShell align="top">
        <JsonLd schema={workSchema()} />

        {/*
         * Same stagger as every other page. `Reveal` passes children straight
         * through, so `WorkSection` stays a server component inside it.
         */}
        <Reveal className="flex flex-col gap-12">
          <RevealItem className="flex flex-col gap-8">
            <BackLink href="/">Home</BackLink>

            {/*
             * A real title, not an sr-only one. The lead used to carry both
             * jobs at content weight, which left it indistinguishable from
             * every row beneath it.
             *
             * `text-lead` and no weight change, since nothing on this site is
             * bold. The step is size and tone, and the pair is grouped so they
             * read as one block rather than two peers.
             */}
            <div className="flex flex-col gap-2">
              <h1 className="text-lead text-text-primary">Work</h1>
              <p className="text-body text-text-secondary text-pretty">
                Where I&rsquo;ve worked and what I&rsquo;ve shipped.
              </p>
            </div>
          </RevealItem>

          {workSections.map((section) => (
            <RevealItem key={section.label}>
              <WorkSection section={section} />
            </RevealItem>
          ))}
        </Reveal>
      </PageShell>
    </PageTransition>
  );
}
