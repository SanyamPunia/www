import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;

  if (!clientId || !baseUrl) {
    return NextResponse.json(
      { error: "Missing SPOTIFY_CLIENT_ID or NEXT_PUBLIC_BASE_URL" },
      { status: 500 },
    );
  }

  const redirectUri = new URL("/api/spotify/callback", baseUrl).toString();
  const state = crypto.randomUUID();
  const scope = [
    "user-read-currently-playing",
    "user-read-playback-state",
  ].join(" ");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope,
    redirect_uri: redirectUri,
    state,
    show_dialog: "true",
  });

  const authorizeUrl = `https://accounts.spotify.com/authorize?${params.toString()}`;
  const res = NextResponse.redirect(authorizeUrl);
  res.cookies.set("spotify_oauth_state", state, {
    httpOnly: true,
    path: "/",
    maxAge: 600,
    sameSite: "lax",
    secure: true,
  });
  return res;
}
