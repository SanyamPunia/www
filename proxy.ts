import { type NextRequest, NextResponse } from "next/server";

/*
 * Content negotiation for the markdown variants.
 *
 * `/blogs/a-post.md` is a rewrite in `next.config.ts` and needs nothing here.
 * This is the second half: a client that asks for `text/markdown` at the page's
 * own URL gets the markdown instead of the page.
 *
 * Middleware is called Proxy from Next 16 on. Same file convention, one per
 * project, at the same level as `app`. See
 * `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`.
 */

/** the root has no segment of its own, and the catch-all needs one */
const HOME = "index";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /*
   * Nothing to do, and deliberately no `Vary` on the way past.
   *
   * Setting it on `NextResponse.next()` was the obvious move and does not work:
   * Next writes its own `Vary` for the router further down the stack and that
   * replaces the header outright, so the page still went out with only
   * `rsc, next-router-state-tree, ...` on it. Measured on a production build.
   *
   * The direction that matters is covered anyway. The markdown response carries
   * `Vary: Accept` itself, so no compliant cache will hand markdown to a
   * browser, which is the failure with a visible cost. The reverse, a cache
   * handing an agent the HTML it already had for this URL, degrades to the
   * agent using the `.md` path instead. Forcing `Vary` onto every page through
   * `next.config.ts` would buy that back at the price of overwriting the header
   * the router relies on.
   */
  if (!request.headers.get("accept")?.includes("text/markdown")) return;

  /*
   * A rewrite rather than a redirect, so the URL an agent was given is the URL
   * it keeps. An unknown path lands on the handler's own 404 rather than being
   * checked twice.
   */
  const target = pathname === "/" ? `/md/${HOME}` : `/md${pathname}`;
  return NextResponse.rewrite(new URL(target, request.url));
}

export const config = {
  /*
   * Pages only. The exclusions matter in three different ways: `api` and `md`
   * would negotiate a route that is already an exact resource, `_next` is the
   * build output, and anything containing a dot is either a file or is already a
   * `.md` request that `next.config.ts` rewrites before this would see it.
   */
  matcher: ["/((?!api|md|_next|.*\\.).*)"],
};
