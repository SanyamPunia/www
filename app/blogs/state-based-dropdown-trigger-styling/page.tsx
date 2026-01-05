import type { Metadata } from "next";
import meta from "./meta.json";

export const metadata: Metadata = {
  title: meta.title,
  description: meta.description,
  alternates: {
    canonical: "/blogs/state-based-dropdown-trigger-styling",
  },
  openGraph: {
    title: meta.title,
    description: meta.description,
    url: "/blogs/state-based-dropdown-trigger-styling",
    type: "article",
    publishedTime: meta.date,
  },
};

export { default } from "./page.mdx";
