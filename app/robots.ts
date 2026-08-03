import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";

/**
 * Allow everything, and point at the sitemap.
 *
 * The previous version enumerated every route into `allow`, which reads as
 * thorough but does nothing: `allow: "/"` already covers them, and the list
 * silently went stale every time a post or experiment was added. It also
 * disallowed `/private/`, a path this site has never had.
 *
 * The one real exclusion is `/api/`. Nothing under it renders anything a
 * crawler should index, and `/api/spotify/login` issues a redirect to Spotify's
 * authorize screen, which is not something to hand a bot.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/api/",
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
