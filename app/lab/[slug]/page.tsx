// the main barrel pulls in `createContext` and throws in RSC, but a type-only
// import is erased before that can happen, and the ssr entry has no `Icon` type
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import {
  ArrowSquareOutIcon,
  ArrowUpRightIcon,
  CodeIcon,
} from "@phosphor-icons/react/dist/ssr";
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
    alternates: {
      canonical: `/lab/${slug}`,
      types: { "text/markdown": `/lab/${slug}.md` },
    },
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
            {/* `data-lab-demo` is the box `scripts/record-lab-previews.mjs`
                crops its recording to. A wrapper rather than an attribute on
                `Demo`, since a `bare` entry has no frame and the recorder still
                has to find the same box. */}
            <div data-lab-demo="">
              {lab.bare ? (
                <Experiment slug={slug} />
              ) : (
                <Demo className={cn("my-0", lab.flush && "p-0")}>
                  <Experiment slug={slug} />
                </Demo>
              )}
            </div>

            {/* the hint says what to do with the demo and the links say where
                it came from, so the two share one row from opposite ends.

                Below `sm` the links are their icons alone, and that is what
                keeps the row one row. As words they are 131px of a 352px
                column, so the hint could not fit beside them and took a line of
                its own, which left the links holding the right of the next line
                with 205px of empty row to their left: an orphan rather than a
                caption. As icons they are 52px, so the hint shrinks and wraps
                its own text instead and the two stay at opposite ends at every
                width from 320px up. `aria-label` carries the name at both, so
                nothing is lost by painting the word or not.

                No `flex-wrap`, for the same reason: a hint that cannot fit is
                meant to wrap its own text, never to push the links onto a line
                where nothing balances them. `min-w-0` on the hint is what lets
                it shrink that far, and `shrink-0` on the links is what keeps
                them out of it. */}
            {(lab.hint || lab.source || lab.reference) && (
              <div className="flex items-center gap-x-4 text-meta text-text-muted">
                {lab.hint && <p className="min-w-0">{lab.hint}</p>}

                {(lab.source || lab.reference) && (
                  <div className="ml-auto flex shrink-0 items-center gap-1.25 whitespace-nowrap sm:gap-4">
                    {lab.reference && (
                      <LabLink
                        href={lab.reference}
                        label="Reference"
                        icon={ArrowSquareOutIcon}
                      />
                    )}
                    {lab.source && (
                      <LabLink
                        href={lab.source}
                        label="Source"
                        icon={CodeIcon}
                      />
                    )}
                  </div>
                )}
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

function LabLink({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  /** Painted below `sm` in place of the word. */
  icon: PhosphorIcon;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      // the name is the word whether or not the word is painted
      aria-label={label}
      className={cn(
        "group cursor-pointer transition-all duration-200 hover:text-text-primary",
        "focus-visible:rounded-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15",
        /* 24px and 12px exactly, off the `--spacing` steps for the reason the
           footer's socials are: those land on 25.6 and 12.8 and put a mark on
           fractional pixels. A word needs no target of its own, so the box and
           its background step go away at `sm`. */
        "inline-flex size-[1.5rem] items-center justify-center rounded-md hover:bg-fill active:bg-fill-hover",
        "sm:size-auto sm:gap-1 sm:hover:bg-transparent sm:active:bg-transparent",
      )}
    >
      <Icon aria-hidden="true" className="size-[0.75rem] shrink-0 sm:hidden" />
      {/* the rule stays on the word. On the anchor it would run under the
          icon too, the same reason the back link wraps its label. */}
      <span className="relative hidden after:absolute after:inset-x-0 after:bottom-[-0.1em] after:h-[0.14em] after:rounded-full after:bg-stroke-strong after:transition-colors after:duration-200 group-hover:after:bg-text-primary sm:inline">
        {label}
      </span>
      <ArrowUpRightIcon
        aria-hidden="true"
        className="hidden size-3 shrink-0 sm:block"
      />
    </a>
  );
}
