import type { Metadata } from "next";
import { MotionProvider } from "@/components/providers/motion-provider";
import { Toaster } from "@/components/providers/toaster";
import { SITE_URL } from "@/lib/constants";
import { inter } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Sanyam Punia",
    template: "%s - Sanyam",
  },
  description:
    "Full-stack developer from India, currently a frontend engineer at Oliv AI. Writes about frontend, ships small dev tools and keeps a lab of UI experiments.",
  openGraph: {
    title: "Sanyam Punia",
    description:
      "Full-stack developer from India, currently a frontend engineer at Oliv AI. Writes about frontend, ships small dev tools and keeps a lab of UI experiments.",
    url: SITE_URL,
    siteName: "Sanyam Punia",
    locale: "en-US",
    type: "website",
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
      </body>
    </html>
  );
}
