"use client";

import useSWR, { type SWRConfiguration, type SWRResponse } from "swr";

interface BlogLikeData {
  count: number;
}

interface BulkLikesResponse {
  likes: Record<string, number>;
}

const defaultConfig: SWRConfiguration = {
  revalidateOnFocus: false,
  dedupingInterval: 45_000,
};

const singleLikeFetcher = async (url: string): Promise<BlogLikeData> => {
  const response = await fetch(url, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch likes for ${url}`);
  }

  const data = await response.json();
  const count = typeof data?.count === "number" ? data.count : 0;

  return { count };
};

const bulkLikesFetcher = async ([url, slugs]: [
  string,
  string[],
]): Promise<BulkLikesResponse> => {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ slugs }),
  });

  if (!response.ok) {
    throw new Error("Failed to fetch blog likes");
  }

  const payload = await response.json();

  const likes =
    payload?.likes && typeof payload.likes === "object"
      ? (payload.likes as Record<string, number>)
      : {};

  return {
    likes,
  };
};

export function useBlogLike(
  slug: string | null | undefined,
  config?: SWRConfiguration,
): SWRResponse<BlogLikeData> {
  return useSWR<BlogLikeData>(
    slug ? `/api/blogs/${slug}/likes` : null,
    singleLikeFetcher,
    {
      ...defaultConfig,
      ...config,
    },
  );
}

export function useBlogLikes(
  slugs: string[],
  config?: SWRConfiguration,
): SWRResponse<BulkLikesResponse> {
  const key = slugs.length ? ["/api/blogs/likes", [...slugs]] : null;

  return useSWR<BulkLikesResponse>(key, bulkLikesFetcher, {
    ...defaultConfig,
    ...config,
  });
}
