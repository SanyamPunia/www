import Link from "next/link";
import { formatBlogDate, getAllBlogs } from "@/lib/blogs";

/**
 * Links out of a post to the others.
 *
 * Every post used to be a leaf with exactly one inbound link, its own index, and
 * nothing linking between them. That leaves crawlers no cluster to follow and
 * gives a reader who finished a post nowhere to go but back.
 *
 * Called "More posts" rather than "Related", deliberately. There is no tag or
 * topic data on a post, so relatedness cannot be computed, and a heading that
 * promises it would be a claim the ordering does not support. This is simply the
 * next most recent posts, which is true.
 */
const LIMIT = 3;

export function MorePosts({ currentSlug }: { currentSlug: string }) {
  const posts = getAllBlogs()
    .filter((post) => post.slug !== currentSlug)
    .slice(0, LIMIT);

  if (posts.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-meta text-text-muted">More posts</h2>

      {/* `-mx-3` so the row hover bleeds past the text without the resting
          state looking indented. The list owns it, not the row. */}
      <ul className="-mx-3 flex flex-col">
        {posts.map((post) => (
          <li key={post.slug}>
            <Link
              href={`/blogs/${post.slug}`}
              className="group flex flex-col gap-0.5 rounded-md px-3 py-2 transition-colors duration-200 hover:bg-fill focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15"
            >
              {/* descriptive anchor text: the post's own title, never "read
                  more", which tells a crawler nothing about the target */}
              <span className="text-body text-text-secondary transition-colors duration-200 group-hover:text-text-primary">
                {post.title}
              </span>
              <time className="text-meta text-text-muted" dateTime={post.date}>
                {formatBlogDate(post.date)}
              </time>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
