import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
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
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased`}>
        {children}
        <Script
          src="https://assets.onedollarstats.com/stonks.js"
          strategy="lazyOnload"
        />
      </body>
    </html>
  );
}
