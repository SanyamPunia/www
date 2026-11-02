import type { Metadata } from "next";
import { BlogPost } from "@/components/blogs/blog-post";
import { blogMetadata } from "@/lib/blogs";
import meta from "./meta.json";
import Content from "./page.mdx";

const post = {
  slug: "unslopping-a-site-with-dither-grain-ascii-and-line-screens",
  ...meta,
};

export const metadata: Metadata = blogMetadata(post);

export default function Page() {
  return (
    <BlogPost meta={post} toc={false}>
      <Content />
    </BlogPost>
  );
}
