import { NextResponse } from "next/server";
import { getNowPlaying } from "@/lib/spotify";

/**
 * `force-dynamic` because the whole point is the current track. Without it
 * Next would prerender this at build time and serve whatever was playing then,
 * forever.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getNowPlaying();

  return NextResponse.json(data, {
    // the client polls every 30s, so a 15s edge cache absorbs bursts without
    // the line ever being more than half a poll stale
    headers: { "Cache-Control": "s-maxage=15, stale-while-revalidate=30" },
  });
}
