import { promises as fs } from "fs";
import path from "path";
import type { MetadataRoute } from "next";

async function getBlogSlugs(dir: string) {
  const entries = await fs.readdir(dir, {
    recursive: true,
    withFileTypes: true,
  });

  return entries
    .filter((entry) => entry.isFile() && entry.name === "page.mdx")
    .map((entry) => {
      const relativePath = path.relative(
        dir,
        path.join(entry.parentPath, entry.name)
      );
      return path.dirname(relativePath);
    })
    .map((slug) => slug.replace(/\\/g, "/"));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const blogsDirectory = path.join(process.cwd(), "app", "blogs");
  const slugs = await getBlogSlugs(blogsDirectory);

  const blogs = slugs.map((slug) => ({
    url: `https://sanyam.xyz/blogs/${slug}`,
    lastModified: new Date().toISOString(),
  }));

  // add more routes
  const routes = ["", "/blogs"].map((route) => ({
    url: `https://sanyam.xyz${route}`,
    lastModified: new Date().toISOString(),
  }));

  return [...routes, ...blogs];
}
