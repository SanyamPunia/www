import type { Metadata } from "next";
import { LabIndex } from "@/components/lab/lab-index";
import { BackLink } from "@/components/ui/back-link";
import { JsonLd } from "@/components/ui/json-ld";
import { PageShell } from "@/components/ui/page-shell";
import { PageTransition } from "@/components/ui/page-transition";
import { Reveal, RevealItem } from "@/components/ui/reveal";
import { labsRegistry } from "@/lib/labs";
import { collectionSchema } from "@/lib/schema";

/** one string, used by both `metadata` and the JSON-LD, so they cannot drift */
const DESCRIPTION =
  "Interface interactions Sanyam rebuilt to understand how they work, each running live on the page: morphing icons, spring physics, animated borders.";

export const metadata: Metadata = {
  title: "Lab",
  description: DESCRIPTION,
  alternates: { canonical: "/lab" },
};

export default function LabPage() {
  // the registry reads oldest first, the index shows newest
  const labs = labsRegistry.slice().reverse();

  return (
    <PageTransition>
      <PageShell align="top">
        {/* the list mirrors `labs` above, so the markup cannot claim an
            experiment the page does not render */}
        <JsonLd
          schema={collectionSchema({
            path: "/lab",
            name: "Lab",
            description: DESCRIPTION,
            items: labs,
          })}
        />

        <Reveal className="flex flex-col gap-12">
          <RevealItem className="flex flex-col gap-8">
            <BackLink href="/">Home</BackLink>

            <div className="flex flex-col gap-2">
              <h1 className="text-lead text-text-primary">Lab</h1>
              <p className="text-body text-text-secondary text-pretty">
                Interactions I rebuilt to understand how they work.
              </p>
            </div>
          </RevealItem>

          <RevealItem>
            <LabIndex labs={labs} markNewest />
          </RevealItem>
        </Reveal>
      </PageShell>
    </PageTransition>
  );
}
