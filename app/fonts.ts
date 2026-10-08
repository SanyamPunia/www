import { Caveat, Inter } from "next/font/google";

export const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

/**
 * A handwriting face, for annotation only.
 *
 * Deliberately not on the type scale and not a body font. `document-pocket` is
 * the only caller, where a hint about the demo has to read as a note pencilled
 * beside it rather than as more UI, and the site's own Inter cannot say that.
 *
 * Next scopes a font to the components that use it, so this is fetched on the one
 * lab page that renders it and nowhere else, and `next/font` self-hosts it, so
 * neither that page nor any other makes a third-party request.
 *
 * No `weight`, so this is the variable font and `font-medium` picks the weight at
 * the call site.
 */
export const caveat = Caveat({
  variable: "--font-caveat",
  subsets: ["latin"],
  display: "swap",
});
