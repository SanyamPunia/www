import type { Metadata } from "next";
import Script from "next/script";
import { MotionProvider } from "@/components/providers/motion-provider";
import { Toaster } from "@/components/providers/toaster";
import { SelectionPins } from "@/components/ui/selection-pins";
import { SITE_URL } from "@/lib/constants";
import { DESCRIPTION } from "@/lib/site";
import { inter } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Sanyam Punia",
    template: "%s - Sanyam",
  },
  description: DESCRIPTION,
  openGraph: {
    title: "Sanyam Punia",
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "Sanyam Punia",
    locale: "en-US",
    type: "website",
    // The card as a looping clip, rendered by `scripts/og-video/render.mjs`.
    // It opens and closes on the same frame as `opengraph-image.jpg`, so a
    // platform that plays it and one that shows the image show the same card.
    // Next resolves image URLs against `metadataBase` and not video URLs, so
    // this one is absolute or a crawler gets a path it cannot fetch.
    videos: [
      {
        url: `${SITE_URL}/assets/og-video.mp4`,
        type: "video/mp4",
        width: 1200,
        height: 630,
      },
    ],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  twitter: {
    title: "Sanyam Punia",
    card: "summary_large_image",
  },
  verification: {
    google: "1UfWpmVsXpdgCvfTaMNEt5ck10YnDgRbqBR2c5HkAuQ",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased`}>
        {/*
         * The <ViewTransition> boundary lives in each page, not here. A
         * layout's children slot holds its position in the tree across a
         * navigation, so React reconciles it as an update and neither `enter`
         * nor `exit` ever fires. Per-page boundaries genuinely unmount and
         * mount, which is what those props respond to.
         */}
        <MotionProvider>{children}</MotionProvider>
        {/* mounted once, so a feature only ever calls toast() */}
        <Toaster />
        {/* here rather than in the home page, since the listener has to
            clear the carets on a navigation away. It draws on "/" only */}
        <SelectionPins />
        {/*
         * Analytics. The tracker hooks `history.pushState` and `popstate`
         * itself, so App Router navigations are counted with nothing wired up
         * per route. `afterInteractive` rather than `beforeInteractive`: the
         * latter is fetched ahead of first-party code, which is the wrong
         * trade for a page-view counter. There is no `data-hostname`, so the
         * script reports `location.hostname` and preview deploys land on a
         * host that is not registered, which drops them.
         */}
        <Script defer src="https://assets.onedollarstats.com/stonks.js" />
      </body>
    </html>
  );
}
