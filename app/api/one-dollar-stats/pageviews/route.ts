import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type DateRange = "year" | "all" | string | [string, string];

interface OneDollarStatsRequest {
  site_id: string;
  metrics: string[];
  date_range: DateRange;
  dimensions?: string[];
  filters?: unknown;
  order_by?: Array<[string, "asc" | "desc"]>;
  include?: Record<string, unknown>;
  pagination?: { limit?: number; offset?: number };
}

interface OneDollarStatsResponse {
  results?: Array<{ metrics: number[]; dimensions?: string[] }>;
  meta?: Record<string, unknown>;
  query?: Record<string, unknown>;
}

function getApiKey() {
  const key = process.env.ONE_DOLLAR_STATS;
  return key;
}

export async function POST(request: Request) {
  try {
    const apiKey = getApiKey();
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing ONE_DOLLAR_STATS" },
        { status: 500 },
      );
    }

    const body = (await request.json()) as Partial<{
      site_id: string;
      date_range: DateRange;
      dimensions?: string[];
      filters?: unknown;
      order_by?: Array<[string, "asc" | "desc"]>;
      include?: Record<string, unknown>;
      pagination?: { limit?: number; offset?: number };
    }>;

    if (!body.site_id) {
      return NextResponse.json(
        { error: "site_id is required" },
        { status: 400 },
      );
    }

    const payload: OneDollarStatsRequest = {
      site_id: body.site_id,
      metrics: ["pageviews"],
      date_range: body.date_range ?? "all",
      ...(body.dimensions ? { dimensions: body.dimensions } : {}),
      ...(body.filters ? { filters: body.filters } : {}),
      ...(body.order_by ? { order_by: body.order_by } : {}),
      ...(body.include ? { include: body.include } : {}),
      ...(body.pagination ? { pagination: body.pagination } : {}),
    };

    const res = await fetch("https://api.onedollarstats.com/api", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const contentType = res.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");

    const upstreamBody = isJson ? await res.json() : await res.text();

    if (!res.ok) {
      return NextResponse.json(
        {
          error: "OneDollarStats request failed",
          status: res.status,
          details: upstreamBody,
        },
        { status: 502 },
      );
    }

    return NextResponse.json(upstreamBody as OneDollarStatsResponse, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 },
    );
  }
}
