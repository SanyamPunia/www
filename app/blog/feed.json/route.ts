import { getAllBlogs } from "@/lib/blogs";
import { SITE_URL } from "@/lib/constants";

/*
 * Every post as a JSON Feed 1.1, for feed readers, and for the `omnibox` lab,
 * which cannot read the post list off the file system from the browser.
 *
 * A directory named `feed.json` is how the App Router serves a dotted path, the
 * shape `app/llms.txt/` takes. `getAllBlogs` skips it, since it holds no
 * `meta.json`.
 */
export const dynamic = "force-static";

export function GET() {
  const feed = {
    version: "https://jsonfeed.org/version/1.1",
    title: "Sanyam Punia, blog",
    home_page_url: `${SITE_URL}/blog`,
    feed_url: `${SITE_URL}/blog/feed.json`,
    authors: [{ name: "Sanyam Punia", url: SITE_URL }],
    items: getAllBlogs().map((post) => ({
      id: `${SITE_URL}/blog/${post.slug}`,
      url: `${SITE_URL}/blog/${post.slug}`,
      title: post.title,
      summary: post.description,
      date_published: `${post.date}T00:00:00Z`,
    })),
  };
  return Response.json(feed, {
    headers: { "content-type": "application/feed+json; charset=utf-8" },
  });
}
