import { llmsIndex } from "@/lib/markdown";

/*
 * The index an agent looks for first, per llmstxt.org.
 *
 * A directory named `llms.txt` is how the App Router serves a dotted path, the
 * same shape `robots.txt` and `sitemap.xml` take through their own file
 * conventions. `proxy.ts` never sees it: its matcher excludes anything
 * containing a dot.
 *
 * Indexable, unlike the markdown documents themselves. This file is not a second
 * copy of a page, it is the one surface that lists them all.
 */
export const dynamic = "force-static";

export function GET() {
  return new Response(llmsIndex(), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
