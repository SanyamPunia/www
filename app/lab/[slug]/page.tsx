import { ArrowUpRightIcon } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Demo } from "@/components/blogs/demo";
import { Experiment } from "@/components/lab/experiment";
import { MoreLabs } from "@/components/lab/more-labs";
import { BackLink } from "@/components/ui/back-link";
import { JsonLd } from "@/components/ui/json-ld";
import { PageShell } from "@/components/ui/page-shell";
import { PageTransition } from "@/components/ui/page-transition";
import { Reveal, RevealItem } from "@/components/ui/reveal";
import { RichText } from "@/components/ui/rich-text";
import {
  formatLabDate,
  getLabBySlug,
  isImplemented,
  labsRegistry,
  metaDescription,
} from "@/lib/labs";
import { labSchema } from "@/lib/schema";
import { cn } from "@/lib/utils";

export function generateStaticParams() {
  return labsRegistry
    .filter((lab) => isImplemented(lab.slug))
    .map((lab) => ({ slug: lab.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const lab = getLabBySlug(slug);
  if (!lab) return {};

  return {
    title: lab.title,
    description: metaDescription(lab.description[0]),
    alternates: { canonical: `/lab/${slug}` },
  };
}

export default async function LabDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const lab = getLabBySlug(slug);
  if (!lab || !isImplemented(slug)) notFound();

  return (
    <PageTransition>
      <PageShell align="top">
        <JsonLd schema={labSchema(lab)} />

        <Reveal className="flex flex-col gap-12">
          <RevealItem className="flex flex-col gap-8">
            <BackLink href="/lab">Lab</BackLink>

            <div className="flex flex-col gap-2">
              <h1 className="text-lead text-text-primary">{lab.title}</h1>
              <time
                dateTime={lab.createdAt}
                className="text-meta text-text-muted"
              >
                {formatLabDate(lab.createdAt)}
              </time>
            </div>
          </RevealItem>

          {/* the source links belong to the demo, not the write-up. `my-0` on
              the frame because its own margin is for the MDX case, and here it
              would stack on the flex gap and push the link away from the thing
              it labels. */}
          <RevealItem className="flex flex-col gap-2">
            {lab.bare ? (
              <Experiment slug={slug} />
            ) : (
              <Demo className={cn("my-0", lab.flush && "p-0")}>
                <Experiment slug={slug} />
              </Demo>
            )}

            {(lab.source || lab.reference) && (
              <div className="flex items-center justify-end gap-4 text-meta text-text-muted">
                {lab.reference && (
                  <LabLink href={lab.reference}>Reference</LabLink>
                )}
                {lab.source && <LabLink href={lab.source}>Source</LabLink>}
              </div>
            )}
          </RevealItem>

          <RevealItem className="flex flex-col gap-4">
            {lab.description.map((line) => (
              <p
                key={line.slice(0, 40)}
                className="text-body text-text-secondary text-pretty"
              >
                <RichText text={line} />
              </p>
            ))}
          </RevealItem>

          <RevealItem>
            <hr className="border-stroke" />
          </RevealItem>

          <RevealItem>
            <MoreLabs currentSlug={slug} />
          </RevealItem>
        </Reveal>
      </PageShell>
    </PageTransition>
  );
}

function LabLink({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group inline-flex items-center gap-1 transition-colors duration-200 hover:text-text-primary focus-visible:rounded-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15"
    >
      {/* the rule stays on the word. On the anchor it would run under the
          icon too, the same reason the back link wraps its label. */}
      <span className="relative after:absolute after:inset-x-0 after:bottom-[-0.1em] after:h-[0.14em] after:rounded-full after:bg-stroke-strong after:transition-colors after:duration-200 group-hover:after:bg-text-primary">
        {children}
      </span>
      <ArrowUpRightIcon aria-hidden="true" className="size-3 shrink-0" />
    </a>
  );
}
