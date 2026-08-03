import { type NextRequest, NextResponse } from "next/server";
import { SITE_URL } from "@/lib/constants";

/**
 * Step two of the manual token flow. Returns the refresh token as JSON to copy
 * into `SPOTIFY_REFRESH_TOKEN`. It is never stored server-side, so this route
 * holds no state and is safe to leave deployed.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET" },
      { status: 500 },
    );
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = request.cookies.get("spotify_oauth_state")?.value;

  // the state cookie is the CSRF check: without it a third party could feed
  // their own authorisation code into this endpoint
  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.json(
      { error: "Invalid state or missing code" },
      { status: 400 },
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? SITE_URL;
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64",
  );

  const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      // must match the URI sent at authorize time exactly, or Spotify rejects
      redirect_uri: new URL("/api/spotify/callback", baseUrl).toString(),
    }),
    cache: "no-store",
  });

  if (!tokenResponse.ok) {
    const detail = await tokenResponse.text().catch(() => "");
    return NextResponse.json(
      { error: `Token exchange failed: ${detail}` },
      { status: 500 },
    );
  }

  const token = (await tokenResponse.json()) as { refresh_token?: string };

  const response = NextResponse.json({
    refresh_token: token.refresh_token ?? null,
  });
  response.cookies.set("spotify_oauth_state", "", { path: "/", maxAge: 0 });
  return response;
}
