import type { Metadata } from "next";
import { BlogPost } from "@/components/blogs/blog-post";
import { blogMetadata } from "@/lib/blogs";
import meta from "./meta.json";
import Content from "./page.mdx";

const post = {
  slug: "modeling-link-navigation-state-with-usetransition-and-useoptimistic",
  ...meta,
};

export const metadata: Metadata = blogMetadata(post);

export default function Page() {
  return (
    <BlogPost meta={post}>
      <Content />
    </BlogPost>
  );
}
