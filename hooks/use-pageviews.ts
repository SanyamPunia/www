"use client";

import { useEffect, useState } from "react";
import { postFetcher } from "@/lib/fetcher";

interface PageviewsResponse {
  results?: Array<{ metrics: number[]; dimensions?: string[] }>;
}

export function usePageviews(siteId: string, dateRange: string = "all") {
  const [count, setCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchPageviews = async () => {
      if (!siteId) {
        setIsLoading(false);
        return;
      }

      try {
        const data = await postFetcher<PageviewsResponse>(
          "/api/one-dollar-stats/pageviews",
          {
            site_id: siteId,
            date_range: dateRange,
          },
        );

        const first = data.results?.[0]?.metrics?.[0];
        if (typeof first === "number" && mounted) {
          setCount(Math.max(1, Math.floor(first)));
        }
      } catch {
        // no-op
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    fetchPageviews();

    return () => {
      mounted = false;
    };
  }, [siteId, dateRange]);

  return { count, isLoading };
}
