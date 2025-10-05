import type { Metadata } from "next";
import meta from "./meta.json";

export const metadata: Metadata = {
  title: meta.title,
  description: meta.description,
  alternates: {
    canonical: "/blogs/understanding-trpc-using-nextjs",
  },
  openGraph: {
    title: meta.title,
    description: meta.description,
    type: "article",
  },
};

export { default } from "./page.mdx";
