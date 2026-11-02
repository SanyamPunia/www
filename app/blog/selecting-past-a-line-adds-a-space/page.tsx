import type { Metadata } from "next";
import { BlogPost } from "@/components/blogs/blog-post";
import { blogMetadata } from "@/lib/blogs";
import meta from "./meta.json";
import Content from "./page.mdx";

const post = { slug: "selecting-past-a-line-adds-a-space", ...meta };

export const metadata: Metadata = blogMetadata(post);

export default function Page() {
  return (
    <BlogPost meta={post}>
      <Content />
    </BlogPost>
  );
}
