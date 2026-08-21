import Link from "next/link";
import { NewBadge } from "@/components/ui/new-badge";
import { type BlogMeta, formatBlogDate } from "@/lib/blogs";

/**
 * The post list. Same row language as `/work`: title, a leader rule that
 * absorbs the slack, then the date. No client state, so this stays a server
 * component.
 */
export function BlogIndex({ blogs }: { blogs: BlogMeta[] }) {
  if (blogs.length === 0) {
    return <p className="text-body text-text-muted">Nothing published yet.</p>;
  }

  return (
    <ul className="-mx-4 flex flex-col gap-1">
      {blogs.map((blog, index) => (
        <li key={blog.slug}>
          <Link
            href={`/blogs/${blog.slug}`}
            className="group relative flex items-center gap-3 rounded-full px-4 py-2 transition-colors duration-200 hover:bg-fill active:bg-fill-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary/15"
          >
            {/* first child, so the badge joins the link's accessible name and a
                screen reader hears "new" before the title rather than after the
                date. The list is sorted newest first, so index 0 is the entry. */}
            {index === 0 && <NewBadge />}

            <span className="min-w-0 shrink truncate text-body leading-tight text-text-primary">
              {blog.title}
            </span>

            <span
              aria-hidden="true"
              className="h-px min-w-4 flex-1 bg-stroke-soft transition-colors duration-200 group-hover:bg-stroke"
            />

            <time
              dateTime={blog.date}
              className="shrink-0 text-meta text-text-muted"
            >
              {formatBlogDate(blog.date)}
            </time>
          </Link>
        </li>
      ))}
    </ul>
  );
}
