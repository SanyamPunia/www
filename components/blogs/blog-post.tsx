import type React from "react";
import { MorePosts } from "@/components/blogs/more-posts";
import { BackLink } from "@/components/ui/back-link";
import { JsonLd } from "@/components/ui/json-ld";
import { PageShell } from "@/components/ui/page-shell";
import { PageTransition } from "@/components/ui/page-transition";
import { Reveal, RevealItem } from "@/components/ui/reveal";
import { type BlogMeta, formatBlogDate } from "@/lib/blogs";
import { blogPostSchema } from "@/lib/schema";

/**
 * The shell every post renders inside: back link, title, date and read time,
 * then the prose.
 *
 * The old site put this chrome inside each `page.mdx`, so every post carried
 * its own copy of the layout and they drifted. Here the MDX is pure content
 * and the shell lives in one place.
 */
export function BlogPost({
  meta,
  children,
}: {
  // the slug is required now: the schema needs it for `url`, and `MorePosts`
  // needs it to exclude the post you are already reading
  meta: BlogMeta;
  children: React.ReactNode;
}) {
  return (
    <PageTransition>
      <PageShell align="top">
        <JsonLd schema={blogPostSchema(meta)} />
        <Reveal className="flex flex-col gap-12">
          <RevealItem className="flex flex-col gap-8">
            <BackLink href="/blogs">Blogs</BackLink>

            <div className="flex flex-col gap-2">
              <h1 className="text-lead text-text-primary text-pretty">
                {meta.title}
              </h1>
              {/* the dot is an element, never a middot character */}
              <p className="flex items-center gap-1.5 text-meta text-text-muted">
                <time dateTime={meta.date}>{formatBlogDate(meta.date)}</time>
                <span
                  aria-hidden="true"
                  className="inline-block size-1.25 shrink-0 rounded-full bg-stroke-strong"
                />
                {meta.readTime}
              </p>
            </div>
          </RevealItem>

          <RevealItem>
            <article>{children}</article>
          </RevealItem>

          <RevealItem>
            <hr className="border-stroke" />
          </RevealItem>

          <RevealItem>
            <MorePosts currentSlug={meta.slug} />
          </RevealItem>
        </Reveal>
      </PageShell>
    </PageTransition>
  );
}
