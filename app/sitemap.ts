import type { MetadataRoute } from "next";
import { getAllBlogs } from "@/lib/blogs";
import { SITE_URL } from "@/lib/constants";
import { IMPLEMENTED_LABS, labsRegistry } from "@/lib/labs";

/**
 * Two rules this follows that the previous version did not.
 *
 * **Only routes that resolve.** Lab pages are gated on `IMPLEMENTED_LABS`, so a
 * registry entry without a component 404s. Mapping the whole registry would
 * advertise those. Every entry happens to be implemented today, which is
 * exactly why the filter needs to be here rather than remembered later.
 *
 * **No invented timestamps.** The previous version stamped `new Date()` on the
 * static pages, so every crawl saw four routes claiming they had changed that
 * second. `lastModified` is omitted where nothing real backs it, and the index
 * pages borrow the newest date from the content they list.
 */
const newest = (dates: string[]): Date | undefined => {
  const sorted = [...dates].sort();
  const latest = sorted.at(-1);
  return latest ? new Date(latest) : undefined;
};

export default function sitemap(): MetadataRoute.Sitemap {
  const blogs = getAllBlogs();
  const labs = labsRegistry.filter((lab) =>
    (IMPLEMENTED_LABS as readonly string[]).includes(lab.slug),
  );

  return [
    // no lastModified: the home page and /work change when their copy does,
    // and nothing in the repo records when that was
    { url: SITE_URL, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/work`, changeFrequency: "monthly", priority: 0.8 },
    {
      url: `${SITE_URL}/blogs`,
      lastModified: newest(blogs.map((blog) => blog.date)),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/lab`,
      lastModified: newest(labs.map((lab) => lab.createdAt)),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...blogs.map((blog) => ({
      url: `${SITE_URL}/blogs/${blog.slug}`,
      lastModified: new Date(blog.date),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...labs.map((lab) => ({
      url: `${SITE_URL}/lab/${lab.slug}`,
      lastModified: new Date(lab.createdAt),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
