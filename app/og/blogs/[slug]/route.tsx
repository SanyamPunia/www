import { renderCard } from "@/app/og/card";
import { formatBlogDate, getAllBlogs } from "@/lib/blogs";

// A post with no `meta.json` has no route, so it gets no image either.
export const dynamicParams = false;

export function generateStaticParams(): { slug: string }[] {
  return getAllBlogs().map(({ slug }) => ({ slug }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  const post = getAllBlogs().find((blog) => blog.slug === slug);
  if (!post) return new Response("Not found", { status: 404 });

  return renderCard({
    title: post.title,
    description: post.description,
    meta: [formatBlogDate(post.date), post.readTime],
  });
}
