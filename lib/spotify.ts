/**
 * Spotify now-playing.
 *
 * Behind a credentials check rather than a throw. The original threw from a
 * helper and relied on an outer catch to swallow it, which works but means a
 * missing variable is indistinguishable from a dead API. Here an unconfigured
 * install simply reports nothing playing, so the site boots with one line
 * absent instead of the home page failing.
 *
 * Needs `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` and
 * `SPOTIFY_REFRESH_TOKEN`. See `/api/spotify/login` for minting the last one.
 */

export interface NowPlaying {
  isPlaying: boolean;
  title?: string;
  artist?: string;
  songUrl?: string;
  /** album cover, already narrowed to a sensible size. See `pickCover`. */
  albumArt?: string;
}

interface SpotifyCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

const NOT_PLAYING: NowPlaying = { isPlaying: false };

function readCredentials(): SpotifyCredentials | null {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) return null;
  return { clientId, clientSecret, refreshToken };
}

async function getAccessToken(
  credentials: SpotifyCredentials,
): Promise<string | null> {
  const basicAuth = Buffer.from(
    `${credentials.clientId}:${credentials.clientSecret}`,
  ).toString("base64");

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: credentials.refreshToken,
    }),
    cache: "no-store",
  });

  if (!response.ok) return null;

  const json = (await response.json()) as { access_token?: string };
  return json.access_token ?? null;
}

interface CurrentlyPlayingResponse {
  is_playing?: boolean;
  item?: {
    name?: string;
    artists?: Array<{ name?: string }>;
    external_urls?: { spotify?: string };
    album?: { images?: Array<{ url?: string; width?: number }> };
  };
}

/**
 * Spotify returns three covers, largest first: 640, 300 and 64. The disc renders
 * at 48px, so 64 is the closest fit by pixel count and the wrong choice, since it
 * is already soft on a 2x display. This takes the smallest cover that still has
 * headroom for that, which is the 300, and falls back to whatever exists if the
 * shape ever changes.
 */
function pickCover(
  images: Array<{ url?: string; width?: number }> = [],
): string | undefined {
  const usable = images.filter((image) => image.url);
  const ascending = [...usable].sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
  const roomy = ascending.find((image) => (image.width ?? 0) >= 128);
  return (roomy ?? ascending.at(-1))?.url;
}

export async function getNowPlaying(): Promise<NowPlaying> {
  const credentials = readCredentials();
  if (!credentials) return NOT_PLAYING;

  try {
    const accessToken = await getAccessToken(credentials);
    if (!accessToken) return NOT_PLAYING;

    const response = await fetch(
      "https://api.spotify.com/v1/me/player/currently-playing?additional_types=track",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      },
    );

    /*
     * 204 is "nothing playing" and 202 is "not ready yet". Both are 2xx, so
     * `response.ok` is true for them and they have no body. Checking them
     * before `ok` is what keeps `json()` from throwing on an empty response.
     */
    if (response.status === 204 || response.status === 202) return NOT_PLAYING;
    if (!response.ok) return NOT_PLAYING;

    const data = (await response.json()) as CurrentlyPlayingResponse;
    if (data.is_playing !== true || !data.item) return NOT_PLAYING;

    return {
      isPlaying: true,
      title: data.item.name,
      artist: (data.item.artists ?? [])
        .map((artist) => artist.name)
        .filter(Boolean)
        .join(", "),
      songUrl: data.item.external_urls?.spotify,
      albumArt: pickCover(data.item.album?.images),
    };
  } catch {
    return NOT_PLAYING;
  }
}
