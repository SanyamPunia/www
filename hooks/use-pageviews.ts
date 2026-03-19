"use client";

import useSWR from "swr";
import { postFetcher } from "@/lib/fetcher";

interface PageviewsResponse {
  results?: Array<{ metrics: number[]; dimensions?: string[] }>;
}

export function usePageviews(siteId: string, dateRange: string = "all") {
  const { data, isLoading } = useSWR<PageviewsResponse>(
    siteId ? ["pageviews", siteId, dateRange] : null,
    () =>
      postFetcher<PageviewsResponse>("/api/one-dollar-stats/pageviews", {
        site_id: siteId,
        date_range: dateRange,
      }),
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
    },
  );

  const first = data?.results?.[0]?.metrics?.[0];
  const count = typeof first === "number" ? Math.max(1, Math.floor(first)) : null;

  return { count, isLoading };
}
