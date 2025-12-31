"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";

interface PackageStats {
  name: string;
  description: string;
  homepage?: string;
  version: string;
  total: number;
  downloads: Record<string, number>;
}

interface NpmStatsProps {
  packageName: string;
}

export function NpmStats({ packageName }: NpmStatsProps) {
  const { data, error, isLoading } = useSWR<PackageStats>(
    `/api/packages/${packageName}`,
    (url) => fetcher<PackageStats>(url),
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
    },
  );

  if (error || (!data && !isLoading)) {
    return null;
  }

  if (isLoading) {
    return (
      <span className="inline-block h-4 w-8 rounded bg-neutral-800 animate-pulse relative top-1" />
    );
  }

  if (!data || data.total === 0) {
    return null;
  }

  return (
    <code className="text-xs px-1.5 py-0.5 rounded-sm bg-neutral-900 text-neutral-200">
      {data.total.toLocaleString()} downloads
    </code>
  );
}
