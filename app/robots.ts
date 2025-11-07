import type { MetadataRoute } from "next";
import { validateEnv } from "@/env-validation";
import { getAllBlogs } from "@/lib/blogs";
import { labsRegistry } from "@/lib/labs.registry";

// validate robots
const env = validateEnv();

export default function robots(): MetadataRoute.Robots {
  const staticRoutes = ["/", "/blogs", "/lab", "/work"];

  const blogs = getAllBlogs();
  const blogRoutes = blogs.map((blog) => `/blogs/${blog.slug}`);

  const labRoutes = labsRegistry.map((lab) => `/lab/${lab.slug}`);

  const allowRoutes = [...staticRoutes, ...blogRoutes, ...labRoutes];

  return {
    rules: {
      userAgent: "*",
      allow: allowRoutes,
      disallow: "/private/",
    },
    sitemap: `${env.NEXT_PUBLIC_BASE_URL}/sitemap.xml`,
  };
}
