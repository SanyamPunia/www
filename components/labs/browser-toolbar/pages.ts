/**
 * The toolbar's history: four of this site's own paths, so the address bar reads
 * as a real one and the share button copies a link that resolves.
 */
export const SITE = "sanyam.sh";

export const PAGES: readonly string[] = [
  "",
  "/work",
  "/blogs",
  "/lab",
  "/icons",
  "/about",
  "/contact",
  "/privacy",
];

/** where it opens: deep enough that a run of quick backs has room to build */
export const START = 6;
