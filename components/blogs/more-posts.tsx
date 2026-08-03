import { BlogIndex } from "@/components/blogs/blog-index";
import { getAllBlogs } from "@/lib/blogs";

/**
 * Links out of a post to the others.
 *
 * Every post used to be a leaf with exactly one inbound link, its own index, and
 * nothing linking between them. That leaves crawlers no cluster to follow and
 * gives a reader who finished a post nowhere to go but back.
 *
 * Renders through `BlogIndex`, the same component the index page uses, rather
 * than a second row style. A post title is one thing and renders one way
 * everywhere, or the two drift the first time either is touched. That also means
 * the labelled-group shape matches `WorkSection` exactly: `gap-2`, an `h2` at
 * `text-meta`, and the list owning its own `-mx-4`.
 *
 * Called "More posts" rather than "Related", deliberately. There is no tag or
 * topic data on a post, so relatedness cannot be computed, and a heading that
 * promised it would be a claim the ordering does not support. This is simply the
 * next most recent posts, which is true.
 */
const LIMIT = 3;

export function MorePosts({ currentSlug }: { currentSlug: string }) {
  const posts = getAllBlogs()
    .filter((post) => post.slug !== currentSlug)
    .slice(0, LIMIT);

  if (posts.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-meta text-text-muted">More posts</h2>
      <BlogIndex blogs={posts} />
    </section>
  );
}
