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
    /*
     * `no-store`, not an s-maxage window. `force-dynamic` only stops the route
     * being prerendered, it does not stop the CDN caching the response, so on
     * Vercel an edge cache meant every visitor in a region shared one poll and
     * the disc showed a track that had already changed.
     */
    headers: { "Cache-Control": "no-store" },
  });
}
