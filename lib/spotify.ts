import type { NowPlaying } from "@/types";

function getSpotifyEnv(): {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
} {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Missing Spotify env vars. Ensure SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, and SPOTIFY_REFRESH_TOKEN are set.",
    );
  }

  return { clientId, clientSecret, refreshToken };
}

async function getAccessToken(): Promise<string> {
  const { clientId, clientSecret, refreshToken } = getSpotifyEnv();

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64",
  );

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(
      `Failed to refresh Spotify token: ${response.status} ${errText}`,
    );
  }

  const json = (await response.json()) as { access_token: string };
  return json.access_token;
}

export async function getNowPlaying(): Promise<NowPlaying> {
  try {
    const accessToken = await getAccessToken();

    const response = await fetch(
      "https://api.spotify.com/v1/me/player/currently-playing?additional_types=track",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      },
    );

    if (response.status === 204 || response.status === 202) {
      return { isPlaying: false };
    }

    if (!response.ok) {
      return { isPlaying: false };
    }

    type SpotifyCurrentlyPlaying = {
      is_playing: boolean;
      progress_ms?: number;
      item?: {
        name?: string;
        duration_ms?: number;
        artists?: Array<{ name?: string }>;
        album?: {
          name?: string;
          images?: Array<{ url?: string }>;
        };
        external_urls?: { spotify?: string };
      };
      currently_playing_type?: string;
    };

    const data = (await response.json()) as SpotifyCurrentlyPlaying;

    const isPlaying = data?.is_playing === true;
    const item =
      (data?.item ?? data?.currently_playing_type === "track")
        ? data?.item
        : undefined;

    if (!isPlaying || !item) {
      return { isPlaying: false };
    }

    const title: string | undefined = item?.name;
    const artists: string = Array.isArray(item?.artists)
      ? item.artists
          .map((a: { name?: string }) => a?.name)
          .filter(Boolean)
          .join(", ")
      : "";
    const songUrl: string | undefined = item?.external_urls?.spotify;

    return {
      isPlaying: true,
      title,
      artist: artists,
      songUrl,
    };
  } catch {
    return { isPlaying: false };
  }
}
