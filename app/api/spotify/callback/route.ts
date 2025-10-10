import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  if (!clientId || !clientSecret || !baseUrl) {
    return NextResponse.json(
      {
        error:
          "Missing SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET or NEXT_PUBLIC_BASE_URL",
      },
      { status: 500 },
    );
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = req.cookies.get("spotify_oauth_state")?.value;

  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.json(
      { error: "Invalid state or missing code" },
      { status: 400 },
    );
  }

  const redirectUri = new URL("/api/spotify/callback", baseUrl).toString();

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64",
  );

  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text().catch(() => "");
    return NextResponse.json(
      { error: `Token exchange failed: ${errText}` },
      { status: 500 },
    );
  }

  const tokenJson = (await tokenRes.json()) as {
    access_token: string;
    token_type: string;
    scope: string;
    expires_in: number;
    refresh_token?: string;
  };

  // Return the refresh token to the user (manual copy) or redirect with it in a fragment
  const res = NextResponse.json({
    refresh_token: tokenJson.refresh_token ?? null,
  });
  res.cookies.set("spotify_oauth_state", "", { path: "/", maxAge: 0 });
  return res;
}
