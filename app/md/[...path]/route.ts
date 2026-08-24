import { markdownFor, markdownRoutes } from "@/lib/markdown";

/*
 * The markdown variant of every page.
 *
 * The public path is the page's own plus `.md`, and `next.config.ts` rewrites it
 * here. It cannot live at the root as `[...path]`, because a dynamic page beats a
 * catch-all in Next's matching order, so `/lab/tab-overview.md` would reach
 * `app/lab/[slug]` and 404 there as an experiment whose slug ends in `.md`. A
 * literal `md` segment beats both.
 *
 * `proxy.ts` rewrites here as well, for a request that asks for `text/markdown`
 * at the page's own path.
 */
export const dynamic = "force-static";

export function generateStaticParams() {
  return markdownRoutes().map((path) => ({ path }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const body = markdownFor(path);

  if (!body) {
    return new Response("Not found\n", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  return new Response(body, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      /*
       * Every one of these is the same content as an HTML page that is already
       * indexable, and two URLs competing for one body is what canonicals exist
       * to prevent. The page announces this file with `rel="alternate"`, which is
       * the direction that belongs in an index. `sitemap.ts` lists none of them.
       */
      "x-robots-tag": "noindex",
      /*
       * The other half of the feature is that this body can also be served at
       * the page's own URL, chosen by a request header. Any cache between here
       * and the client keys on the URL alone unless it is told otherwise, and
       * without this an agent's markdown could be handed to the next browser
       * asking for the same page.
       */
      vary: "accept",
    },
  });
}
