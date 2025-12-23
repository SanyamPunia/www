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
  const { data, error } = useSWR<PackageStats>(
    `/api/packages/${packageName}`,
    (url) => fetcher<PackageStats>(url),
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
    },
  );

  if (error || !data || data.total === 0) {
    return null;
  }

  return (
    <code className="text-xs px-1.5 py-0.5 rounded-sm bg-neutral-900 text-neutral-200">
      {data.total.toLocaleString()} downloads
    </code>
  );
}
