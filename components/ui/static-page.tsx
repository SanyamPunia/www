import { BackLink } from "@/components/ui/back-link";
import { CodeSpan } from "@/components/ui/code-span";
import { InlineLink } from "@/components/ui/inline-link";
import { PageNav } from "@/components/ui/page-nav";
import { PageShell } from "@/components/ui/page-shell";
import { PageTransition } from "@/components/ui/page-transition";
import { Reveal, RevealItem } from "@/components/ui/reveal";
import type { StaticPage as StaticPageData } from "@/lib/pages";
import { siteRoutes } from "@/lib/pages";

/**
 * The one layout for a page that is prose and nothing else. `/about`,
 * `/contact` and `/privacy` all render through it, so they cannot drift apart,
 * and each route file is left holding its metadata and its JSON-LD.
 *
 * It is a server component, and so is everything in it apart from `Reveal`,
 * which passes children through.
 *
 * Same skeleton as `/work` and the two indexes: back link, then the title and
 * its lead grouped at `gap-2`, then one `RevealItem` per block so they arrive on
 * the site's own stagger. The bottom nav is the last block, since these three
 * pages are the only ones with no other way out.
 */
export function StaticPage({
  page,
  children,
}: {
  page: StaticPageData;
  /** the page's JSON-LD, rendered by the route that owns the schema type */
  children?: React.ReactNode;
}) {
  const elsewhere = siteRoutes.filter(
    (route) => route.href !== `/${page.slug}`,
  );

  return (
    <PageTransition>
      <PageShell align="top">
        {children}

        <Reveal className="flex flex-col gap-12">
          <RevealItem className="flex flex-col gap-8">
            <BackLink href="/">Home</BackLink>

            {/* a real `h1` at `text-lead`, with the lead line under it in
                secondary tone. No weight change, nothing on this site is bold */}
            <div className="flex flex-col gap-2">
              <h1 className="text-lead text-text-primary">{page.title}</h1>
              <p className="text-body text-text-secondary text-pretty">
                {page.lead}
              </p>
            </div>
          </RevealItem>

          {page.sections.map((section) => (
            <RevealItem key={section.label}>
              <section className="flex flex-col gap-2">
                <h2 className="text-meta text-text-muted">{section.label}</h2>

                <div className="flex flex-col gap-4">
                  {section.paragraphs.map((paragraph) => (
                    <p
                      key={paragraph.id}
                      className="text-body text-text-secondary text-pretty"
                    >
                      {paragraph.segments.map((segment) => {
                        if (typeof segment === "string") return segment;
                        // the home page's own sweep, and nothing here uses it
                        if ("name" in segment) return segment.name;

                        if ("code" in segment) {
                          return (
                            <CodeSpan key={segment.code}>
                              {segment.code}
                            </CodeSpan>
                          );
                        }

                        return (
                          <InlineLink
                            key={segment.href}
                            href={segment.href}
                            /*
                             * External is derived from the href, so a link to
                             * another origin cannot be added without the rel
                             * guard. `resource` is the same treatment asked for
                             * by hand: a same-origin path that is a file rather
                             * than a page, which `next/link` would try to
                             * navigate to as a route.
                             */
                            external={
                              segment.resource ||
                              segment.href.startsWith("http")
                            }
                          >
                            {segment.text}
                          </InlineLink>
                        );
                      })}
                    </p>
                  ))}
                </div>
              </section>
            </RevealItem>
          ))}

          <RevealItem className="flex flex-col gap-8">
            <hr className="border-stroke" />
            <PageNav items={elsewhere} label="Pages" />
          </RevealItem>
        </Reveal>
      </PageShell>
    </PageTransition>
  );
}
