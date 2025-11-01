import type { Metadata } from "next";
import meta from "./meta.json";

export const metadata: Metadata = {
  title: meta.title,
  description: meta.description,
  alternates: {
    canonical:
      "/blogs/modeling-link-navigation-state-with-usetransition-and-useoptimistic",
  },
  openGraph: {
    title: meta.title,
    description: meta.description,
    url: "/blogs/modeling-link-navigation-state-with-usetransition-and-useoptimistic",
    type: "article",
    publishedTime: meta.date,
  },
};

export { default } from "./page.mdx";
