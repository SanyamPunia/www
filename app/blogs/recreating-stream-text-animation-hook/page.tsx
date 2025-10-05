import type { Metadata } from "next";
import meta from "./meta.json";

export const metadata: Metadata = {
  title: meta.title,
  description: meta.description,
  alternates: {
    canonical: "/blogs/recreating-stream-text-animation-hook",
  },
  openGraph: {
    title: meta.title,
    description: meta.description,
    url: "/blogs/recreating-stream-text-animation-hook",
    type: "article",
    publishedTime: meta.date,
  },
};

export { default } from "./page.mdx";
