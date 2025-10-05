import type { MetadataRoute } from "next";
import { validateEnv } from "@/env-validation";

// validate robots
const env = validateEnv();

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/blogs", "/lab", "/work"],
      disallow: "/private/",
    },
    sitemap: `${env.NEXT_PUBLIC_BASE_URL}/sitemap.xml`,
  };
}
