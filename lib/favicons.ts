interface Favicon {
  src: string;
  /** Intrinsic ratio, so a wordmark is not squashed into a square. */
  width: number;
  height: number;
}

/**
 * Marks are stored in `public/assets/favicons` rather than hotlinked or pulled
 * from Google's favicon service, so a page load makes no third-party request
 * and nothing shifts when a remote host is slow.
 *
 * Squares are the sites' own favicons, normalised to 32px webp. Two needed
 * work: npm 403s on `/favicon.ico` behind Cloudflare, and Enclave ships a
 * white-on-transparent mark that is invisible on white, so its dark tile is
 * composited locally. SoundCloud and Spotify come from svgl.app, SoundCloud as
 * a wordmark and Spotify as a square.
 *
 * Re-fetch by hand if a brand changes its mark.
 */
const FAVICONS: Record<string, Favicon> = {
  "oliv.ai": { src: "/assets/favicons/oliv.webp", width: 16, height: 16 },
  "enclave.money": {
    src: "/assets/favicons/enclave.webp",
    width: 16,
    height: 16,
  },
  "bitscale.ai": {
    src: "/assets/favicons/bitscale.webp",
    width: 16,
    height: 16,
  },
  "npmjs.com": { src: "/assets/favicons/npm.webp", width: 16, height: 16 },
  "soundcloud.com": {
    src: "/assets/favicons/soundcloud.svg",
    width: 36,
    height: 16,
  },
  // the now-playing line links a track, so the host is always open.spotify.com
  "open.spotify.com": {
    src: "/assets/favicons/spotify.svg",
    width: 16,
    height: 16,
  },
};

/** Resolves a link's host to a local mark, or null for internal routes. */
export function faviconFor(href: string): Favicon | null {
  if (!href.startsWith("http")) return null;
  try {
    const host = new URL(href).hostname.replace(/^www\./, "");
    return FAVICONS[host] ?? null;
  } catch {
    return null;
  }
}
