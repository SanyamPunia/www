import { Caveat, Inter } from "next/font/google";

export const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

/**
 * A handwriting face, for annotation only.
 *
 * Deliberately not on the type scale and not a body font. Three callers, none
 * of them UI copy: `document-pocket`'s hint, the `NewBadge`, and the note
 * `scribble-type` writes out. The site's own Inter cannot read as handwriting.
 *
 * Next scopes a font to the components that use it, so this is fetched only on
 * the pages that render one of those, and `next/font` self-hosts it, so no page
 * makes a third-party request.
 *
 * No `weight`, so this is the variable font and `font-medium` picks the weight at
 * the call site.
 */
export const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  display: "swap",
});
