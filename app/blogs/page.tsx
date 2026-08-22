import type { Metadata } from "next";
import { BlogIndex } from "@/components/blogs/blog-index";
import { BackLink } from "@/components/ui/back-link";
import { JsonLd } from "@/components/ui/json-ld";
import { PageShell } from "@/components/ui/page-shell";
import { PageTransition } from "@/components/ui/page-transition";
import { Reveal, RevealItem } from "@/components/ui/reveal";
import { getAllBlogs } from "@/lib/blogs";
import { collectionSchema } from "@/lib/schema";

/** one string, used by both `metadata` and the JSON-LD, so they cannot drift */
const DESCRIPTION =
  "Notes on frontend engineering, React and whatever Sanyam is learning, from typesafe APIs with tRPC to modelling pending state with transitions.";

export const metadata: Metadata = {
  title: "Blogs",
  description: DESCRIPTION,
  alternates: { canonical: "/blogs" },
};

export default function BlogsPage() {
  const blogs = getAllBlogs();

  return (
    <PageTransition>
      <PageShell align="top">
        {/* mirrors `blogs` above, in the same order the index renders */}
        <JsonLd
          schema={collectionSchema({
            path: "/blogs",
            name: "Blogs",
            description: DESCRIPTION,
            items: blogs,
          })}
        />

        <Reveal className="flex flex-col gap-12">
          <RevealItem className="flex flex-col gap-8">
            <BackLink href="/">Home</BackLink>

            {/*
             * A real title, not an sr-only one. The page lead used to carry
             * both jobs at content weight, which left it indistinguishable
             * from every row beneath it.
             *
             * `text-lead` and no weight change: nothing on this site is bold,
             * so the step is size and tone, and the pair is grouped so they
             * read as one block rather than two peers.
             */}
            <div className="flex flex-col gap-2">
              <h1 className="text-lead text-text-primary">Blogs</h1>
              <p className="text-body text-text-secondary text-pretty">
                Notes on what I&rsquo;m learning, mostly frontend.
              </p>
            </div>
          </RevealItem>

          <RevealItem>
            <BlogIndex blogs={blogs} markNewest />
          </RevealItem>
        </Reveal>
      </PageShell>
    </PageTransition>
  );
}
