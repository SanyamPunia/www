import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";

export interface BlogMeta {
  slug: string;
  title: string;
  description: string;
  /** ISO `YYYY-MM-DD`. Formatted for display by `formatBlogDate`. */
  date: string;
  /** e.g. "7 min read" */
  readTime: string;
}

const BLOGS_DIR = path.join(process.cwd(), "app", "blogs");

/**
 * Every post, newest first. A post is a directory under `app/blogs` holding a
 * `meta.json`, a `page.mdx` of pure content, and a `page.tsx` that wraps it in
 * `BlogPost`. Anything without a `meta.json` is skipped, so a work in progress
 * can sit in the tree without appearing on the index.
 *
 * Dates are stored ISO and formatted at render. The old site stored them as
 * display strings like "mar 19, 2023" and sorted them lexically, which put
 * March before November and gave crawlers nothing machine-readable.
 */
export function getAllBlogs(): BlogMeta[] {
  if (!fs.existsSync(BLOGS_DIR)) return [];

  const blogs: BlogMeta[] = [];

  for (const entry of fs.readdirSync(BLOGS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const metaPath = path.join(BLOGS_DIR, entry.name, "meta.json");
    if (!fs.existsSync(metaPath)) continue;

    const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
    blogs.push({ slug: entry.name, ...meta });
  }

  return blogs.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Every post's `metadata`, built from its `meta.json` and slug.
 *
 * Shared because of a trap, not just to save four copies. Next merges metadata
 * shallowly, so a route declaring `openGraph` replaces the parent's object
 * outright, and that includes the `images` the root `opengraph-image` file
 * convention injects. All four posts declared `openGraph` for `type: "article"`
 * and silently shipped with no social image at all, while every other route
 * had one. Naming the image here is what stops the next post repeating it.
 *
 * `/opengraph-image.jpg` resolves against `metadataBase` and is the same file
 * the convention serves, just without the content hash.
 *
 * The alt is spelled out rather than passed as a bare URL string, which carries
 * none. Elsewhere `app/opengraph-image.alt.txt` supplies it, but a text file
 * cannot be imported, so this mirrors it. Keep the two in step.
 */
const OG_IMAGE = {
  url: "/opengraph-image.jpg",
  alt: "Sanyam Punia, a full-stack developer based in India",
};

export function blogMetadata(meta: BlogMeta): Metadata {
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: `/blogs/${meta.slug}` },
    openGraph: {
      title: meta.title,
      description: meta.description,
      type: "article",
      images: [OG_IMAGE],
    },
  };
}

/** "2023-03-19" to "Mar 19, 2023". The stylesheet lowercases it on screen. */
export function formatBlogDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
