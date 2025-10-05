import fs from "node:fs";
import path from "node:path";

export interface BlogMeta {
  slug: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  readTime: string; // e.g. "2 min read"
}

const BLOGS_DIR = path.join(process.cwd(), "app", "blogs");

export function getAllBlogs(): BlogMeta[] {
  if (!fs.existsSync(BLOGS_DIR)) return [];

  const entries = fs
    .readdirSync(BLOGS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  const blogs: BlogMeta[] = [];
  for (const slug of entries) {
    const metaPath = path.join(BLOGS_DIR, slug, "meta.json");
    if (!fs.existsSync(metaPath)) continue;
    try {
      const raw = fs.readFileSync(metaPath, "utf-8");
      const meta = JSON.parse(raw);
      blogs.push({ slug, ...meta });
    } catch {}
  }

  return blogs.sort((a, b) => (a.date < b.date ? 1 : -1));
}
