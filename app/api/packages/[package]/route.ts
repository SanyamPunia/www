import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface PackageMetadata {
  name: string;
  description: string;
  homepage?: string;
  version: string;
}

interface PackageStatsResponse {
  name: string;
  description: string;
  homepage?: string;
  version: string;
  total: number;
  downloads: Record<string, number>;
}

const USE_LAST_WEEK_END = false;

function getUntilDate(): string {
  const today = new Date();

  if (USE_LAST_WEEK_END) {
    const day = today.getDay();
    const diff = today.getDate() - day;
    const lastSunday = new Date(today.setDate(diff));
    lastSunday.setHours(23, 59, 59, 999);
    return lastSunday.toISOString().split("T")[0];
  }

  return today.toISOString().split("T")[0];
}

async function fetchPackageMetadata(
  packageName: string,
): Promise<PackageMetadata | null> {
  try {
    const response = await fetch(`https://registry.npmjs.org/${packageName}`, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      name?: string;
      description?: string;
      homepage?: string;
      "dist-tags"?: { latest?: string };
    };

    return {
      name: data.name || packageName,
      description: data.description || "",
      homepage: data.homepage,
      version: data["dist-tags"]?.latest || "",
    };
  } catch (error) {
    console.error("Error fetching package metadata:", error);
    return null;
  }
}

async function fetchDownloadCounts(
  packageName: string,
): Promise<Record<string, number>> {
  try {
    const until = getUntilDate();
    const response = await fetch(
      `https://npm-stat.com/api/download-counts?package=${packageName}&from=2010-01-01&until=${until}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
        },
      },
    );

    if (!response.ok) {
      return {};
    }

    const data = (await response.json()) as Record<
      string,
      Record<string, number>
    >;
    return data[packageName] || {};
  } catch (error) {
    console.error("Error fetching download counts:", error);
    return {};
  }
}

export async function GET(
  _request: unknown,
  { params }: { params: Promise<{ package: string }> },
) {
  try {
    const { package: packageName } = await params;

    if (!packageName) {
      return NextResponse.json(
        { error: "Package name is required" },
        { status: 400 },
      );
    }

    const [metadata, downloads] = await Promise.all([
      fetchPackageMetadata(packageName),
      fetchDownloadCounts(packageName),
    ]);

    if (!metadata) {
      return NextResponse.json({ error: "Package not found" }, { status: 404 });
    }

    const total = Object.values(downloads).reduce(
      (sum, count) => sum + count,
      0,
    );

    const response: PackageStatsResponse = {
      name: metadata.name,
      description: metadata.description,
      homepage: metadata.homepage,
      version: metadata.version,
      total,
      downloads,
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("Error fetching package stats:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
