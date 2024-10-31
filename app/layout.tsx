import type { Metadata } from "next";
import "@/styles/globals.css";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import { Analytics } from "@vercel/analytics/react";
import { ViewTransitions } from "next-view-transitions";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://sanyam.xyz"),
  title: {
    default: "Sanyam Punia",
    template: "%s - Sanyam",
  },

  description: "sanyam is a full-stack web developer from india",
  openGraph: {
    title: "Sanyam Punia",
    description: "sanyam is a full-stack web developer from india",
    url: "https://sanyam.xyz",
    siteName: "Sanyam Punia",
    locale: "en-US",
    type: "website",
    images: [
      { url: "https://sanyam.xyz/opengraph-image.jpg" },
      {
        url: "https://sanyam.xyz/twitter-image.jpg",
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
    <ViewTransitions>
      <html lang="en" suppressHydrationWarning>
        <head />
        <body
          className={cn(
            "min-h-screen antialiased dark scrollbar",
            inter.className
          )}
        >
          {children}
          <Analytics />
        </body>
      </html>
    </ViewTransitions>
  );
}
