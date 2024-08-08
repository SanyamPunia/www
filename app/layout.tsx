import type { Metadata } from "next";
import "@/styles/globals.css";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://sanyam.xyz"),
  title: {
    default: "Sanyam Punia",
    template: "Sanyam | %s",
  },
  description: "sanyam is a full-stack web developer from india",
  openGraph: {
    title: "Sanyam Punia",
    description: "sanyam is a full-stack web developer from india",
    url: "https://sanyam.xyz",
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body className={cn("min-h-screen antialiased dark", inter.className)}>
        {children}
      </body>
    </html>
  );
}
