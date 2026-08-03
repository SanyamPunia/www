import { NextResponse } from "next/server";
import { SITE_URL } from "@/lib/constants";

/**
 * Step one of a one-off, manual flow: visit this route, approve the scopes,
 * and `/api/spotify/callback` hands back a refresh token to paste into
 * `SPOTIFY_REFRESH_TOKEN`. Nothing on the site links here and no visitor ever
 * hits it.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;

  if (!clientId) {
    return NextResponse.json(
      { error: "Missing SPOTIFY_CLIENT_ID" },
      { status: 500 },
    );
  }

  /*
   * Spotify matches the redirect URI byte for byte against the allow-list in
   * the app dashboard, so this has to be the origin you are actually browsing.
   * `NEXT_PUBLIC_BASE_URL` is what lets that be localhost during the one-off
   * local run without hardcoding it.
   */
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? SITE_URL;
  const redirectUri = new URL("/api/spotify/callback", baseUrl).toString();
  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: ["user-read-currently-playing", "user-read-playback-state"].join(
      " ",
    ),
    redirect_uri: redirectUri,
    state,
    show_dialog: "true",
  });

  const response = NextResponse.redirect(
    `https://accounts.spotify.com/authorize?${params.toString()}`,
  );

  response.cookies.set("spotify_oauth_state", state, {
    httpOnly: true,
    path: "/",
    maxAge: 600,
    sameSite: "lax",
    // `secure` would make the cookie unreadable over plain http, which is
    // exactly where this flow runs locally, so it tracks the origin
    secure: baseUrl.startsWith("https://"),
  });

  return response;
}
